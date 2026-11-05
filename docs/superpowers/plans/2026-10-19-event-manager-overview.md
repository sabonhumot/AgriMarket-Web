# Event Manager Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a live Event Manager overview and one shared login for admin and manager web roles.

**Architecture:** The existing Vite app dispatches `/login`, `/admin`, and `/event-manager` through a shared auth gate. A manager-specific service calls the existing dashboard RPC and maps its response into a focused overview model. The overview renders only available actions.

**Tech Stack:** React 19, TypeScript, Vite 8, Supabase JS 2, CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-19-event-manager-web-portal-design.md`, Current milestone section.

## Global Constraints

- Reuse the configured publishable Supabase browser client; never use a service key.
- Require an active `users` account with database role `admin` or `coordinator` before showing a workspace; map `coordinator` to the Event Manager UI.
- Use existing `get_event_manager_dashboard` RPC and no mock fallback.
- Keep `/` public and `/admin` behavior functional.
- Only ship overview functionality in this milestone.

## Review Focus

- Inactive and unsupported roles must not enter either workspace.
- A manager visiting `/admin` and an admin visiting `/event-manager` must go to their own workspace.
- A backend error must not look like an empty dashboard.
- A zero-event dashboard must show a truthful empty state.
- A dashboard refresh must not accidentally expose previous account data after sign-out.

### Task 1: Shared web role and login

**Files:** `src/admin/admin-auth.ts`, `src/admin/AdminLogin.tsx`, `src/admin/AdminRoute.tsx`, `src/App.tsx`, `src/auth/WebRoute.tsx`; test `tests/web-role.test.mjs`, update `tests/admin-auth.test.mjs`.

**Interfaces:** `getWebRole(client): Promise<'admin' | 'event_manager' | null>`; `WebRoute({ path })` renders the login or authorized workspace and redirects signed-in users to their role route.

- [ ] Add a failing role test for active admins, active managers, inactive accounts, and unsupported roles.
- [ ] Verify it fails because shared role lookup is absent.
- [ ] Implement role lookup using `auth.getUser()` and `users.role,user_status`.
- [ ] Add a failing route test for `/login` and `/event-manager` access checking.
- [ ] Verify it fails, implement shared login and route gate, then run focused and existing admin auth tests.

### Task 2: Dashboard service and overview

**Files:** `src/event-manager/dashboard-data.ts`, `src/event-manager/EventManagerOverview.tsx`, `src/event-manager/EventManagerOverview.css`; test `tests/event-manager-overview.test.mjs`.

**Interfaces:** `loadEventManagerDashboard(client)` calls `get_event_manager_dashboard` and returns typed profile, counters, and events; `EventManagerOverview({ onSignOut })` loads and displays that model.

- [ ] Add failing tests for RPC mapping, zero events, and RPC error propagation.
- [ ] Verify they fail, implement the service, and run focused tests.
- [ ] Add failing render tests for overview labels, organization identity, next event, and empty state.
- [ ] Verify they fail, implement the responsive overview and its loading, refresh, error, and sign-out controls.
- [ ] Run focused and full tests, build, lint, and browser layout review.

### Task 3: Documentation and completion

**Files:** `README.md`, current spec, this plan.

- [ ] Document `/login` and `/event-manager` and configuration requirements.
- [ ] Re-run build, lint, test suite, and `git diff --check`.
- [ ] Inspect the final diff for credential leaks, false affordances, and data exposure before committing.
