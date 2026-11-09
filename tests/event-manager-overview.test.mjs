import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({ root, appType: 'custom', plugins: [react(), {
  name: 'ssr-asset-stub',
  resolveId(id) { if (/\.(css|jpg|png|svg)$/.test(id)) return '\0virtual:' + id },
  load(id) { if (id.startsWith('\0virtual:')) return 'export default ""' },
}], server: { middlewareMode: true } })
after(() => server.close())

test('dashboard RPC maps organization, counts, and events', async () => {
  const { loadEventManagerDashboard } = await server.ssrLoadModule('/src/event-manager/dashboard-data.ts')
  const client = { rpc: async (name) => {
    assert.equal(name, 'get_event_manager_dashboard')
    return { data: {
      profile: { profile: { organization_name: 'Cebu Growers' }, analytics: { total_events: 7 } },
      upcoming_event_count: 2,
      pending_application_count: 3,
      approved_farmer_count: 12,
      events: [{ id: 4, name: 'Saturday Harvest', date: '2026-10-24', start_time: '06:00:00', end_time: '12:00:00', location: 'Cebu City', status: 'upcoming', approved_farmers: 8, farmer_count: 15, cover_photo_path: 'manager/events/4/cover.jpg' }],
    }, error: null }
  } }
  const result = await loadEventManagerDashboard(client)
  assert.equal(result.organizationName, 'Cebu Growers')
  assert.equal(result.activeCount, 2)
  assert.equal(result.pendingApplications, 3)
  assert.equal(result.expectedFarmers, 12)
  assert.equal(result.completedCount, 7)
  assert.equal(result.events[0].name, 'Saturday Harvest')
  assert.equal(result.events[0].time, '6:00 AM–12:00 PM')
  assert.equal(result.events[0].coverPhotoPath, 'manager/events/4/cover.jpg')
})

test('dashboard RPC keeps an empty event list and propagates errors', async () => {
  const { loadEventManagerDashboard } = await server.ssrLoadModule('/src/event-manager/dashboard-data.ts')
  const empty = await loadEventManagerDashboard({ rpc: async () => ({ data: {}, error: null }) })
  assert.deepEqual(empty.events, [])
  assert.equal(empty.activeCount, 0)
  await assert.rejects(loadEventManagerDashboard({ rpc: async () => ({ data: null, error: new Error('offline') }) }), /offline/)
})

test('dashboard shows its controls and a truthful no-event state', async () => {
  const { default: Overview } = await server.ssrLoadModule('/src/event-manager/EventManagerOverview.tsx')
  const data = { organizationName: 'Cebu Growers', activeCount: 0, expectedFarmers: 0, completedCount: 0, pendingApplications: 0, unreadNotifications: 0, events: [] }
  const html = renderToStaticMarkup(createElement(Overview, { initialData: data, onSignOut: async () => {} }))
  assert.match(html, /<h1>Dashboard<\/h1>/)
  assert.match(html, /Create event/)
  assert.match(html, /No upcoming events/)
  assert.match(html, /You are up to date with applications and notifications/)
})

test('dashboard leads with the next event and review counts', async () => {
  const { default: Overview } = await server.ssrLoadModule('/src/event-manager/EventManagerOverview.tsx')
  const data = { organizationName: 'Cebu Growers', activeCount: 2, expectedFarmers: 12, completedCount: 7, pendingApplications: 3, unreadNotifications: 2, events: [
    { id: '4', name: 'Saturday Harvest', date: '2099-10-24', endDate: null, time: '06:00 AM', location: 'Cebu City', status: 'upcoming', approvedFarmers: 8, farmerCount: 15, pendingApplications: 3 },
    { id: '5', name: 'Sunday Market', date: '2099-10-25', endDate: null, time: '07:00 AM', location: 'Mandaue', status: 'upcoming', approvedFarmers: 4, farmerCount: 8, pendingApplications: 0 },
  ] }
  const html = renderToStaticMarkup(createElement(Overview, { initialData: data, onSignOut: async () => {} }))
  assert.ok(html.indexOf('em-dashboard-stats') < html.indexOf('em-dashboard-lead'))
  assert.match(html, /Next market day/)
  assert.match(html, /Saturday Harvest/)
  assert.match(html, /3 awaiting review/)
  assert.match(html, /Coming up after that/)
  assert.match(html, /Sunday Market/)
})
