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

test('notification RPCs map unread event references and use manager-scoped methods', async () => {
  const service = await server.ssrLoadModule('/src/event-manager/manager-service.ts')
  const calls = []
  const client = { rpc: async (name, args) => {
    calls.push([name, args])
    return { data: name === 'get_event_manager_notifications' ? [{ notification_id: 7, title: 'Application', body: 'Review this farmer', reference_id: 42, reference_type: 'market_event', is_read: false, created_at: '2026-11-05T08:00:00+08:00' }] : null, error: null }
  } }
  const items = await service.loadManagerNotifications(client)
  assert.equal(items[0].referenceId, 42)
  assert.equal(items[0].isRead, false)
  await service.markManagerNotificationRead(client, 7)
  await service.markAllManagerNotificationsRead(client)
  assert.deepEqual(calls.map(([name]) => name), ['get_event_manager_notifications', 'mark_event_manager_notification_read', 'mark_all_event_manager_notifications_read'])
  assert.deepEqual(calls[1][1], { p_notification_id: 7 })
})

test('profile save preserves logo and sends organization, contact, and address fields', async () => {
  const service = await server.ssrLoadModule('/src/event-manager/manager-service.ts')
  let payload
  const response = { profile: { organization_name: 'Cebu Growers', organization_type: 'organization', organization_logo_path: 'owner/organization/logo.jpg', official_email: 'office@example.org' }, user: { email: 'login@example.org' }, office_address: { city: 'Cebu City' } }
  const client = { rpc: async (name, args) => { assert.equal(name, 'upsert_event_manager_profile'); payload = args.p_input; return { data: response, error: null } } }
  const input = { ...service.mapManagerProfile(response), contactName: 'Maria', street: 'Main Street', barangay: 'Central' }
  const saved = await service.saveManagerProfile(client, input)
  assert.equal(payload.organization_logo_path, 'owner/organization/logo.jpg')
  assert.equal(payload.point_of_contact_name, 'Maria')
  assert.equal(payload.street, 'Main Street')
  assert.equal(saved.accountEmail, 'login@example.org')
})

test('farmer directory queries the existing RPC and maps verified summary', async () => {
  const service = await server.ssrLoadModule('/src/event-manager/manager-service.ts')
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'get_event_manager_farmer_directory')
    assert.deepEqual(args, { p_query: 'Ana' })
    return { data: [{ id: 5, name: 'Ana Cruz', farm_name: 'Cruz Greens', profile_photo_path: 'farmer/profile/photo.jpg', verified: true, active_listings: 3, total_transactions: 12 }], error: null }
  } }
  const farmers = await service.loadManagerFarmers(client, ' Ana ')
  assert.deepEqual(farmers.map(({ name, verified, activeListings, totalTransactions }) => ({ name, verified, activeListings, totalTransactions })), [{ name: 'Ana Cruz', verified: true, activeListings: 3, totalTransactions: 12 }])
  assert.equal(farmers[0].profilePhotoPath, 'farmer/profile/photo.jpg')
})

test('notification view exposes unread actions and the referenced event', async () => {
  const { default: Notifications } = await server.ssrLoadModule('/src/event-manager/EventManagerNotifications.tsx')
  const html = renderToStaticMarkup(createElement(Notifications, { initialData: [{ id: 1, title: 'New application', body: 'Review it', type: 'event_application', referenceId: 42, referenceType: 'market_event', isRead: false, createdAt: '2026-11-05T08:00:00+08:00' }] }))
  assert.match(html, /Mark as read/)
  assert.match(html, /Mark all as read/)
  assert.match(html, /event-manager\/events\/42/)
})
