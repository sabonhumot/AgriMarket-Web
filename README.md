# AgriMarket Web

The web app includes the public AgriMarket site, an administrator workspace, and an Event Manager overview.

## Run locally

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the same Supabase project used by the mobile app. `VITE_APK_DOWNLOAD_URL` enables the public APK download control when a verified URL is available.

## Web workspaces

- `/login` is the single sign-in page for active administrator and Event Manager accounts.
- `/admin` is the administrator workspace.
- `/event-manager` is the Event Manager overview. It reads the current manager's live `get_event_manager_dashboard` data and shows the next market day, event counts, approved farmers, and pending applications. Event creation, application decisions, check-in, and reports are planned for later web releases.

The app routes each signed-in web account to its own workspace. Event Manager accounts use the database role `coordinator`; other roles cannot enter these workspaces.

## Checks

```sh
npm test
npm run build
npm run lint
```
