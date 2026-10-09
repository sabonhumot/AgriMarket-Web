# Admin case report actions

**Status:** Draft for user review  
**Surface:** Admin web Reports  
**Source:** `AgriMarket_System_Admin_Flow_and_FAQs.pdf`, especially the complaint flow, report form, and warning/strike rules on pages 2, 4–6, and the report data dictionary on page 9.

## Goal

Let an active System Admin review a reservation-linked report, inspect the relevant transaction context, and record one clear case decision. A confirmed violation must create the correct warning or strike, apply the documented account restriction threshold, notify the parties, and leave an audit trail.

Keep account registration and automated buyer/farmer verification unchanged. Keep the review workflow in the admin web and database; do not add mobile screens or change mobile report submission.

## Current behavior and constraints

- Reports are listed in `ReportsDirectory`; opening one shows a read-only `DetailDrawer`.
- `loadAdminData` currently maps the reporter, reported user, category/reason, description, status, resolution outcome, and filed time. It does not load reservation details, report evidence, or messages.
- `reservation_reports` already stores the reservation link, participants, category, description, private evidence path, current status, resolution notes, reviewer, and resolution time.
- Report submission changes the reservation to `under_review` and holds its inventory from finalization.
- `resolve_transaction_report` accepts `fulfilled`, `not_fulfilled`, or `dismissed`. Fulfilled and not fulfilled finalize reservation inventory; dismissed restores the reservation's prior state. This field describes the reservation result, not whether a participant violated a rule.
- Report evidence is in the private `reservation-reports` Storage bucket. It must be served to admins through short-lived signed URLs.
- Relevant messages live in `messages` and `conversations`. Conversations are associated with a listing and participants, not directly with a reservation. The detail query must match the reservation's listing and both case participants; it must not show unrelated conversations.
- `user_strikes` records farmer event attendance strikes and requires a market event and application. It cannot represent transaction-report violations and must remain unchanged.
- The current schema has no general report-sanction record, active-point expiry model, or report decision field. The existing report resolver is not sufficient for violation decisions.

## Admin flow

1. Admin opens a report from the Reports table or dashboard.
2. A case detail view shows the case ID and current status; reporter and reported participant; category and description; reservation details and current reservation state; relevant messages; and the submitted evidence when available.
3. Admin chooses one case decision:
   - **Resolve:** close the report without confirming a violation.
   - **Dismiss:** close the report as unsubstantiated, invalid, excused, or otherwise not actionable.
   - **Confirm violation:** record the reported participant as having violated the policy and apply the selected severity.
4. Every decision requires a clear reason that will be included in party notifications and retained in the report history.
5. Resolve and Confirm violation also require a separate reservation outcome: **Fulfilled** or **Not fulfilled**. The case decision must not implicitly determine fulfillment. Dismiss restores the reservation status saved when the report was submitted.
6. Confirm violation requires one severity:
   - **Warning:** 0 points.
   - **Ordinary:** 1 point.
   - **Serious:** 2 points.
   - **Critical:** temporary protective investigation; never an automatic permanent ban.
7. Before confirmation, show current active points, points from this decision, resulting active points, and any resulting account restriction. Disable duplicate submissions while saving.
8. On success, close the detail view, refresh the directory and dashboard count, and show a clear confirmation. On failure, keep the form open with the entered values and show the recoverable error.

## Case and reservation state

Keep the report's case decision independent from the reservation outcome:

| Case decision | Report status | Reservation outcome |
| --- | --- | --- |
| Resolve | `resolved` | Required: fulfilled or not fulfilled |
| Dismiss | `dismissed` | Restore `reservation_status_before_report` |
| Confirm violation | `resolved`, with decision shown as violation confirmed | Required: fulfilled or not fulfilled |

Store a distinct decision value on the report (`resolved`, `dismissed`, or `violation_confirmed`) and retain the existing `resolution_outcome` field only for the reservation outcome (`fulfilled`, `not_fulfilled`, or `dismissed`). Keep the reason, decision severity, reviewer, and timestamp with the case. Existing historical report rows remain readable and are not reinterpreted as confirmed violations.

The decision RPC must lock the report and reservation, accept only open or under-review reports, validate the decision-specific fields, and commit the case decision, reservation outcome, violation/sanction record, audit log, and notifications atomically. A stale or already-closed case returns a conflict without partially updating inventory or sanctions.

## Severity and restrictions

- Ordinary and serious violations create one report-linked violation record with 1 or 2 points respectively. A warning is recorded with 0 points.
- Points count as active for 90 days from the decision time. Expired points remain in history but no longer count toward restrictions.
- At 1–2 active points, show the user a warning and correction notice.
- At 3–4 active points, apply a 7-day suspension.
- At 5 or more active points, apply a 30-day suspension and flag the account for admin review.
- Do not convert a complaint into a strike unless the admin confirms a violation.
- A report can create at most one violation record. Retries must not add duplicate points or repeated suspensions.
- A critical decision must record an explicit temporary restriction and investigation reason. It must not create an indefinite or permanent ban.

Use a new report-linked sanctions/violations model for these cases. Do not repurpose `user_strikes`. Store the target user, source report, severity, points, user-facing reason, issuing admin, issue time, and expiry/restriction times. The server calculates active points and restriction thresholds; the browser only previews them.

## Notifications and audit

- Notify both report participants after each final decision using the existing reservation notification path.
- The reported user receives the decision, reason, severity, points, expiry date, and any suspension dates. The reporter receives the case outcome and decision reason.
- Insert the report decision and sanction records, notifications, and a `system_logs` event in the same database transaction.
- Keep decisions immutable through the ordinary Reports UI. Corrections require a separately designed, audited admin correction flow.
- Do not add a request-response action in this release. The detail view may display matching existing messages read-only; no new mobile response flow is introduced.

## Data loading and privacy

- Add a report detail loader that loads the linked reservation and listing information, participant names, matching conversation messages, and the report's evidence metadata.
- Restrict all case detail and sanction reads to active admins at the database boundary. Do not query private case data through broad client-side table access.
- Resolve evidence into a short-lived signed URL only when the admin opens the report. Do not persist or expose the storage path as a public URL.
- Match conversations by listing ID and both reservation participants. If no unique relevant conversation can be found, show no messages and retain the rest of the case detail.
- Render explicit missing-evidence, unavailable-message, and loading states.

## UI behavior

- Keep the existing Reports table and filters; show the case decision in addition to the report status for closed reports.
- Replace the read-only report drawer content with a structured case detail view. Preserve the existing admin shell and shared typography, spacing, table, and button styles.
- Keep case evidence and messages in clearly labeled read-only sections, separate from the decision form.
- Make severity selection explain points and consequences. Show the computed restriction before the final action, not after it.
- Require an explicit final confirmation for a violation and resulting suspension. The confirmation summarizes the target user, severity, reason, points, active-point total, and restriction duration.
- Support keyboard access, visible focus, loading, error, empty-evidence, and already-closed states.

## Out of scope

- Mobile screen or report-submission changes.
- Admin-to-user response requests or chat composition.
- Appeals, strike reversal, or editing a finalized decision.
- General listing moderation, event-manager attendance strikes, or account registration verification.
- Automatic permanent account deletion or indefinite critical restrictions.

## Implementation areas

- **Admin web:** extend `AdminReport`, report data loading, `ReportsDirectory`, and report detail UI; add decision form, preview, notifications feedback, and refresh behavior.
- **Supabase migration:** add report decision and general violation/sanction storage; add admin-only detail and decision RPCs; enforce decision validation, thresholds, notifications, and audit logging in one transaction; add private evidence signing access.
- **Account enforcement:** ensure the existing app/backend access checks honor timed suspensions and restore access when the duration ends. Reuse a current enforcement mechanism if present; otherwise add the minimum database-backed mechanism needed.
- **No mobile UI changes.** Existing notifications may be displayed by the app's current notification handling.

## Verification plan

- Verify each case decision writes exactly one outcome and does not finalize inventory unless a reservation outcome was explicitly selected.
- Verify dismiss restores the prior reservation status and does not create a violation.
- Verify warning creates 0 points; ordinary creates 1; serious creates 2; critical creates only the explicitly time-limited protective restriction.
- Verify 90-day expiry and 3-point/5-point restriction thresholds at boundary values, with duplicate and stale requests rejected safely.
- Verify only active admins can read details, sign evidence, and decide cases; all other roles are denied.
- Verify report evidence URLs expire and the private bucket remains private.
- Verify relevant messages are limited to the reservation's listing and both participants.
- Verify both participants receive the correct notification and the system log identifies the admin and decision.
- Verify open, under-review, resolved, dismissed, and violation-confirmed UI states, including empty evidence, loading, error, and concurrent resolution.
- Verify timed suspension blocks access and ends at the stored expiry without a mobile UI change.

## Open policy detail for review

The PDF describes Critical as suspected misconduct requiring a temporary protective investigation, but does not give it a point value, default duration, or final disposition. Recommended interpretation: a Critical selection starts a time-limited investigation, awards no points while suspicion is unconfirmed, and leaves the report under review. The Admin then returns to the case and records Resolve, Dismiss, or Confirm violation with Warning, Ordinary, or Serious severity. Require an explicit restriction end time and show its effect before applying it. Confirm that this matches the intended policy during spec review.

The implementation plan must also confirm that the current account enforcement path can honor the restriction end time before the schema is applied.

