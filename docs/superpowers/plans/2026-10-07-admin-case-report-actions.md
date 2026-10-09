# Admin Case Report Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let System Admins review reservation reports, decide cases independently from transaction outcomes, and apply auditable report-linked violations and time-limited restrictions.

**Architecture:** Add a database-backed case decision model and admin-only RPCs in `CapstoneProject`, keeping reservation fulfillment as a separate field and preserving the existing transaction inventory state machine. Extend the admin web report detail flow to load case context and evidence securely, preview decisions, submit one atomic decision, and refresh the reports/dashboard views. Add the minimum timed-sanction check to the existing app access gate without changing mobile screens.

**Tech Stack:** React, TypeScript, Supabase JS, PostgreSQL/Supabase migrations, React Native account-routing service.

**Spec:** `docs/superpowers/specs/2026-10-07-case-report-actions-design.md`

## Global Constraints

- Do not change registration, automated farmer verification, or mobile report submission.
- Keep `reservation_reports.resolution_outcome` for reservation fulfillment only; store case decisions separately.
- Do not reuse `user_strikes`; transaction-report violations need their own report-linked records.
- Only active System Admins may load full case details, sign evidence, or decide a case.
- Never expose private evidence as a permanent public URL; use a short-lived signed URL.
- Calculate active points and restrictions on the server; client previews are advisory.
- Do not introduce permanent or indefinite bans from this workflow.

## Review Focus

- **Non-admin or inactive admin access:** the database must deny detail, evidence, and decision RPC calls; cover with role/status authorization checks in the migration contract tests.
- **Concurrent or repeated decisions:** one report may create at most one violation and inventory must not be finalized twice; cover with stale/retry decision tests.
- **Expired points and threshold boundaries:** 90-day expiry and totals at 2/3/4/5 points must yield the documented result; cover with database policy tests.
- **Unrelated conversation or evidence leakage:** messages must match listing plus both reservation participants, and evidence must be signed only for an authorized admin; cover with data-scope tests.
- **Timed restriction expiry:** suspension must deny access until its stored end and permit it afterward; cover with account-routing/access tests.

---

## File map

- `CapstoneProject/supabase/migrations/<timestamp>_admin_case_report_actions.sql` — case decision columns, report violation/restriction records, RLS/grants, scoped detail/evidence access, atomic decision RPC.
- `CapstoneProject/backend/supabase/types.ts` — generated database types for new schema and RPCs.
- `CapstoneProject/services/account-routing.ts` and `services/farmer-access-service.ts` — include active timed restriction state in authenticated farmer access decisions.
- `CapstoneProject/services/__tests__/account-routing-access.test.ts` and `services/__tests__/admin-case-report-migration.test.ts` — pin access and SQL contracts.
- `src/admin/admin-data.ts` — report list fields and case detail/decision types and data functions.
- `src/admin/components/ReviewDirectory.tsx` — report status/decision display and detail selection wiring.
- `src/admin/components/DetailDrawer.tsx` plus focused report-detail component/CSS — reservation context, messages, evidence, decision form, preview, confirmation, loading/error/closed states.
- `src/admin/AdminWorkspace.tsx` — connect report detail loading/decision actions and refresh reports/dashboard after success.

## Task 1: Add the database case decision model and secure read APIs

**Files:**
- Create: `CapstoneProject/supabase/migrations/<timestamp>_admin_case_report_actions.sql`
- Modify: `CapstoneProject/backend/supabase/types.ts`
- Test: `CapstoneProject/services/__tests__/admin-case-report-migration.test.ts`

**Interfaces:**
- Produces `admin_get_reservation_report_detail(p_report_id bigint) -> jsonb`, returning case fields, linked reservation/listing summary, participants, only a uniquely matched conversation’s messages, and evidence path metadata (never a public URL).
- Produces `admin_create_reservation_report_evidence_url(p_report_id bigint) -> text`, returning a short-lived signed URL after verifying active System Admin access.
- Adds distinct case decision fields (`case_decision`, `decision_reason`, `decision_severity`, `decided_at`, `decided_by`) while retaining `resolution_outcome` for transaction outcome.
- Adds report-linked violation/restriction storage; warning/ordinary/serious map to 0/1/2 points, active for 90 days. A critical investigation is time-limited, awards zero points before confirmation, and leaves the case under review.

- [ ] **Step 1: Write migration contract tests** asserting the distinct decision columns, violation uniqueness per report, expiry fields, admin-only RPC grants, private evidence signing, and no changes to `user_strikes`.
- [ ] **Step 2: Run the focused migration contract test** and confirm it fails against the missing migration.
- [ ] **Step 3: Implement the schema and read RPCs** with RLS/revokes by default, active System Admin checks, deterministic message matching by listing and both participants, and no message data if the match is ambiguous.
- [ ] **Step 4: Generate/update Supabase types** for the new table columns and RPC signatures.
- [ ] **Step 5: Run the focused migration contract test** and confirm the schema/access contract passes.

## Task 2: Implement atomic case decisions, point thresholds, and timed restriction enforcement

**Files:**
- Modify: `CapstoneProject/supabase/migrations/<timestamp>_admin_case_report_actions.sql`
- Modify: `CapstoneProject/backend/supabase/types.ts`
- Modify: `CapstoneProject/services/account-routing.ts`
- Modify: `CapstoneProject/services/farmer-access-service.ts`
- Test: `CapstoneProject/services/__tests__/account-routing-access.test.ts`
- Test: `CapstoneProject/services/__tests__/admin-case-report-migration.test.ts`

**Interfaces:**
- Produces `admin_decide_reservation_report(p_report_id bigint, p_case_decision text, p_decision_reason text, p_reservation_outcome text, p_severity text default null, p_restriction_ends_at timestamptz default null) -> jsonb`.
- `p_case_decision` is `resolved`, `dismissed`, `violation_confirmed`, or `critical_investigation`; accepted only for open/under-review reports.
- `resolved` and `violation_confirmed` require `fulfilled` or `not_fulfilled`; `dismissed` restores the saved pre-report reservation state. Critical investigation requires an explicit future restriction end and leaves report `under_review`.
- `FarmerAccessSnapshot` gains `activeRestrictionEndsAt: string | null`; access is denied when the current time precedes that value.

- [ ] **Step 1: Add contract tests** for decision-specific required fields, no inventory mutation without an explicit reservation outcome, dismissal restore behavior, point totals at 2/3/4/5, expiry at 90 days, duplicate/stale conflicts, notifications/audit, and active restriction expiry.
- [ ] **Step 2: Run focused migration and account-routing tests** and confirm new behavior is not present.
- [ ] **Step 3: Implement the decision RPC** using report/reservation row locks and a single transaction for case decision, reservation outcome, violation/restriction record, notifications to both parties, and system log.
- [ ] **Step 4: Calculate server-side active points** excluding records whose 90-day expiry is at or before decision time; apply 7 days at 3–4 points and 30 days plus admin-review flag at 5+, with idempotent restriction records.
- [ ] **Step 5: Implement critical investigation** as a separate temporary restriction with explicit end time, zero points while unconfirmed, and report left under review; do not resolve inventory until a later final case decision.
- [ ] **Step 6: Extend farmer access loading and routing** to honor the active restriction end timestamp and resume access automatically after expiry; preserve current verification gating.
- [ ] **Step 7: Run the focused database-contract and access tests** and confirm all decision and expiry assertions pass.

## Task 3: Load case detail and present a structured report review

**Files:**
- Modify: `src/admin/admin-data.ts`
- Modify: `src/admin/components/ReviewDirectory.tsx`
- Modify: `src/admin/components/DetailDrawer.tsx`
- Create if separation is needed: `src/admin/components/ReportCaseDetail.tsx` and matching CSS
- Test: `tests/admin-data.test.mjs` and `tests/admin-interactions.test.mjs`

**Interfaces:**
- `AdminReport` includes `caseDecision`, `decisionReason`, and `decisionSeverity` separately from `outcome`.
- `loadAdminReportDetail(client, reportId)` calls `admin_get_reservation_report_detail` and returns typed case/reservation/message data.
- Evidence URL loading calls `admin_create_reservation_report_evidence_url` only when the report detail opens.

- [ ] **Step 1: Add failing admin data/component tests** in `tests/admin-data.test.mjs` and `tests/admin-interactions.test.mjs` for distinct status vs decision rendering, relevant context only, no-match messages, missing evidence, and loading/error/closed states.
- [ ] **Step 2: Run focused admin tests** and confirm the new fields and states are absent.
- [ ] **Step 3: Extend list loading** to select and display case decision fields without changing existing filters or reservation outcome semantics.
- [ ] **Step 4: Build the read-only case detail sections** for participants, category/description, reservation/listing, relevant messages, and private evidence preview, with explicit unavailable states.
- [ ] **Step 5: Run focused admin tests** and confirm case detail renders from the typed RPC result.

## Task 4: Add decision form, previews, confirmation, and refresh behavior

**Files:**
- Modify: `src/admin/admin-data.ts`
- Modify: `src/admin/components/ReportCaseDetail.tsx` and matching CSS (or `DetailDrawer.tsx` if no separate component was needed)
- Modify: `src/admin/AdminWorkspace.tsx`
- Test: `tests/admin-interactions.test.mjs` and `tests/admin-workspace.test.mjs`

**Interfaces:**
- `decideAdminReport(client, input)` calls `admin_decide_reservation_report` with case decision, reason, reservation outcome, severity, and optional restriction end.
- Before final submission the form shows active points, decision points, resulting total, restriction consequence, and a confirmation summary.

- [ ] **Step 1: Add failing UI tests** for required reason/outcome, severity-specific fields, duplicate-submit disabling, confirmation content, recoverable errors, and refresh after success.
- [ ] **Step 2: Implement decision form validation and preview**; client-side points are clearly provisional and server response is authoritative.
- [ ] **Step 3: Require explicit final confirmation** for violation and suspension, including subject, severity, reason, points, active total, and restriction duration.
- [ ] **Step 4: Submit through the atomic RPC**; preserve entered values on failure, close the drawer and refresh Reports/dashboard after success, and show confirmation feedback.
- [ ] **Step 5: Run focused admin UI tests** and confirm all decision paths and recoverable states pass.

## Task 5: Verify integrated permissions, transaction state, privacy, and UI behavior

**Files:**
- Review changes across the files above; add no unrelated cleanup.

- [ ] **Step 1: Run focused database migration contract tests** for admin role boundaries, stale/concurrent decisions, inventory outcome, point expiry, thresholds, and notifications/audit.
- [ ] **Step 2: Run focused mobile access-routing tests** for current approved access, active restriction, restriction expiry, and existing verification-required behavior.
- [ ] **Step 3: Run focused admin UI tests and type checking** for open, under-review, resolved, dismissed, violation-confirmed, and critical-investigation states.
- [ ] **Step 4: Review the migration for private bucket policy preservation, revokes/grants, duplicate protection, transactional writes, and absence of permanent bans or changes to `user_strikes`**.
- [ ] **Step 5: Review the final diff for scope**; keep the mobile UI untouched and retain only the minimum app access-gate change needed for temporary sanctions.
