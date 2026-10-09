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
  assert.match(html, /Applications/)
  assert.match(html, /Reports/)
  assert.match(html, /Security &amp; access/)
  assert.match(html, /Loading database records/)
  assert.doesNotMatch(html, /Demo data|Buhisan Growers Circle|1,248/)
})

test('does not show cached demo activity before the database responds', async () => {
  const html = await renderWorkspace()

  assert.doesNotMatch(html, /Repeated sign-in attempts|Cebu Fresh Cooperative/)
  assert.match(html, /Refresh data/)
})

test('renders focused user, organization, security, and activity views without event management', async () => {
  const { default: ManagementView } = await server.ssrLoadModule('/src/admin/components/ManagementView.tsx')
  const usersHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'users', query: '', onQueryChange: () => {}, onReset: () => {} }))
  const organizationsHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'organizations', query: '', onQueryChange: () => {}, onReset: () => {} }))
  const securityHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'security', query: '', onQueryChange: () => {}, onReset: () => {} }))
  const activityHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'activity', query: '', onQueryChange: () => {}, onReset: () => {} }))

  assert.match(usersHtml, /User oversight/)
  assert.match(usersHtml, /Demo users requiring administrator oversight/)
  assert.match(organizationsHtml, /Organization reviews/)
  assert.match(securityHtml, /Security &amp; access/)
  assert.match(activityHtml, /Activity log/)
  assert.doesNotMatch(`${usersHtml}${organizationsHtml}${securityHtml}${activityHtml}`, /Event management/)
})

test('provides status and severity filters for oversight views', async () => {
  const { default: ManagementView } = await server.ssrLoadModule('/src/admin/components/ManagementView.tsx')
  const usersHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'users', query: '', onQueryChange: () => {}, onReset: () => {} }))
  const securityHtml = renderToStaticMarkup(createElement(ManagementView, { view: 'security', query: '', onQueryChange: () => {}, onReset: () => {} }))

  assert.match(usersHtml, /Filter user status/)
  assert.match(usersHtml, /Restricted/)
  assert.match(securityHtml, /Filter severity/)
  assert.match(securityHtml, /High/)
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
