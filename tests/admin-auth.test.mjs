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
  assert.match(html, /Checking administrator access|Opening AgriMarket/)
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

  assert.match(html, /aria-label="AgriMarket sign in"/)
  assert.match(html, /noValidate=""/)
  assert.match(html, /type="email"/)
  assert.match(html, /type="password"/)
  assert.match(html, /Forgot password\?/)
  assert.doesNotMatch(html, /Sign up|Create account/)
})

test('the login form supports forgot password and password reset modes', async () => {
  const { default: AdminLogin } = await server.ssrLoadModule('/src/admin/AdminLogin.tsx')
  
  const forgotHtml = renderToStaticMarkup(createElement(AdminLogin, {
    onSignIn: async () => {},
    initialMode: 'forgot',
  }))
  assert.match(forgotHtml, /Reset password/)
  assert.match(forgotHtml, /Send verification code/)
  assert.match(forgotHtml, /Return to sign in/)

  const verifyHtml = renderToStaticMarkup(createElement(AdminLogin, {
    onSignIn: async () => {},
    initialMode: 'verify_code',
  }))
  assert.match(verifyHtml, /Enter verification code/)
  assert.match(verifyHtml, /Verification code/)
  assert.match(verifyHtml, /Verify code/)
  assert.doesNotMatch(verifyHtml, /New password/)

  const resetHtml = renderToStaticMarkup(createElement(AdminLogin, {
    onSignIn: async () => {},
    initialMode: 'reset',
  }))
  assert.match(resetHtml, /Set new password/)
  assert.match(resetHtml, /Update password and sign in/)
  assert.match(resetHtml, /Password must contain/)
  assert.match(resetHtml, /8 characters and above/)
  assert.match(resetHtml, /Uppercase (&amp;|&) lowercase letters/)
  assert.match(resetHtml, /At least one number/)
  assert.match(resetHtml, /At least one special character/)
})

test('validates new passwords according to complexity criteria', async () => {
  const { validateNewPassword, checkPasswordCriteria } = await server.ssrLoadModule('/src/auth/password-validation.ts')

  // Under 8 characters
  const shortResult = validateNewPassword('Aa1!')
  assert.equal(shortResult.isValid, false)
  assert.equal(shortResult.hasMinLength, false)
  assert.match(shortResult.primaryError, /at least 8 characters/i)

  // Missing uppercase
  const noUpperResult = validateNewPassword('password123!')
  assert.equal(noUpperResult.isValid, false)
  assert.equal(noUpperResult.hasUpper, false)
  assert.equal(noUpperResult.hasLower, true)
  assert.match(noUpperResult.primaryError, /uppercase and lowercase/i)

  // Missing lowercase
  const noLowerResult = validateNewPassword('PASSWORD123!')
  assert.equal(noLowerResult.isValid, false)
  assert.equal(noLowerResult.hasLower, false)
  assert.equal(noLowerResult.hasUpper, true)
  assert.match(noLowerResult.primaryError, /uppercase and lowercase/i)

  // Missing number
  const noNumberResult = validateNewPassword('Password!@#')
  assert.equal(noNumberResult.isValid, false)
  assert.equal(noNumberResult.hasNumber, false)
  assert.match(noNumberResult.primaryError, /at least one number/i)

  // Missing special character
  const noSpecialResult = validateNewPassword('Password123')
  assert.equal(noSpecialResult.isValid, false)
  assert.equal(noSpecialResult.hasSpecial, false)
  assert.match(noSpecialResult.primaryError, /special character/i)

  // Fully compliant password
  const validResult = validateNewPassword('AgriMarket#2026')
  assert.equal(validResult.isValid, true)
  assert.equal(validResult.hasMinLength, true)
  assert.equal(validResult.hasLower, true)
  assert.equal(validResult.hasUpper, true)
  assert.equal(validResult.hasNumber, true)
  assert.equal(validResult.hasSpecial, true)
  assert.equal(validResult.primaryError, null)

  // Individual criteria helper
  const criteria = checkPasswordCriteria('P@ss1')
  assert.equal(criteria.hasMinLength, false)
  assert.equal(criteria.hasLower, true)
  assert.equal(criteria.hasUpper, true)
  assert.equal(criteria.hasNumber, true)
  assert.equal(criteria.hasSpecial, true)
})

