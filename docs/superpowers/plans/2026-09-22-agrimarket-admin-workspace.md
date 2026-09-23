# AgriMarket administrator workspace implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate `/admin` front-end workspace for AgriMarket platform administrators, with local demo data for oversight, moderation, and security work.

**Architecture:** Keep the public landing page as the default `App` rendering and select `AdminWorkspace` when the browser path is `/admin`. The admin feature owns typed demo records, local filtering and status state, and focused presentational components; it deliberately makes no API, authentication, or persistent data calls.

**Tech Stack:** React 19, TypeScript 6, Vite 8, CSS, Node test runner, React SSR test rendering.

**Spec:** `docs/superpowers/specs/2026-09-22-agrimarket-admin-workspace-design.md`

## Global Constraints

- Preserve the existing public AgriMarket landing page as the default route.
- Render the administrator prototype only at `/admin`; do not expose it in the public navigation.
- Event management is out of scope because it belongs to the separate event-manager role.
- Use typed, visibly labeled in-memory demo data only; do not imply backend persistence, authentication, or real account actions.
- Do not add packages unless the existing React/Vite stack makes a requirement impossible.
- Keep AgriMarket’s green, cream, mist, sun, and coral visual tokens and original identity; use the reference only for its compact sidebar, shared controls, and status-board patterns.
- Support keyboard operation, visible focus, 44px targets, semantic labels, readable contrast, and reduced motion.
- Support 375px, 768px, and 1440px without page-level horizontal overflow.

## Review Focus

- Direct `/admin` path rendering must not replace landing-page output at `/` or interfere with SSR tests.
- Queries containing punctuation, mixed case, or no matches must safely filter board and management records and offer a reset.
- A status update must change only the selected review item and announce local/demo success without implying a backend write.
- Narrow viewports must constrain any wide board/table to its own scroll region rather than hiding page-level overflow.
- Long person, organization, and report strings must wrap or truncate inside their card/table cells without breaking the layout.

---

## File structure

- `src/App.tsx` — selects the public landing page or administrator workspace from the current path while retaining existing landing behavior.
- `src/admin/types.ts` — declares shared view, record, status, severity, and filter types.
- `src/admin/demo-data.ts` — exports original typed sample records and summary metadata marked for demo use.
- `src/admin/AdminWorkspace.tsx` — owns local UI state, derives filtered records, and composes admin views.
- `src/admin/AdminWorkspace.css` — scopes the responsive admin layout and component styles under `.admin-shell`.
- `src/admin/components/AdminSidebar.tsx` — accessible admin navigation and compact/mobile navigation control.
- `src/admin/components/ReviewBoard.tsx` — filter controls, status columns, review cards, empty state, and local status controls.
- `src/admin/components/ManagementView.tsx` — searchable users, organizations, security, and activity views using semantic tables/lists.
- `tests/admin-workspace.test.mjs` — SSR/render and source-level tests for routing, labels, demo disclosure, and board structure.
- `tests/admin-interactions.test.mjs` — unit tests for filtering and immutable local review-status transitions exported from the admin feature.

### Task 1: Define typed demo records and testable state helpers

**Files:**
- Create: `src/admin/types.ts`
- Create: `src/admin/demo-data.ts`
- Create: `src/admin/admin-state.ts`
- Test: `tests/admin-interactions.test.mjs`

**Interfaces:**
- Produces: `AdminView`, `ReviewStatus`, `ReviewItem`, `UserRecord`, `OrganizationRecord`, `SecurityEvent`, and `ActivityEntry` from `src/admin/types.ts`.
- Produces: `reviewItems`, `users`, `organizations`, `securityEvents`, and `activityEntries` from `src/admin/demo-data.ts`.
- Produces: `matchesQuery<T extends SearchableRecord>(record: T, query: string): boolean` and `updateReviewStatus(items: ReviewItem[], id: string, status: ReviewStatus): ReviewItem[]` from `src/admin/admin-state.ts`.

- [ ] **Step 1: Write the failing state-helper tests**

```js
test('filters case-insensitively across review title, subject, and type', async () => {
  const { matchesQuery } = await server.ssrLoadModule('/src/admin/admin-state.ts')
  const record = { title: 'Duplicate bok choy listing', subject: 'Cebu Fresh Cooperative', type: 'Listing report' }

  assert.equal(matchesQuery(record, 'COOPERATIVE'), true)
  assert.equal(matchesQuery(record, 'bok-choy'), false)
  assert.equal(matchesQuery(record, ''), true)
})

test('moves only the selected review item without mutating the source list', async () => {
  const { updateReviewStatus } = await server.ssrLoadModule('/src/admin/admin-state.ts')
  const source = [
    { id: 'review-1', status: 'needs-review' },
    { id: 'review-2', status: 'investigating' },
  ]
  const updated = updateReviewStatus(source, 'review-1', 'resolved')

  assert.equal(updated[0].status, 'resolved')
  assert.equal(updated[1].status, 'investigating')
  assert.equal(source[0].status, 'needs-review')
  assert.notEqual(updated, source)
})
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --test tests/admin-interactions.test.mjs`

Expected: FAIL because the `/src/admin/admin-state.ts` module does not exist.

- [ ] **Step 3: Add explicit domain types and original demo records**

```ts
export type AdminView = 'overview' | 'users' | 'organizations' | 'moderation' | 'security' | 'activity'
export type ReviewStatus = 'needs-review' | 'investigating' | 'resolved'

export type ReviewItem = {
  id: string
  type: 'Listing report' | 'User verification' | 'Organization approval' | 'Access request' | 'Security alert'
  title: string
  subject: string
  status: ReviewStatus
  priority: 'high' | 'medium' | 'low'
  createdLabel: string
}
```

Create six or more records spanning all three review states. Give each data module an exported `demoDataLabel = 'Demo data — local prototype only'` string for reusable disclosure.

- [ ] **Step 4: Implement pure filtering and immutable transition helpers**

```ts
export type SearchableRecord = Record<'title' | 'subject' | 'type', string>

export function matchesQuery(record: SearchableRecord, query: string) {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return true
  return [record.title, record.subject, record.type]
    .some((value) => value.toLocaleLowerCase().includes(normalized))
}

export function updateReviewStatus(items: ReviewItem[], id: string, status: ReviewStatus) {
  return items.map((item) => item.id === id ? { ...item, status } : item)
}
```

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `node --test tests/admin-interactions.test.mjs`

Expected: PASS with two passing tests.

- [ ] **Step 6: Checkpoint changes**

This workspace has no `.git` directory, so no commit can be created. Record the passing command and changed files in the implementation handoff instead.

### Task 2: Add route selection without changing the public landing experience

**Files:**
- Modify: `src/App.tsx`
- Create: `src/admin/AdminWorkspace.tsx`
- Test: `tests/admin-workspace.test.mjs`

**Interfaces:**
- Consumes: `AdminWorkspace` default export from `src/admin/AdminWorkspace.tsx`.
- Produces: `App({ initialPath?: string }): ReactElement`, where `initialPath` enables deterministic SSR rendering in tests and browser rendering observes `window.location.pathname`.

- [ ] **Step 1: Write failing route-render tests**

```js
async function renderApp(initialPath) {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  return renderToStaticMarkup(createElement(App, { initialPath }))
}

test('keeps the public landing page at the root path', async () => {
  const html = await renderApp('/')
  assert.match(html, /Find local harvests\./)
  assert.doesNotMatch(html, /Platform overview/)
})

test('renders the administrator workspace only at /admin', async () => {
  const html = await renderApp('/admin')
  assert.match(html, /Platform overview/)
  assert.match(html, /Demo data — local prototype only/)
  assert.doesNotMatch(html, /Find local harvests\./)
})
```

- [ ] **Step 2: Run the route test to verify it fails**

Run: `node --test tests/admin-workspace.test.mjs`

Expected: FAIL because `App` does not accept `initialPath` and no administrator workspace exists.

- [ ] **Step 3: Implement the path-aware shell**

Add the workspace import and make the existing landing markup a `LandingPage` function. Keep the current default `App` export and select the page with a safe server fallback:

```tsx
function currentPathname() {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

export default function App({ initialPath }: { initialPath?: string }) {
  const path = initialPath ?? currentPathname()
  if (path === '/admin') return <AdminWorkspace />
  return <LandingPage />
}
```

Use standard anchor navigation for the internal `Back to public site` link, so direct access and browser refresh do not depend on a client router. Do not add an admin link to `NavigationLinks`.

- [ ] **Step 4: Implement the minimum workspace shell**

```tsx
export default function AdminWorkspace() {
  return (
    <main className="admin-shell" aria-labelledby="admin-page-title">
      <p className="admin-demo-label">Demo data — local prototype only</p>
      <h1 id="admin-page-title">Platform overview</h1>
    </main>
  )
}
```

- [ ] **Step 5: Run route and existing landing tests**

Run: `node --test tests/admin-workspace.test.mjs tests/design-refresh.test.mjs`

Expected: PASS; root-route landing assertions remain valid and `/admin` contains only the workspace shell.

- [ ] **Step 6: Checkpoint changes**

This workspace has no `.git` directory, so no commit can be created. Record the passing command and changed files in the implementation handoff instead.

### Task 3: Build accessible sidebar, overview, and moderation review board

**Files:**
- Create: `src/admin/components/AdminSidebar.tsx`
- Create: `src/admin/components/ReviewBoard.tsx`
- Modify: `src/admin/AdminWorkspace.tsx`
- Modify: `src/admin/AdminWorkspace.css`
- Modify: `tests/admin-workspace.test.mjs`

**Interfaces:**
- Consumes: `AdminView`, `ReviewItem`, and `ReviewStatus` from `src/admin/types.ts`; `matchesQuery` and `updateReviewStatus` from `src/admin/admin-state.ts`; typed records from `src/admin/demo-data.ts`.
- Produces: `AdminSidebar({ activeView, onViewChange })` and `ReviewBoard({ items, query, onQueryChange, onStatusChange, onReset })`.

- [ ] **Step 1: Add failing overview-board rendering assertions**

```js
test('renders labelled admin navigation and the three review states', async () => {
  const html = await renderApp('/admin')

  assert.match(html, /aria-label="Administrator navigation"/)
  assert.match(html, /Users/)
  assert.match(html, /Organizations/)
  assert.match(html, /Moderation/)
  assert.match(html, /Security &amp; access/)
  assert.match(html, /Needs review/)
  assert.match(html, /Investigating/)
  assert.match(html, /Resolved/)
  assert.match(html, /Search review queue/)
})
```

- [ ] **Step 2: Run the board assertion to verify it fails**

Run: `node --test tests/admin-workspace.test.mjs`

Expected: FAIL because the shell has no navigation or review columns.

- [ ] **Step 3: Implement navigation and overview state composition**

In `AdminWorkspace`, initialize `activeView` to `'overview'`, `query` to `''`, `reviewItemsState` to the imported immutable seed data, and `notice` to `null`. Use `<button aria-current={isActive ? 'page' : undefined}>` for sidebar options and a 44px mobile menu button with `aria-expanded`/`aria-controls`.

Render four metric cards with the `demoDataLabel` displayed in the overview header, using concrete labels: Active users, Organization reviews, Open reports, and Access alerts. Keep metrics as labels with counts only; do not describe them as live measurements.

- [ ] **Step 4: Implement the review board and explicit status changes**

```tsx
const columns: Array<{ status: ReviewStatus; label: string }> = [
  { status: 'needs-review', label: 'Needs review' },
  { status: 'investigating', label: 'Investigating' },
  { status: 'resolved', label: 'Resolved' },
]

<label className="admin-search">
  <span className="sr-only">Search review queue</span>
  <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search reviews" />
</label>
```

Place the columns inside a labelled `section` and map only filtered items to their matching status. Each review card includes textual type/priority/state labels and a `<select aria-label={`Change status for ${item.title}`}>` that calls `onStatusChange(item.id, nextStatus)`. After a state update, set a `role="status"` message that says `Demo review status updated locally.`

When no filtered cards exist, render `No demo reviews match this search.` and a 44px `Reset filters` button that invokes `onReset`.

- [ ] **Step 5: Add scoped responsive styles**

Build the grid under `.admin-shell`; do not alter existing landing selectors. At desktop use `grid-template-columns: 248px minmax(0, 1fr)`. At 768px collapse the sidebar to a controlled drawer/rail and put `.review-board-columns { overflow-x: auto; }` around the three 280px minimum columns. At 540px use the selected status as an accessible tab/selector and show one column, stack metrics, and keep controls at least 44px tall. Add `overflow-wrap: anywhere` to user-supplied-looking card title/subject fields rather than clipping them.

- [ ] **Step 6: Run feature, landing, and style tests**

Run: `node --test tests/admin-workspace.test.mjs tests/admin-interactions.test.mjs tests/design-refresh.test.mjs tests/apk-landing.test.mjs tests/horizontal-scroll.test.mjs`

Expected: PASS; test output confirms sidebar, demo disclosure, board labels, and existing landing expectations.

- [ ] **Step 7: Checkpoint changes**

This workspace has no `.git` directory, so no commit can be created. Record the passing command and changed files in the implementation handoff instead.

### Task 4: Add focused management views and local empty/disabled states

**Files:**
- Create: `src/admin/components/ManagementView.tsx`
- Modify: `src/admin/AdminWorkspace.tsx`
- Modify: `src/admin/AdminWorkspace.css`
- Modify: `tests/admin-workspace.test.mjs`

**Interfaces:**
- Consumes: `AdminView`, `UserRecord`, `OrganizationRecord`, `SecurityEvent`, `ActivityEntry`, and `matchesQuery`.
- Produces: `ManagementView({ view, query, onQueryChange, onReset })`, rendering a labelled users/organizations table or a semantic security/activity list.

- [ ] **Step 1: Add failing view-level tests**

```js
test('keeps event management out of the administrator navigation and exposes oversight views', async () => {
  const html = await renderApp('/admin')

  assert.match(html, /User oversight/)
  assert.match(html, /Organization reviews/)
  assert.match(html, /Security &amp; access/)
  assert.match(html, /Activity log/)
  assert.doesNotMatch(html, /Event management/)
})
```

Add a source-level assertion that the stylesheet includes the 768px and 540px admin breakpoints and does not apply `overflow-x: hidden` or `overflow-x: clip` to `.admin-shell`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/admin-workspace.test.mjs`

Expected: FAIL because those focused view labels and responsive styles have not been added.

- [ ] **Step 3: Implement user and organization views with semantic tables**

Use a `<table>` with `<caption className="sr-only">Demo users requiring administrator oversight</caption>` and labelled columns for user/organization, role/type, status, and last activity/review state. Use `matchesQuery` after adapting each row to its searchable fields. Render responsive cards from the same data at small widths if the table cannot remain legible; do not duplicate state.

- [ ] **Step 4: Implement security and activity views with meaningful local controls**

Render security events as an ordered or unordered list with text severity labels and timestamps. Render the activity log chronologically. In each view, filter by the shared query and show the same resettable empty state. A detail button may set `selectedRecordId` and open a labelled local detail panel; disable it with `disabled` and explanatory text when no compatible record exists. Do not add buttons that resemble real approval, suspension, or deletion actions.

- [ ] **Step 5: Wire active sidebar view to the relevant panel**

Give each selection a focused `h1`/`h2` title—`Platform overview`, `User oversight`, `Organization reviews`, `Moderation queue`, `Security & access`, or `Activity log`—and shift focus to the title after a button-based view switch. Preserve the review board for both Overview and Moderation, with the full queue context on Moderation.

- [ ] **Step 6: Run the complete automated verification**

Run each command separately:

```text
npm run lint
npm run build
npm test
```

Expected: exit code 0 for every command. The Vite production build completes and every Node test passes.

- [ ] **Step 7: Perform responsive and keyboard browser verification**

Run: `npm run dev -- --host 127.0.0.1`

Open `/admin` at 1440px, 768px, and 375px. Confirm the public page remains at `/`; sidebar/menu navigation works with keyboard; every review status control is usable without a mouse; an unmatched query presents resettable empty state; a status change produces the local-demo message; and no page-level horizontal scrollbar appears.

- [ ] **Step 8: Checkpoint changes**

This workspace has no `.git` directory, so no commit can be created. Record the verification results and changed files in the implementation handoff instead.

## Plan self-review

- **Spec coverage:** Tasks 1–4 cover the route, admin-only scope, typed demo data, overview, sidebar, review board, management views, responsiveness, accessibility, empty/success/disabled states, and validation requirements. The planned `/admin` browser check covers direct navigation.
- **Placeholder scan:** No unresolved placeholders or unspecified code steps remain.
- **Type consistency:** All later components consume the `AdminView`, `ReviewItem`, `ReviewStatus`, data exports, and helper functions defined in Task 1.
- **Review focus coverage:** Route isolation is tested in Task 2; unusual/no-match queries and immutable status updates in Task 1; status feedback and responsive contained scroll in Task 3; long-content layout and management-view constraints in Task 4.
