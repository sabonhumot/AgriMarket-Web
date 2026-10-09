# Farmer Marketplace Approval Design

**Status:** Approved for implementation  
**Date:** 2026-10-07  
**Primary surface:** AgriMarket Admin Portal (web)

## Goal

Add a separate administrator approval that controls whether a farmer may create a marketplace listing. The existing automated face and liveness check continues to verify the farmer's account. Completing that check must not count as marketplace approval.

Admins review information the farmer already has in the app. The active farmer flow does not collect government ID images, and this feature does not add document capture or upload.

## Current behavior

- `farmer_verifications` records the automated face/liveness account check. The current farmer submission flow can complete and approve that check automatically.
- The farmer app's existing Create button uses account status, profile completeness, and the automated verification result. It does not read an administrator marketplace decision.
- The server-side `create_farmer_listing` function checks that the caller is an active farmer with an active, complete farmer profile. It does not check a separate marketplace approval.
- The Admin Portal already lists farmer verification records with event applications, but the current record does not expose a farm-profile review or a marketplace approval action.
- Existing reviewable profile data includes farmer name and contact information, farm name and description, municipality, barangay, landmark, and the profile photo. Government-ID columns remain for legacy records only.

## Product decision

Use a distinct **Farmer marketplace approval** state. Do not reuse `farmer_verifications.review_status`, `users.user_status`, or `farmer_profiles.account_status`: those fields represent account identity, authentication, or profile access and are already used by the farmer app and listing flow.

The admin reviews existing profile details and may view the already-stored onboarding face capture. This marketplace decision does not introduce government ID collection or replace the automated identity check.

## Admin experience

Add a **Farmer approvals** queue within the Admin Portal's Applications area, separate from event applications and automated account verification.

The queue supports:

- Pending, approved, and changes-requested filters with counts.
- Search by farmer name, farm name, municipality, and farmer/profile ID.
- A detail view with the farmer's name and contact information, farm name, description, municipality, barangay, landmark, the onboarding face capture, and submission/update time.
- **Approve** and **Request changes** actions. Requesting changes requires a note explaining what the farmer should update. Approval may include an optional internal note.
- A visible current state, latest admin decision, reviewer, and decision time.

Show the onboarding face capture only inside the farmer's review detail, loaded on demand through a short-lived signed URL. Do not expose it in queue rows, public URLs, or general profile listings. The capture is context for the admin's review; automated face/liveness verification remains a separate account check. The guided liveness video is not shown or stored for admin review in the active flow.

## Farmer experience

Keep registration, face/liveness capture, and account activation unchanged. Extend the existing listing eligibility check to include marketplace approval:

- `pending_review`: keep Create disabled and explain that an admin is reviewing the farm profile.
- `changes_requested`: keep Create disabled and show the admin's note, with a link to the existing profile editor.
- `approved`: allow Create when the existing account, profile-completion, and automated-verification checks also pass.
- `not_submitted`: keep Create disabled until the farmer has a complete profile ready for review.

No new evidence-upload or review-submission screen is required. A profile enters the review queue automatically when its required farm fields are complete and its account has passed the existing identity check. Editing a review-sensitive field after approval returns the marketplace state to pending review. Editing a requested profile after a changes request requeues the updated profile.

Review-sensitive fields are farm name, farm description, municipality, barangay, and landmark. A profile-photo change should also requeue the profile if that photo is shown to the admin as part of their review.

## State and transitions

Store a separate marketplace review state for each farmer profile:

| Current state | Event | Next state |
| --- | --- | --- |
| `not_submitted` | Required farm profile becomes complete | `pending_review` |
| `pending_review` | Admin approves | `approved` |
| `pending_review` | Admin requests changes with a note | `changes_requested` |
| `changes_requested` | Farmer edits a review-sensitive profile field | `pending_review` |
| `approved` | Farmer edits a review-sensitive profile field | `pending_review` |

An admin action is valid only for a pending record. A farmer must not be able to set or change the review state, reviewer, decision time, or admin note directly.

## Data and enforcement

Add marketplace-review fields directly to `farmer_profiles`: `marketplace_review_status`, `marketplace_review_submitted_at`, `marketplace_reviewed_by`, `marketplace_reviewed_at`, and `marketplace_review_notes`. Constrain the state to `not_submitted`, `pending_review`, `approved`, or `changes_requested`. Keep one current state on the profile rather than copying personal profile data into a second table. Use the existing `system_logs` facility to retain the history of admin decisions.

The Admin Portal may read `face_scan_path` for an authorized review, but the `farmer-verifications` bucket must remain private. Add an authenticated-admin-only Storage read policy scoped to the `face-scan/front` objects needed for preview; issue short-lived signed URLs and load them only when a reviewer opens a case. Do not grant admins access to liveness videos or legacy government-ID paths through this policy.

The database remains authoritative:

1. Add a security-definer review RPC that verifies the caller is an active admin, accepts only approve/request-changes decisions, requires a note for requested changes, and updates only a pending review.
2. Record the admin actor, decision, note, and timestamp in the same transaction as the state update.
3. Update `create_farmer_listing` to require marketplace state `approved` in addition to its current account and profile checks.
4. Ensure any alternate path that creates a published listing applies the same approval check.
5. Make the profile update path requeue review-sensitive changes atomically so approval always applies to the details the admin reviewed.

The Admin Portal must continue using the signed-in user's publishable Supabase client. It must not use a service-role key. Admin-only decisions and private table changes must be guarded in the database, not only by hidden web controls.

## Existing farmers at rollout

Recommended default: preserve existing active listings, but place existing active farmers with complete profiles into `pending_review` during rollout. They may continue using existing account features and existing listings, but must be approved before creating additional listings. Incomplete profiles remain `not_submitted` until completed.

This rollout choice needs explicit review because it will create an initial review queue and temporarily prevent existing farmers from adding listings.

## Out of scope

- Changing automated face/liveness account verification or its approval semantics.
- Collecting government IDs, new photos, or other evidence in the mobile app.
- Changing registration, account routing, or farmer login access.
- Suspending existing listings solely because a farmer's profile is pending review.
- Changing event applications or reservation moderation.

## Implementation areas

- **Admin web:** farmer-review data types and loader, queue/filter/search, profile detail, decision actions, and refresh after a decision.
- **Supabase migration:** separate state and decision RPC, admin authorization, audit logging, profile-edit requeue behavior, listing-creation enforcement, and narrowly scoped admin access to face-capture objects.
- **Farmer app:** the small status read and existing Create-button eligibility/message update only. No registration or evidence-capture changes.

The CapstoneProject `AGENTS.md` currently describes that repository as UI/mock-data-only despite the checked-in Supabase services and migrations. Before implementation, confirm the permitted scope for the required migration and farmer eligibility read.

## Verification plan

- Verify admin queue states, filtering, search, detail rendering, and decision feedback against Supabase data.
- Verify only active admins can decide; non-admin users cannot read or mutate admin review state.
- Verify farmers cannot set admin-controlled fields or bypass the listing gate through the RPC or another write path.
- Verify pending and changes-requested farmers cannot create listings, while approved farmers still need to satisfy the existing checks.
- Verify edits to review-sensitive fields invalidate approval and preserve existing listings.
- Verify the farmer Create button and explanatory state for each marketplace review status.
- Verify migration behavior for existing complete/incomplete farmer profiles and the initial review queue.

## Open decisions for review

1. **Rollout:** Use the recommended default: queue existing active farmers with complete profiles; preserve existing listings.
2. **Profile photo:** No separate profile photo is shown in this review detail. Requeue farm name, description, municipality, barangay, and landmark changes.
3. **Admin placement:** Put the queue in Applications as a distinct Farmer approvals subview.

Implementation detail: resolve the face-capture path through an admin-only RPC when the detail opens. The web client does not read verification rows or retain the capture path in queue records. A listing-insert trigger enforces approval across every insert path.
