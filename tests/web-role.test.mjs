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

function clientFor(row, id = 'auth-1') {
  return {
    auth: { getUser: async () => ({ data: { user: id ? { id } : null }, error: null }) },
    from(table) {
      assert.equal(table, 'users')
      return { select(columns) {
        assert.equal(columns, 'first_name,last_name,email,role,user_status')
        return { eq(column, value) {
          assert.equal(column, 'auth_id')
          assert.equal(value, id)
          return { maybeSingle: async () => ({ data: row, error: null }) }
        } }
      } }
    },
  }
}

test('shared role lookup admits only active web roles', async () => {
  const { getWebRole } = await server.ssrLoadModule('/src/auth/web-role.ts')
  assert.equal(await getWebRole(clientFor({ role: 'admin', user_status: 'active' })), 'admin')
  assert.equal(await getWebRole(clientFor({ role: 'coordinator', user_status: 'active' })), 'event_manager')
  assert.equal(await getWebRole(clientFor({ role: 'coordinator', user_status: 'suspended' })), null)
  assert.equal(await getWebRole(clientFor({ role: 'event_manager', user_status: 'active' })), null)
  assert.equal(await getWebRole(clientFor({ role: 'buyer', user_status: 'active' })), null)
  assert.equal(await getWebRole(clientFor(null)), null)
  assert.equal(await getWebRole(clientFor(null, null)), null)
})

test('shared login and manager overview routes withhold protected data before auth', async () => {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  const login = renderToStaticMarkup(createElement(App, { initialPath: '/login' }))
  const overview = renderToStaticMarkup(createElement(App, { initialPath: '/event-manager' }))
  assert.match(login, /Opening AgriMarket|AgriMarket sign in/)
  assert.match(overview, /Opening AgriMarket/)
  assert.doesNotMatch(overview, /Market Day Overview/)
})
