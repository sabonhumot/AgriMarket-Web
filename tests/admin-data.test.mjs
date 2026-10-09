import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({ root, appType: 'custom', server: { middlewareMode: true } })
after(() => server.close())

test('admin data comes from the shared tables and maps real statuses', async () => {
  const { loadAdminData } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const rows = {
    users: [{ user_id: 1, first_name: 'Ana', last_name: 'Reyes', email: 'ana@example.test', role: 'farmer', user_status: 'active', created_at: '2026-09-30T10:00:00Z' }],
    admin_list_farmer_verifications: [{ verification_id: 7, user_id: 1, review_status: 'pending', processing_status: 'completed', submitted_at: '2026-10-01T08:00:00Z', review_notes: null }],
    market_event_applications: [{ application_id: 9, farmer_id: 1, market_event_id: 4, status: 'pending', created_at: '2026-10-01T09:00:00Z', rejection_reason: null }],
    market_events: [{ market_event_id: 4, event_name: 'Saturday Market' }],
    reservation_reports: [{ report_id: 3, reporter_id: 1, reported_user_id: 1, reason: 'Missing crop', reporter_description: 'Reservation problem', status: 'open', resolution_outcome: null, created_at: '2026-10-01T07:00:00Z' }],
    system_logs: [{ system_log_id: 5, actor_id: 1, action: 'event.published', entity_type: 'market_event', entity_id: 4, created_at: '2026-10-01T06:00:00Z' }],
    farmer_profiles: [],
  }
  const requested = []
  const client = { rpc(name) {
    requested.push(name)
    return Promise.resolve({ data: rows[name], error: null })
  }, from(table) {
    requested.push(table)
    return { select: async () => ({ data: rows[table], error: null }) }
  } }

  const result = await loadAdminData(client)
  assert.deepEqual(requested.sort(), Object.keys(rows).sort())
  assert.equal(result.users[0].name, 'Ana Reyes')
  assert.equal(result.applications.length, 2)
  assert.equal(result.applications.find((item) => item.kind === 'Event application').title, 'Saturday Market')
  assert.equal(result.reports[0].reason, 'Missing crop')
  assert.equal(result.activity[0].action, 'event.published')
})

test('admin data fails closed when any protected query fails', async () => {
  const { loadAdminData } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const client = { from(table) {
    return { select: async () => table === 'system_logs'
      ? { data: null, error: new Error('permission denied') }
      : { data: [], error: null } }
  }, rpc: async () => ({ data: [], error: null }) }
  await assert.rejects(loadAdminData(client), /permission denied/)
})
