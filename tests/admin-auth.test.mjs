import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({
  root,
  appType: 'custom',
  plugins: [react(), {
    name: 'ssr-asset-stub',
    resolveId(id) {
      if (/\.(css|jpg|png|svg)$/.test(id)) return '\0virtual:' + id
    },
    load(id) {
      if (id.startsWith('\0virtual:')) return 'export default ""'
    },
  }],
  server: { middlewareMode: true },
})

after(() => server.close())

test('the admin route withholds workspace content until access is checked', async () => {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  const html = renderToStaticMarkup(createElement(App, { initialPath: '/admin' }))

  assert.doesNotMatch(html, /Platform overview/)
  assert.match(html, /Checking administrator access/)
})

test('only an authenticated active admin can enter the workspace', async () => {
  const { checkAdminAccess } = await server.ssrLoadModule('/src/admin/admin-auth.ts')
  const makeClient = (row, userId = 'auth-1') => ({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from: (table) => {
      assert.equal(table, 'users')
      return {
        select: (columns) => {
          assert.equal(columns, 'role, user_status')
          return {
            eq: (column, value) => {
              assert.equal(column, 'auth_id')
              assert.equal(value, userId)
              return { maybeSingle: async () => ({ data: row, error: null }) }
            },
          }
        },
      }
    },
  })

  assert.equal(await checkAdminAccess(makeClient({ role: 'admin', user_status: 'active' })), true)
  assert.equal(await checkAdminAccess(makeClient({ role: 'buyer', user_status: 'active' })), false)
  assert.equal(await checkAdminAccess(makeClient({ role: 'admin', user_status: 'suspended' })), false)
  assert.equal(await checkAdminAccess(makeClient(null)), false)
  assert.equal(await checkAdminAccess(makeClient(null, null)), false)
})

test('the login form labels its credentials and has no public sign-up path', async () => {
  const { default: AdminLogin } = await server.ssrLoadModule('/src/admin/AdminLogin.tsx')
  const html = renderToStaticMarkup(createElement(AdminLogin, { onSignIn: async () => {} }))

  assert.match(html, /Administrator sign in/)
  assert.match(html, /type="email"/)
  assert.match(html, /type="password"/)
  assert.doesNotMatch(html, /Sign up|Create account/)
})
