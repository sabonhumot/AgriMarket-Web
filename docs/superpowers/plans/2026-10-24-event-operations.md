# Event Manager Event Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event creation, editing, and an operational event detail page to the authorized Event Manager web portal.

**Architecture:** Keep the existing Vite/React shell and manager-scoped Supabase RPC contracts. Add a web Event Manager data module for event payload mapping and mutation/read operations, a responsive event form, and an event detail screen reachable from the Events directory. Extend client-side routes while retaining the shared role gate.

**Tech Stack:** React 19, TypeScript, Vite 8, Supabase JS 2, CSS.

**Spec:** `docs/superpowers/specs/2026-10-19-event-manager-web-portal-design.md`, Event Directory, Create and edit event, Event detail, and Data and component boundaries.

## Global Constraints

- Reuse the configured Supabase browser client; never use a service key.
- Call only manager-scoped RPCs; the database remains authoritative for ownership and write permissions.
- Display dates and times in Asia/Manila and submit the same event fields the mobile workflow uses.
- Show errors when RPC calls fail; never imply a write succeeded unless the RPC returned successfully.
- Keep all protected routes behind the existing active-role check.
- Do not add or run tests unless the user asks for tests or verification; use build and lint checks for this implementation.

## Review Focus

- Invalid date, time, capacity, or venue input remains in the form with field-level guidance.
- Save-draft and publish paths preserve the right lifecycle status when an RPC fails partway through.
- Editing is offered only for drafts and upcoming events the mobile rules consider editable.
- Event actions do not repeat while pending and affected event-list data refreshes after success.
- Empty application and invitation data remain useful states rather than errors.

---

### Task 1: Web manager event service

**Files:** Create `src/event-manager/events-service.ts`; consume `src/admin/supabase.ts` and the mobile contract in `services/event-manager-data.ts`.

**Interfaces:** `loadManagedEvent(client, eventId)`, `saveManagedEvent(client, eventId, input)`, `publishManagedEvent(client, eventId)`, and event action helpers call the existing `get_managed_event_details`, `create_my_market_event`, `update_my_market_event`, `publish_my_market_event`, application, invitation, broadcast, no-show, cancellation, performance, and export RPCs.

- [ ] Map the mobile event fields to the RPC `p_input` shape: name/type/description, expected and maximum farmer counts, event and end dates, start/end hours, location/venue, Cebu area, municipality key, application deadline, eligibility/join mode/instructions, coordinates, cover path, and draft/published status.
- [ ] Keep action wrappers manager-scoped, typed, and transparent about RPC errors.
- [ ] Produce CSV text from the existing export RPC results for browser downloads.

### Task 2: Create and edit event form

**Files:** Create `src/event-manager/EventManagerEventForm.tsx` and `.css`; update `src/App.tsx`, `src/auth/WebRoute.tsx`, and `src/event-manager/EventManagerEvents.tsx`.

**Interfaces:** Form takes optional `eventId`, `onBack`, and `onSaved`; `/event-manager/events/new` creates and `/event-manager/events/:id/edit` edits.

- [ ] Add responsive form sections for event details, schedule, venue/location and map coordinates, farmer participation, and review.
- [ ] Support the mobile event types, single/multi-day schedule, details, capacity, application deadline, eligibility, join mode, instructions, and save-draft/publish choices.
- [ ] Load and map the event before editing; preserve existing fields and show an error when the event cannot be loaded.
- [ ] Validate required fields, Cebu location inputs, schedule order, capacity, and deadline before submitting.
- [ ] Save through create/update RPCs; publish draft events through the publish RPC; report partial failure truthfully.
- [ ] Link New event from the Events directory and Edit from event details.

### Task 3: Event detail and operations

**Files:** Create `src/event-manager/EventManagerEventDetail.tsx` and `.css`; update event card links and web routing.

**Interfaces:** `/event-manager/events/:id` loads one event detail through `get_managed_event_details`; mutations refresh the detail and cached Events list.

- [ ] Show event status, schedule, venue, participation settings, application counts, attendance, and performance.
- [ ] List applications with approve/reject actions, including a required rejection reason.
- [ ] Create application invite links and support direct eligible-farmer invitations using the existing directory and invitation RPCs.
- [ ] Support farmer broadcast, promotion to nearby buyers, attendance/no-show actions, and cancellation with a reason and confirmation.
- [ ] Download attendance and sales-summary CSVs through browser Blob links.
- [ ] Display loading, error, empty, mutation, and confirmation states; disable duplicate in-flight actions.

### Task 4: Integrate, document, and build-check

**Files:** Update `src/event-manager/EventManagerEvents.tsx`, `src/auth/WebRoute.tsx`, `src/App.tsx`, and the current milestone section in the spec.

- [ ] Refresh the in-memory Events list cache after successful create, edit, publish, or cancellation.
- [ ] Ensure direct links and browser back/forward continue through the role gate without a full document reload.
- [ ] Run targeted ESLint, `npm run build`, and `git diff --check`.
- [ ] Review the diff for exposed cross-manager data access and false success states.
