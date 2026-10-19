# Event Manager Web Portal Design

**Date:** 2026-10-19  
**Status:** Design approved in chat; written spec pending review

## Intent and success criteria

Build a working desktop and responsive web portal for AgriMarket Event Managers. It must let the same active Event Manager account manage the same events and farmer participation seen in the mobile app. A manager can sign in, plan and publish an event, review applications, invite eligible farmers, check farmers in, communicate event updates, and inspect or export results. The portal uses live Supabase data and makes loading, empty, and failure states explicit.

## Placement and access

- Add the portal at `/event-manager` within the existing Vite and React app. Keep `/admin` as an administrator oversight workspace and `/` as the public site.
- Reuse the existing Supabase browser client and email/password session. Check the authenticated `users` row for `role = 'event_manager'` and `user_status = 'active'` before showing manager data. A failed role check signs out the local session and displays a role-specific error.
- The portal calls the existing manager-scoped Supabase RPCs. Ownership and authorization remain enforced by the database. The browser never supplies an arbitrary manager ID or uses an admin query to mutate manager data.
- A signed-in manager can refresh, sign out, and return to the public site. A manager visiting `/admin` does not gain administrator access.

## Information architecture and interface

Use a responsive shell with desktop side navigation and a compact narrow-screen menu. The visual language follows the existing AgriMarket web palette and the mobile Event Manager's clear status, schedule, and participation hierarchy.

1. **Overview:** Organization identity, active/upcoming, expected farmer, and completed event metrics; next event; pending application count; direct actions for creating an event and starting check-in.
2. **Events:** Searchable upcoming, past, and draft views. Event rows or cards show status, date and time, venue, approved slots, and pending applications. A selected event opens its operational detail view.
3. **Create and edit event:** A desktop step form for event details, schedule, Cebu venue and map point, farmer participation, and review. Preserve mobile event types, date and capacity rules, application deadline, join mode, eligibility, instructions, and draft/publish distinction. Existing draft and editable published events can be updated subject to the server rules.
4. **Event detail:** Summary and status, applications and allocations with approve/reject actions, eligible-farmer invitations and application links, promotion to nearby buyers, farmer broadcasts, attendance/no-show controls, performance figures, cancellation, and attendance/sales CSV exports. Show actions only when the event state allows them; the RPC remains authoritative.
5. **Check-in:** Select a current managed event, scan a farmer Virtual ID QR through the browser camera when available, or paste the complete QR payload into a manual entry field. Show the verified farmer and result, prevent duplicate submissions, and provide camera permission and retry states.
6. **Notifications:** List event updates, identify unread entries, mark one or all read, and open referenced events.
7. **Profile and farmer directory:** View and edit Event Manager organization/contact information using existing profile RPCs. Search eligible farmers when preparing invitations and show their verified summary. Portal search filters the managed event list and queries the existing farmer directory RPC; it adds no new server contract.

The portal covers Event Manager event operations from mobile. The shared mobile chat assistant and device push-token registration remain mobile-specific; the browser portal uses its notifications view.

## Data and component boundaries

- A web-specific Event Manager service wraps typed RPC calls and maps returned event, application, farmer, notification, and performance records into UI models. Copy the behavior of the mobile mappers and validators that is platform-independent; do not import Expo modules into the Vite app.
- A route-level access component owns session changes and role checks. The portal shell owns navigation. Each screen owns its loading and interaction state and calls the service, then refreshes affected data after mutations.
- Map RPC errors to actionable messages without claiming a write succeeded. Display a confirmation step for publish, cancel, broadcast, promotion, rejection, no-show, and invitation actions. Disable repeat submission while a mutation is pending.
- Create and edit operations use `create_my_market_event`, `update_my_market_event`, and `publish_my_market_event`; event detail uses `get_managed_event_details` and the corresponding application, invitation, check-in, notification, and report RPCs already used by mobile.
- CSV exports use the existing export RPCs and browser `Blob` downloads. Event cover and organization logo uploads use the existing `event-manager-media` bucket with size/type limits equivalent to mobile.
- Dates and times display in `Asia/Manila`. Schedule validation evaluates the event's local date and time, not the browser's timezone.

## Failure and safety behavior

- Missing Supabase configuration, signed-out access, inactive/wrong-role accounts, data loading failure, empty results, camera denial, and mutation failure have distinct states.
- The check-in camera starts only after a direct user action, stops when the user leaves check-in, and ignores further detections while one code is being verified. Manual entry sends the same payload to `check_in_event_farmer`.
- Keep manager navigation functional after refresh through the `/event-manager` path and client-side view state. Do not expose event data before the access check completes.
- No new database migration is expected. If a required RPC or media policy differs from the mobile contract, surface the mismatch instead of weakening authorization or substituting mock data.

## Verification

- Unit tests for role gating, RPC mapping, schedule/form validation, CSV output, and important state/action guards.
- Build, lint, focused tests, and current full web test suite.
- Browser review at desktop and narrow widths: sign-in, navigation, loading/empty/error states, create/edit, event actions, notifications, and check-in permission/fallback. Live writes are exercised only with an authorized test account and test event; otherwise verify call contracts with mocks and report the untested live path.
