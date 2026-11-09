import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ appType: 'custom', server: { middlewareMode: true } })
after(() => server.close())
const { registrationDays, activeEvents, loadDashboardData } = await server.ssrLoadModule('/src/admin/dashboard-data.ts')

test('registrations use Philippine calendar days and exclude future timestamps', () => {
  const now = Date.parse('2026-10-07T01:00:00Z')
  const result = registrationDays([
    { created_at: '2026-10-06T15:59:59Z' },
    { created_at: '2026-10-06T16:00:00Z' },
    { created_at: '2026-10-07T02:00:00Z' },
    { created_at: 'invalid' },
  ], 7, now)
  assert.equal(result.length, 7)
  assert.deepEqual(result.at(-1), { date: '2026-10-07', count: 1 })
  assert.deepEqual(result.at(-2), { date: '2026-10-06', count: 1 })
})

test('active events exclude drafts and ended events; multi-day dates take precedence', () => {
  const now = Date.parse('2026-10-07T05:00:00Z')
  const source = { event_date: '2026-10-06', end_date: '2026-10-07', end_time: '14:00:00', status: 'published' }
  assert.equal(activeEvents([source], now).length, 1)
  assert.equal(activeEvents([{ ...source, status: 'draft' }], now).length, 0)
  assert.equal(activeEvents([{ ...source, end_time: '12:59:59' }], now).length, 0)
})

test('dashboard statistics page past row caps and use an exact report count', async () => {
  const source = Array.from({ length: 1201 }, (_, user_id) => ({ user_id, role: 'buyer', user_status: 'active', created_at: '2026-10-01T00:00:00Z' }))
  const event = { market_event_id: 42, event_name: 'Harvest Day', cover_photo_path: 'manager-8/events/42/cover.jpg' }
  const pages = []
  const client = { from(table) { return { select() { return {
    order() { return { async range(start, end) {
      const rows = table === 'users' ? source : table === 'market_events' ? [event] : []
      if (table === 'users') pages.push(start)
      return { data: rows.slice(start, end + 1), count: rows.length, error: null }
    } } },
    async not() { return { count: 1502, error: null } },
  } } } }, storage: { from(bucket) {
    assert.equal(bucket, 'event-manager-media')
    return { getPublicUrl: path => ({ data: { publicUrl: `https://example.test/${path}` } }) }
  } } }
  const result = await loadDashboardData(client)
  assert.deepEqual(pages, [0, 500, 1000])
  assert.equal(result.totalUsers, 1201)
  assert.equal(result.users.length, 1201)
  assert.equal(result.events[0].coverPhotoUrl, 'https://example.test/manager-8/events/42/cover.jpg')
  assert.equal(result.openReports, 1502)
})
