# Farmer Marketplace Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins review farmer profiles in the Admin Portal and approve farmers before they create additional marketplace listings.

**Architecture:** Keep marketplace eligibility separate from automated face/liveness account verification. Supabase stores the review state, exposes admin-only review actions and face-capture access, and enforces approval inside the listing RPC. The Admin Portal provides the review queue; the farmer app extends its existing Create-button gate to read the new state.

**Tech Stack:** React, TypeScript, Vite, Supabase Postgres/Storage/RLS, Expo SDK 54, React Native.

**Spec:** `docs/superpowers/specs/2026-10-07-farmer-marketplace-approval-design.md`

## Global Constraints

- Do not change automated face/liveness account verification, registration, or account activation.
- Do not collect government IDs or add evidence capture/upload.
- Preserve existing active listings; require review before farmers create new listings.
- Keep the `farmer-verifications` bucket private; show face captures only through an admin-authorized, short-lived signed URL.
- Do not expose liveness video or legacy government-ID paths to admins.
- Do not use a service-role key in either client application.
- Preserve unrelated existing changes in both working trees; scope edits to the files listed below.

## Review Focus

1. Existing complete, active farmers enter `pending_review` at rollout while their current listings remain available.
2. A profile edit concurrent with an approval cannot leave a stale approval attached to changed farm details.
3. The face-capture policy permits only active admins to sign `face-scan/front` images, not videos or legacy ID images.
4. Missing face capture, expired signed URL, or storage failure leaves the review usable and displays a recoverable preview state.
5. Duplicate or stale admin decisions fail safely; requesting changes requires a non-empty note.

---

## File Map

### `C:/Users/arljo/Desktop/CapstoneProject`

- `supabase/migrations/<timestamp>_farmer_marketplace_approval.sql` — state, transitions, admin RPC, Storage policy, and listing enforcement.
- `backend/supabase/types.ts` — generated-style table and RPC types.
- `services/farmer-data.ts` — include marketplace state and notes in the current farmer account query/model.
- `services/farmer-dashboard-data.ts` — add marketplace approval to `canCreateFarmerListing`.
- `app/(farmer)/(tabs)/listings.tsx` — disabled Create state and specific pending/changes-requested copy.
- `app/(farmer)/(tabs)/index.tsx` — keep dashboard create action consistent with the listing gate.

### `C:/Users/arljo/Desktop/agrimarket-web`

- `src/admin/admin-data.ts` — marketplace review records and profile/identity data mapping.
- `src/admin/AdminWorkspace.tsx` — pass data, decision handlers, refresh state, and pending count to Applications.
- `src/admin/components/AdminSidebar.tsx` — include pending farmer approvals in the Applications badge.
- `src/admin/components/ReviewDirectory.tsx` — add the Farmer approvals subview within Applications.
- `src/admin/components/FarmerMarketplaceReviewQueue.tsx` and `.css` — queue, filters, detail opening, status states, and decision form.
- `src/admin/marketplace-review.ts` — review RPC and signed face-capture URL helpers.
- `tests/admin-data.test.mjs` and `tests/admin-workspace.test.mjs` — update existing admin data/workspace coverage if implementation testing is requested.

## Task 1: Add Marketplace Review State and Database Enforcement

**Repo:** `CapstoneProject`

**Interfaces:**
- Produces `farmer_profiles.marketplace_review_status` with values `not_submitted`, `pending_review`, `approved`, and `changes_requested`.
- Produces `public.review_farmer_marketplace_profile(p_farmer_profile_id bigint, p_decision text, p_submitted_at timestamptz, p_notes text default null) returns void`.
- Produces an admin-only `public.get_farmer_marketplace_face_capture(p_farmer_profile_id bigint) returns text` so the browser never reads verification rows or stores a face path in queue data.
- A `BEFORE INSERT` trigger on `public.listings` enforces approval across every listing insert path.

- [ ] Create a migration adding marketplace status, submission/review timestamps, reviewer ID, and review notes to `farmer_profiles`, including a check constraint and safe defaults.
- [ ] Backfill active, complete farmer profiles to `pending_review`; leave incomplete profiles at `not_submitted`; do not alter existing listing rows.
- [ ] Add a profile trigger that queues complete, identity-verified farmers and returns approved or changes-requested profiles to review when reviewed farm fields change.
- [ ] Guard marketplace-owned columns against farmer-authored direct updates. Admin decisions must go through the review RPC.
- [ ] Add the admin review RPC. It checks `private.is_admin()`, accepts decisions only while pending and matching the queue's submission timestamp, requires a note for `changes_requested`, records reviewer/time, and writes an audit event in the same transaction.
- [ ] Add an admin-only face-capture path RPC and Storage `SELECT` policy limited to `farmer-verifications` objects under `face-scan/front`; enable own-row RLS for farmer profiles and identity verification rows.
- [ ] Add a `BEFORE INSERT` listing trigger requiring `marketplace_review_status = 'approved'` so alternate insert paths cannot bypass the decision.
- [ ] Update `backend/supabase/types.ts` for the new profile fields and RPC signature.

## Task 2: Extend the Existing Farmer Listing Gate

**Repo:** `CapstoneProject`

**Interfaces:**
- `FarmerAccount` exposes `marketplaceReviewStatus` and `marketplaceReviewNotes`.
- `canCreateFarmerListing(account, verification, verifiedFaceUrl)` also requires `account.marketplaceReviewStatus === 'approved'`.

- [ ] Select the marketplace review status and notes in `loadFarmerContext` and map them in `loadCurrentFarmer`.
- [ ] Extend `canCreateFarmerListing` without changing `canEnterFarmerSide`, account routing, or face/liveness behavior.
- [ ] Update the Listings screen to keep Create disabled for `not_submitted`, `pending_review`, and `changes_requested`, with state-specific guidance and the existing profile editor route for changes requested.
- [ ] Update the farmer dashboard create action to use the same eligibility decision and communicate pending review consistently.
- [ ] Confirm account verification remains sufficient for farmer app access; marketplace approval gates listing creation only.

## Task 3: Load Review Records and Private Face Capture on Demand

**Repo:** `agrimarket-web`

**Interfaces:**
- `AdminData.marketplaceReviews: AdminMarketplaceReview[]` contains profile ID, user ID, farmer name/email/mobile, farm fields, marketplace status, submitted/reviewed metadata, notes, and prior decisions; it contains no face-capture path.
- `loadFaceCaptureUrl(client, profileId): Promise<string | null>` resolves the path through the admin-only RPC and returns a signed URL expiring after five minutes.
- `reviewFarmerMarketplaceProfile(client, profileId, decision, notes): Promise<void>` calls the review RPC.

- [ ] Extend the admin data types and loader to map farmer profiles to users and the latest available face capture without merging this state into `farmer_verifications.review_status`.
- [ ] Add a helper that resolves a face path and requests a signed URL only when a reviewer opens a detail, handles missing paths and storage errors, and never stores a public URL or exposes verification-row data to the web client.
- [ ] Add the review RPC helper with exact decisions `approved` and `changes_requested`.
- [ ] Keep loading and error states scoped to marketplace reviews so existing Admin Portal data remains usable if this optional preview cannot load.

## Task 4: Add the Farmer Approvals Queue to Applications

**Repo:** `agrimarket-web`

**Interfaces:**
- `FarmerMarketplaceReviewQueue` consumes `AdminMarketplaceReview[]`, a `loadFaceCaptureUrl` callback, a decision callback, and a loading state.
- The queue is a distinct subview under Applications; event applications and automated farmer account verifications retain their existing flows.

- [ ] Add the Farmer approvals subview with pending/approved/changes-requested counts, search, status filters, and newest-first ordering.
- [ ] Show farmer identity/contact, farm name/description/location, submitted time, and current review state in the queue.
- [ ] Add a detail dialog that lazy-loads the face capture and displays the farmer profile fields, latest decision metadata, and prior marketplace decision events from `system_logs` where available.
- [ ] Add Approve and Request changes actions; require a reason for requested changes and show pending/error/success feedback.
- [ ] After a decision, refresh review data and include pending farmer approvals in the existing Applications sidebar badge alongside pending event applications. Keep the dialog state coherent if the record is no longer pending.
- [ ] Add responsive and accessible states for missing face capture, expired signed URL, failed preview, empty queue, and decision in progress.

## Scope Notes

- The farmer app change is limited to reading the marketplace state and extending its existing listing eligibility UI. Registration, onboarding capture, and authentication remain untouched.
- `CapstoneProject/AGENTS.md` describes a mock-data/UI-only scope, while the repository contains Supabase services and migrations. The approved feature design requires a real migration and account query; implementation must treat the user's explicit feature request as the applicable scope for these changes.
- Do not run tests or add test cases unless the user asks for verification. No test execution is part of this plan by default.

