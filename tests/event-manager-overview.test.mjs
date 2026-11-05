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
      events: [{ id: 4, name: 'Saturday Harvest', date: '2026-10-24', time: '06:00 AM - 12:00 PM', location: 'Cebu City', status: 'upcoming', approved_farmers: 8, farmer_count: 15 }],
    }, error: null }
  } }
  const result = await loadEventManagerDashboard(client)
  assert.equal(result.organizationName, 'Cebu Growers')
  assert.equal(result.activeCount, 2)
  assert.equal(result.pendingApplications, 3)
  assert.equal(result.expectedFarmers, 12)
  assert.equal(result.completedCount, 7)
  assert.equal(result.events[0].name, 'Saturday Harvest')
})

test('dashboard RPC keeps an empty event list and propagates errors', async () => {
  const { loadEventManagerDashboard } = await server.ssrLoadModule('/src/event-manager/dashboard-data.ts')
  const empty = await loadEventManagerDashboard({ rpc: async () => ({ data: {}, error: null }) })
  assert.deepEqual(empty.events, [])
  assert.equal(empty.activeCount, 0)
  await assert.rejects(loadEventManagerDashboard({ rpc: async () => ({ data: null, error: new Error('offline') }) }), /offline/)
})

test('overview shows its dashboard content and truthful no-event state', async () => {
  const { default: Overview } = await server.ssrLoadModule('/src/event-manager/EventManagerOverview.tsx')
  const data = { organizationName: 'Cebu Growers', activeCount: 0, expectedFarmers: 0, completedCount: 0, pendingApplications: 0, events: [] }
  const html = renderToStaticMarkup(createElement(Overview, { initialData: data, onSignOut: async () => {} }))
  assert.match(html.replace(/<[^>]*>/g, ''), /Market Day Overview/)
  assert.match(html, /Cebu Growers/)
  assert.match(html, /No active events yet/)
  assert.doesNotMatch(html, /Create New Event|Scan Farmer ID/)
})
