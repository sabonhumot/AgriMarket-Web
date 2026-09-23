import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

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
        if (id.startsWith('\0virtual:')) {
          return 'export default ""'
        }
      },
    },
  ],
  server: { middlewareMode: true },
})

after(async () => {
  await server.close()
})

async function renderLandingPage() {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  return renderToStaticMarkup(createElement(App))
}

test('shows an honest unavailable state when no APK URL is configured', async () => {
  const html = await renderLandingPage()

  assert.match(html, /Download unavailable/)
  assert.match(html, /aria-disabled="true"/)
  assert.doesNotMatch(html, /downloads\.agrimarket\.example/)
})

test('renders the product walkthrough as labelled tabs and a tab panel', async () => {
  const html = await renderLandingPage()

  assert.match(html, /role="tablist"/)
  assert.equal((html.match(/role="tab"/g) ?? []).length, 4)
  assert.match(html, /aria-selected="true"/)
  assert.match(html, /role="tabpanel"/)
  assert.doesNotMatch(html, /For Growers/)
})

test('opens with one supplied app screen and no competing promotional widgets', async () => {
  const html = await renderLandingPage()

  assert.match(html, /AgriMarket crop details screen showing produce pricing and availability/)
  assert.doesNotMatch(html, /Scan to Phone/)
  assert.doesNotMatch(html, /100% Direct Farm Price/)
  assert.doesNotMatch(html, /Middleman Cut/)
  assert.doesNotMatch(html, /Fresh Harvest/)
  assert.doesNotMatch(html, /Demo preview/)
  assert.doesNotMatch(html, /demo data/)
})

test('gives approved farmers a clear path to list and sell crops', async () => {
  const html = await renderLandingPage()

  assert.match(html, /href="#farmers"/)
  assert.match(html, /Grow it\. List it\./)
  assert.match(html, /Sell it locally\./)
  assert.match(html, /Add your harvest/)
  assert.match(html, /Manage availability/)
  assert.match(html, /Respond to buyers/)
  assert.match(html, /Farmer dashboard showing listings and order activity/)
  assert.doesNotMatch(html, /Get paid in the app/)
})

test('presents benefits as a concise editorial list without emoji decoration', async () => {
  const html = await renderLandingPage()
  const benefits = html.match(/<ul class="benefits-list">([\s\S]*?)<\/ul>/)?.[1] ?? ''

  assert.equal((benefits.match(/<li/g) ?? []).length, 3)
  assert.doesNotMatch(benefits, /🌾|🥬|💬|🛡️/)
})
