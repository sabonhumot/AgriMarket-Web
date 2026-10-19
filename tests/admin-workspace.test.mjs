import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const sidebarSource = readFileSync(fileURLToPath(new URL('../src/admin/components/AdminSidebar.tsx', import.meta.url)), 'utf8')
const boardSource = readFileSync(fileURLToPath(new URL('../src/admin/components/ReviewBoard.tsx', import.meta.url)), 'utf8')
const adminCss = readFileSync(fileURLToPath(new URL('../src/admin/AdminWorkspace.css', import.meta.url)), 'utf8')

const server = await createServer({
  root: projectRoot,
  appType: 'custom',
  plugins: [
    react(),
    {
      name: 'ssr-asset-stub',
      resolveId(id) {
        if (id.endsWith('.css') || id.endsWith('.jpg') || id.endsWith('.png') || id.endsWith('.svg')) {
          return '\0virtual:' + id
        }
      },
      load(id) {
        if (id.startsWith('\0virtual:')) return 'export default ""'
      },
    },
  ],
  server: { middlewareMode: true },
})

after(async () => {
  await server.close()
})

async function renderApp(initialPath) {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  return renderToStaticMarkup(createElement(App, { initialPath }))
}

async function renderWorkspace() {
  const { default: AdminWorkspace } = await server.ssrLoadModule('/src/admin/AdminWorkspace.tsx')
  return renderToStaticMarkup(createElement(AdminWorkspace))
}

test('keeps the public landing page at the root path', async () => {
  const html = await renderApp('/')

  assert.match(html, /Find local harvests\./)
  assert.doesNotMatch(html, /Platform overview/)
})

test('gates the administrator workspace at /admin', async () => {
  const html = await renderApp('/admin')

  assert.match(html, /Checking administrator access/)
  assert.doesNotMatch(html, /Platform overview/)
  assert.doesNotMatch(html, /Find local harvests\./)
})

test('renders live admin navigation while data is loading', async () => {
  const html = await renderWorkspace()

  assert.match(html, /aria-label="Administrator navigation"/)
  assert.match(html, /Users/)
  assert.match(html, /Events/)
  assert.doesNotMatch(html, /Event Applications|Farmer Approvals/)
  assert.match(html, /Reports/)
  assert.doesNotMatch(html, /Security &amp; access|Data loaded|Syncing data/)
  assert.match(html, /Loading database records/)
  assert.doesNotMatch(html, /Demo data|Buhisan Growers Circle|1,248/)
})

test('events page shows every status and has no event actions', async () => {
  const { default: EventsDirectory } = await server.ssrLoadModule('/src/admin/components/EventsDirectory.tsx')
  const base = { end_date: null, start_time: '08:00:00', end_time: '12:00:00', coordinator_user_id: 8, location: 'Cebu City', venue_name: 'Town Plaza', event_type: 'farmers_market', description: null }
  const events = [
    { ...base, market_event_id: 1, event_name: 'Harvest Day', event_date: '2026-10-20', status: 'published' },
    { ...base, market_event_id: 2, event_name: 'Community Market', event_date: '2026-10-22', status: 'draft' },
    { ...base, market_event_id: 3, event_name: 'Cancelled Market', event_date: '2026-10-23', status: 'cancelled' },
  ]
    const html = renderToStaticMarkup(createElement(EventsDirectory, { events, users: [{ id: 8, name: 'Event Manager' }], onOpen: () => {} }))
  assert.match(html, /Harvest Day/)
  assert.match(html, /Community Market/)
  assert.match(html, /Cancelled Market/)
  assert.match(html, /Town Plaza/)
  assert.match(html, /Event Manager/)
    assert.match(html, /View Harvest Day details/)
    assert.match(html, /Filter events by status/)
    assert.match(html, /All events/)
    assert.match(html, /Sort/)
    assert.ok(html.indexOf('Filter events by status') < html.indexOf('Search events'))
    assert.match(html, /class="users-view"/)
    assert.doesNotMatch(html, /All statuses/)
    assert.doesNotMatch(html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0] ?? '', /Edit|Delete|Approve/)
})

  test('event drawer shows event information without management actions', async () => {
    const { default: DetailDrawer } = await server.ssrLoadModule('/src/admin/components/DetailDrawer.tsx')
    const event = { market_event_id: 42, event_name: 'Harvest Day', status: 'published', event_date: '2026-10-20', end_date: '2026-10-21', start_time: '08:00:00', end_time: '12:00:00', coordinator_user_id: 8, location: 'Cebu City', venue_name: 'Town Plaza', event_type: 'farmers_market', description: 'Local harvests and growers.' }
    const html = renderToStaticMarkup(createElement(DetailDrawer, { target: { type: 'event', data: event, managerName: 'Event Manager' }, reports: [], onClose: () => {}, onReportResolved: async () => {}, onUserUpdated: async () => {}, onOpenReport: () => {} }))
    assert.match(html, /Event details/)
    assert.match(html, /Harvest Day/)
    assert.match(html, /Town Plaza/)
    assert.match(html, /Cebu City/)
    assert.match(html, /Event Manager/)
    assert.match(html, /Local harvests and growers/)
    assert.doesNotMatch(html, /Edit event|Delete event|Approve event/)
  })

test('report details show when screenshot evidence is attached', async () => {
  const { default: DetailDrawer } = await server.ssrLoadModule('/src/admin/components/DetailDrawer.tsx')
  const report = {
    id: 3, reportedUserId: 2, buyerId: 2, buyerWarningCount: 4, reporter: 'Ana Reyes', subject: 'Ben Cruz', reason: 'Missing crop', description: 'Reservation problem',
    evidencePath: 'farmer-1/report-3.png', status: 'open', outcome: null, caseDecision: null,
    decisionReason: null, decisionSeverity: null, createdAt: '2026-10-01T07:00:00Z',
  }
  const html = renderToStaticMarkup(createElement(DetailDrawer, { target: { type: 'report', data: report }, onClose: () => {}, onReportResolved: async () => {} }))
  assert.match(html, /Screenshot evidence/)
  assert.match(html, /Loading screenshot/)
  assert.doesNotMatch(html, /farmer-1\/report-3.png/)
  assert.match(html, /Resolve case/)
  assert.match(html, /Issue a warning to this buyer/)
  assert.match(html, /Suspension review needed/)
})

test('buyer details show report history and the appropriate account action', async () => {
  const { default: DetailDrawer } = await server.ssrLoadModule('/src/admin/components/DetailDrawer.tsx')
  const buyer = { id: 2, name: 'Ben Cruz', email: 'ben@example.test', role: 'buyer', status: 'active', createdAt: '2026-09-30T10:00:00Z', buyerWarningCount: 4, manualSuspensionReason: null, manuallySuspendedAt: null }
  const report = { id: 3, reportedUserId: 2, reason: 'Missed pickup', status: 'resolved', createdAt: '2026-10-01T07:00:00Z' }
  const props = { reports: [report], onClose: () => {}, onReportResolved: async () => {}, onUserUpdated: async () => {}, onOpenReport: () => {} }
  const active = renderToStaticMarkup(createElement(DetailDrawer, { ...props, target: { type: 'user', data: buyer } }))
  assert.match(active, /Reports about this user/)
  assert.match(active, /Case #3: Missed pickup/)
  assert.match(active, /Suspend buyer/)
  const belowThreshold = renderToStaticMarkup(createElement(DetailDrawer, { ...props, target: { type: 'user', data: { ...buyer, buyerWarningCount: 1 } } }))
  assert.match(belowThreshold, /Suspend buyer/)
  assert.match(belowThreshold, /Reason for suspension/)
  assert.doesNotMatch(belowThreshold, /Suspension is available after the fourth warning/)
  const suspended = renderToStaticMarkup(createElement(DetailDrawer, { ...props, target: { type: 'user', data: { ...buyer, status: 'suspended', manualSuspensionReason: 'Repeated missed pickups', manuallySuspendedAt: '2026-10-02T07:00:00Z' } } }))
  assert.match(suspended, /Reactivate buyer/)
  assert.match(suspended, /Repeated missed pickups/)
  const farmer = renderToStaticMarkup(createElement(DetailDrawer, { ...props, target: { type: 'user', data: { ...buyer, id: 75, name: 'Farmer Test', role: 'farmer', buyerWarningCount: 0 } } }))
  assert.match(farmer, /Suspend farmer/)
  assert.match(farmer, /Reason for suspension/)
  const admin = renderToStaticMarkup(createElement(DetailDrawer, { ...props, target: { type: 'user', data: { ...buyer, role: 'admin' } } }))
  assert.doesNotMatch(admin, /Suspend admin/)
})

test('does not show cached demo activity before the database responds', async () => {
  const html = await renderWorkspace()

  assert.doesNotMatch(html, /Repeated sign-in attempts|Cebu Fresh Cooperative/)
  assert.match(html, /Refresh data/)
})

test('renders focused user, organization, and activity views without removed pages', async () => {
  const { default: ManagementView } = await server.ssrLoadModule('/src/admin/components/ManagementView.tsx')
  const usersHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'users', query: '', onQueryChange: () => {}, onReset: () => {} }))
  const organizationsHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'organizations', query: '', onQueryChange: () => {}, onReset: () => {} }))
  const activityHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'activity', query: '', onQueryChange: () => {}, onReset: () => {} }))

  assert.match(usersHtml, /User oversight/)
  assert.match(usersHtml, /Demo users requiring administrator oversight/)
  assert.match(organizationsHtml, /Organization reviews/)
  assert.match(activityHtml, /Activity log/)
  assert.doesNotMatch(`${usersHtml}${organizationsHtml}${activityHtml}`, /Event management|Security &amp; access/)
})

test('provides status filters for oversight views', async () => {
  const { default: ManagementView } = await server.ssrLoadModule('/src/admin/components/ManagementView.tsx')
  const usersHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'users', query: '', onQueryChange: () => {}, onReset: () => {} }))

  assert.match(usersHtml, /Filter user status/)
  assert.match(usersHtml, /Restricted/)
})

test('groups reports and active market events in the dashboard operations row', async () => {
  const { default: DashboardOverview } = await server.ssrLoadModule('/src/admin/components/DashboardOverview.tsx')
  const data = { refreshedAt: '2026-10-18T08:00:00Z', users: [], totalUsers: 0, events: [], invitations: [], openReports: 0 }
  const html = renderToStaticMarkup(createElement(DashboardOverview, { data, reports: [], activity: [], onUsers: () => {}, onEvents: () => {}, onReports: () => {}, onActivity: () => {}, onReport: () => {} }))
  assert.match(html, /class="dashboard-operations"/)
  assert.ok(html.indexOf('reports-title') < html.indexOf('dashboard-events'))
  assert.doesNotMatch(html, /Pending admin actions|Admin follow-up/)
})

test('shows submitted application details and a reasoned decision form', async () => {
  const { default: OrganizationApplication } = await server.ssrLoadModule('/src/admin/components/OrganizationApplication.tsx')
  const html = renderToStaticMarkup(createElement(OrganizationApplication, {
    organization: {
      id: 'org-1', name: 'Buhisan Growers Circle', owner: 'Liza Mercado', type: 'Farm cooperative',
      status: 'Pending review', submitted: 'Today', location: 'Cebu City',
      contactEmail: 'liza@example.test', applicationSummary: 'Local vegetable growers',
      documents: ['Membership document'],
    },
    decisions: [],
    onDecision: () => {},
    onClose: () => {},
  }))

  assert.match(html, /Buhisan Growers Circle/)
  assert.match(html, /Membership document/)
  assert.match(html, /Cebu City/)
  assert.match(html, /Approve/)
  assert.match(html, /Request more details/)
  assert.match(html, /Reject/)
  assert.match(html, /Reason for decision/)
})

test('shows listing evidence, actions, and case history in the case detail', async () => {
  const { default: ListingCaseDetail } = await server.ssrLoadModule('/src/admin/components/ListingCaseDetail.tsx')
  const html = renderToStaticMarkup(createElement(ListingCaseDetail, {
    listingCase: {
      reportId: 'review-1', status: 'investigating', outcome: null, visibility: 'Visible',
      listingTitle: 'Fresh Bok Choy Bundle', farmer: 'Cebu Fresh Cooperative', location: 'Cebu City',
      price: '₱45 / bundle', availability: '24 bundles listed', reportedBy: 'Buyer report',
      reportReason: 'Possible duplicate listing', evidence: ['Matching pickup location'],
      relatedHistory: ['No prior reports'], events: [],
    },
    onAction: () => {}, onClose: () => {},
  }))

  assert.match(html, /Fresh Bok Choy Bundle/)
  assert.match(html, /Matching pickup location/)
  assert.match(html, /Internal note/)
  assert.match(html, /Keep listing/)
  assert.match(html, /Request correction/)
  assert.match(html, /Hide listing/)
  assert.match(html, /Remove listing/)
  assert.match(html, /Reason for action/)
})

test('shows case-specific facts and actions for non-listing reviews', async () => {
  const { default: GeneralReviewCaseDetail } = await server.ssrLoadModule('/src/admin/components/GeneralReviewCaseDetail.tsx')
  const { reviewItems, listingCases } = await server.ssrLoadModule('/src/admin/demo-data.ts')
  const expectations = [
    ['review-2', 'Application documents and checks', 'Request application details', 'Applicant organization'],
    ['review-3', 'Identity check evidence', 'Request a clearer document', 'Verification tier'],
    ['review-4', 'Security signals', 'Request security follow-up', 'Sign-in origin'],
    ['review-5', 'Authorization evidence', 'Request authorization details', 'Requested role'],
  ]

  for (const [id, evidence, action, fact] of expectations) {
    const reviewCase = listingCases.find((entry) => entry.reportId === id)
    const html = renderToStaticMarkup(createElement(GeneralReviewCaseDetail, {
      item: reviewItems.find((entry) => entry.id === id),
      reviewCase: { ...reviewCase, status: 'investigating' },
      onAction: () => {}, onClose: () => {},
    }))
    assert.match(html, new RegExp(evidence))
    assert.match(html, new RegExp(action))
    assert.match(html, new RegExp(fact))
    assert.doesNotMatch(html, /Hide listing|Remove listing|Keep listing/)
  }
})

test('provides responsive admin navigation and prevents closed-drawer focus leaks', () => {
  assert.match(boardSource, /Show review status/)
  assert.doesNotMatch(boardSource, /role="tab"/)
  assert.match(adminCss, /\.admin-sidebar:not\(\.is-open\)\s*\{\s*visibility:\s*hidden;/)
  assert.match(adminCss, /\.admin-menu-button\s*\{[^}]*display:\s*inline-flex;/s)
  assert.match(adminCss, /@media \(max-width: 960px\)/)
})
