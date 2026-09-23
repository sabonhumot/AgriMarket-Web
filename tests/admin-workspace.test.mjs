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

test('keeps recent activity and security signals visible on the platform overview', async () => {
  const html = await renderApp('/admin')

  assert.match(html, /Security snapshot/)
  assert.match(html, /Recent activity/)
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

test('uses a native mobile status selector and prevents closed-drawer focus leaks', () => {
  assert.match(boardSource, /Show review status/)
  assert.doesNotMatch(boardSource, /role="tab"/)
  assert.match(adminCss, /admin-sidebar:not\(\.is-open\).*visibility:hidden/s)
  assert.match(adminCss, /\.review-card select\{[^}]*min-height:44px/s)
  assert.match(adminCss, /@media \(max-width:1180px\)/)
})
