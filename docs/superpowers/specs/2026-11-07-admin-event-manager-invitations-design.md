# Admin-created Event Manager invitations

**Date:** 2026-11-07  
**Status:** Implemented locally; backend deployment and live verification pending  
**Surfaces:** Admin web, web invitation setup, Supabase backend  
**Mobile code:** No changes in this release

## Goal

Let an active System Admin create an Event Manager account and hand its intended owner a short-lived invitation as a copyable link or scannable QR code. The recipient claims the account in a browser, chooses a password, and can then sign in to both the existing Event Manager web portal and the existing mobile app with the same email and password.

The QR contains the same web invitation URL as the Copy link action. It opens browser setup on a phone; it does not sign the mobile app in directly.

## Current behavior and constraints

- The web app has one email/password `/login` page. An active `public.users` row with database role `coordinator` routes to `/event-manager`; other statuses and roles cannot enter that workspace. The user-facing name is **Event Manager**.
- The mobile app already accepts email/password and routes a `coordinator` account to its Event Manager area. This release depends on that behavior and adds no mobile deep-link or QR handler.
- The current Auth signup trigger in the mobile/backend repository creates a `buyer` user row and buyer profile for a new Auth user. It only recognizes `buyer` and `farmer` signup roles. A privileged provisioning workflow must correct the new row to `coordinator`, remove the unintended buyer profile where safe, and create the Event Manager profile before returning an invite.
- `event_manager_profiles` requires an organization name and accepts `organization` or `lgu` as the organization type. Its other contact and municipality fields can be filled at creation or later in the manager profile.
- The browser client has `detectSessionInUrl: false`. The invitation route must explicitly verify the Supabase token and establish a session. The ordinary role guard must let the recipient complete setup before checking active workspace access.
- Supabase Auth admin APIs require a server-held secret. The browser must call an authenticated server endpoint and must never receive the secret key.

## Release scope and product decisions

1. **Creation and first invite are one admin action.** The form submits account details; the server provisions the account and generates the first link. The UI reports success only after the account and profile are ready. The admin can generate another link later from that account's detail view.
2. **Manual handoff in this release.** The admin copies the URL or shows its QR code to the intended recipient. Automatic email delivery is deferred. The UI makes the link's expiry and sensitivity clear.
3. **Web claim, password sign-in thereafter.** After claiming, the manager signs into either web or mobile with email and password. There is no permanent passwordless or QR sign-in in this release.
4. **No implicit role conversion.** An email already registered as a buyer, farmer, admin, or another account returns an actionable conflict. The admin cannot silently promote or overwrite that account.

## Admin flow

1. In Admin → Users, the admin selects **Create Event Manager**.
2. The form collects first name, last name, sign-in email, organization name, organization type (`Organization` or `LGU`), and optional point of contact, official email, office contact number, and municipality. Explain that the sign-in email identifies the person; the official email may be the organization's public contact.
3. On submit, validate required fields, normalize the sign-in email, disable duplicate submission, and show a pending state. Do not ask the admin to choose or see a password.
4. On success, show the new account, **Copy invite link**, and **Show QR code**. Display the expiry time in Philippine time. A brief warning says that anyone holding the link can claim the account until it is used or expires.
5. The user directory and account detail show a distinct **Invitation pending** state until setup completes. Existing account status labels must remain accurate for other roles.
6. If the link is lost or expired, the admin chooses **Generate new invite** from that Event Manager's account detail. The new URL and QR replace the previous handoff. The server must establish the actual invalidation behavior for previously generated Supabase links; the UI must not claim an older link was revoked unless that is enforced.
7. If provisioning fails, show the step that failed without displaying a link. Retry must be safe and must not create a second account or a second profile.

## Recipient flow

1. The recipient opens the HTTPS link from a message or scans the QR with a phone camera. Both open the web invitation page.
2. The page shows a generic **Accept Event Manager invitation** action. It does not reveal the organization or email before identity verification. The one-time token is redeemed only after this explicit action, reducing accidental consumption by link previewers.
3. The callback verifies the token with Supabase, confirms that the authenticated Auth ID belongs to the pending `coordinator` account, then shows the organization, masked sign-in email, and password form. Clear the token from the visible URL immediately after reading it.
4. The recipient sets and confirms a password using the existing account password rules. The server records the invitation as claimed and activates the account only after password setup succeeds. Route the recipient to `/event-manager`.
5. The page gives distinct recovery paths for expired/used links, wrong account, provisioning mismatch, and a transient network failure. Expired or lost links direct the recipient to ask the admin for a new one.
6. If setup is interrupted, an existing verified session can resume the password step. If password setup succeeded but activation did not, a subsequent sign-in with that password resumes or retries activation instead of treating the account as an unsupported role. If the session is lost before a password exists, the admin can generate a fresh claim link.

## Backend contract and state

- Add an authenticated Supabase Edge Function (or equivalent trusted server endpoint) for create-and-generate and regenerate actions. Authenticate the caller's JWT, then look up the caller in `public.users` and require `role = 'admin'` and `user_status = 'active'` before any privileged Auth call.
- The endpoint owns Auth admin calls, profile creation, and invitation metadata. A browser-supplied role, target user ID, expiry, redirect URL, or organization owner is never trusted as authority. Use a configured production web origin for invite URLs.
- For first creation, generate a Supabase invite token for the new email, then reconcile the trigger-created `public.users` row into a pending `coordinator` account and create its `event_manager_profiles` row. Ensure the buyer profile created by the trigger is removed only for the newly created Auth ID. Return a handoff URL only after all required provisioning succeeds. If a later step fails, retry or compensate without leaving a usable invitation to a buyer account.
- Use the generated token hash to build an app-owned HTTPS claim URL with the token in the URL fragment, so the initial page request does not send it to the web server. Keep the token out of ordinary page analytics, referrers, server access logs, activity logs, and persisted invitation rows. The QR is generated from that URL in the browser and is never a separate credential.
- Record invitation metadata without the usable token: Auth ID, public user ID, creator admin ID, created time, last generated time, claimed time, and state. The server determines whether an account is pending, claimed, or needs repair. Make duplicate form submissions and network retries idempotent by normalized email and Auth ID.
- A guarded completion RPC or endpoint activates only the authenticated invited account after successful token verification and password setup. It records the transition and an audit event. A caller cannot activate another account by sending a user ID.
- Existing manager accounts are never recreated during regeneration. The server uses the appropriate Supabase link type for the account's current confirmation state and confirms the supported reissue behavior in integration tests before shipping.
- Apply an explicit active-status check to the relevant manager access boundary. In the web app, the existing role check already requires active status. The mobile app's current role router checks the role without checking manager status, so backend RLS and manager RPCs must deny pending/inactive managers. Any required client-side mobile guard is deferred and documented as a follow-up; this release must not depend on it for authorization.

## Link and QR rules

- A link is a short-lived bearer credential. Use Supabase's configured OTP/invite expiry and show the actual expiry returned or established by the server; do not hard-code a duration in the UI.
- A QR encodes only the HTTPS claim URL. On a phone without the mobile app, it still opens the browser setup. There is no APK install dependency for claiming.
- Never render a stale link after leaving the success view or refreshing the page. Regeneration returns a new link and QR; the directory stores only invitation state.
- Configure the Supabase Auth redirect allow list for the deployed web claim origin if the chosen token flow uses a redirect. Verify the local and production claim URLs separately.
- For a recipient already signed in as someone else, the claim page asks them to switch accounts before redemption. It does not attach the invite to the currently signed-in identity.

## UI and implementation areas

- **Admin web:** add the creation action and form to Users; add invite status and regenerate action to Event Manager details; add a one-time link/QR success panel. Keep other user rows and account actions unchanged.
- **Web auth:** add a public invitation route and password setup screen; explicitly verify the invite token and manage its session; adjust the route guard to allow setup and interrupted-setup recovery.
- **Supabase backend:** add the admin-authorized provisioning endpoint, invitation metadata/state, guarded completion operation, audit entries, and any RLS/trigger adjustments needed for correct manager provisioning. Preserve existing buyer and farmer registration behavior.
- **Mobile app:** no code changes. The manager uses the existing email/password login after web setup.

## Verification and acceptance criteria

- An active admin can create one pending Event Manager account and receive one link and matching QR. A non-admin cannot invoke the provisioning or regeneration endpoint.
- A buyer/farmer/admin email conflict creates no new Event Manager account. A repeated submit or retry does not create duplicate Auth users or profiles.
- Before the link is claimed, no manager workspace or manager RPC is accessible to that account. The new account has no unintended buyer privileges or buyer profile after successful provisioning.
- Claiming the link and setting a password activates only its intended account. The link cannot be used to claim a different account or silently convert an existing one.
- The manager can sign in with the same credentials on web and the unmodified mobile app. Separate sessions on separate devices behave normally.
- Expired, used, invalid, and regenerated links have honest, recoverable UI states. A failed provision never exposes a link.
- The QR decodes to exactly the displayed HTTPS URL. Test it with a phone camera and test the browser claim page at mobile width.
- Test interruption after token verification, after password update, and before activation; verify that the manager can finish setup without an admin manually editing database rows.
- Keep generated tokens, Supabase secret keys, and recipient passwords out of browser logs, analytics, database audit metadata, and error messages.

## Out of scope

- Opening the native app or signing it in directly from the invite link or QR.
- Passwordless sign-in after onboarding.
- Automatically emailing or messaging the invitation.
- Reassigning an existing buyer, farmer, or admin account to Event Manager.
- Building a general-purpose admin account management system or deleting accounts.

## Questions for review

1. Should **official email** and **municipality** be required at creation, or can the manager complete them after first sign-in? Municipality affects event and farmer matching, so it must be supplied before the manager can publish an event.
2. Is manual link/QR handoff enough for the first release, or should automatic email delivery be included?
3. Should the admin be able to regenerate a claim link after the account is already active, or should an active manager use password recovery instead? Recommended: recovery for active accounts; regeneration only while setup is incomplete.

## Rollout checklist

1. Apply `../CapstoneProject/supabase/migrations/20261107110000_admin_event_manager_invites.sql` to the Supabase project used by the web app. Apply all earlier pending migrations in order after reviewing them; two older migration files in that repository predate this feature.
2. Deploy `../CapstoneProject/supabase/functions/admin-event-manager-invites` with JWT verification enabled. Set `AGRIMARKET_WEB_ORIGIN` to the exact deployed HTTPS web origin. For local development, use the exact local web origin (for example `http://localhost:5173`).
3. Set `AGRIMARKET_INVITE_TTL_SECONDS` to the deployed project's Auth email OTP expiry. The checked-in local `supabase/config.toml` uses 600 seconds. The function defaults to 600 seconds, but the hosted Auth setting must be checked separately before showing an expiry to users.
4. Deploy the web app with the invitation route available at `/invite/accept`. The host must serve the SPA for that path. No native app release is needed.
5. In a non-production or approved test project, verify admin creation, non-admin denial, same-email retry, QR URL, first claim, regeneration, password setup, web and mobile email/password sign-in, and interrupted setup. Confirm the `invite` and `magiclink` token types work with the hosted project's Auth configuration before production use.

The current workspace has no linked Supabase project or network path available for a live deployment test. The new function and migration are local files until deployed.

## References

- Local web: `src/admin/AdminWorkspace.tsx`, `src/admin/components/UsersDirectory.tsx`, `src/auth/WebRoute.tsx`, `src/auth/web-role.ts`, `src/admin/supabase.ts`.
- Local backend/mobile: `../CapstoneProject/supabase/migrations/20260830174204_farmer_face_verification.sql`, `../CapstoneProject/supabase/migrations/20260908110000_event_manager_real_data.sql`, `../CapstoneProject/services/account-routing.ts`.
- Supabase: [Generate link](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [Verify OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp), [Auth admin and invites](https://supabase.com/docs/guides/auth/users), [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth), [Email template and link-prefetch guidance](https://supabase.com/docs/guides/auth/auth-email-templates).
