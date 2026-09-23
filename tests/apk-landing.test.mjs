import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')
const css = readFileSync(fileURLToPath(new URL('../src/App.css', import.meta.url)), 'utf8')

test('uses an environment-provided APK URL without shipping a placeholder domain', () => {
  assert.match(source, /VITE_APK_DOWNLOAD_URL/)
  assert.match(source, /href=\{DOWNLOAD_URL\}/)
  assert.match(source, /Download unavailable/)
  assert.doesNotMatch(source, /downloads\.agrimarket\.example/)
})

test('explains the Android installation path without promising silent installation', () => {
  assert.match(source, /Download the APK/)
  assert.match(source, /Allow installs if Android asks/)
  assert.match(source, /Open the download and install/)
  assert.doesNotMatch(source, /Create your AgriMarket account/)
})

test('renders an accessible four-step buyer story separate from farmer tools', () => {
  assert.match(source, /Browse harvests/)
  assert.match(source, /Review crop details/)
  assert.match(source, /Request a reservation/)
  assert.match(source, /Get app guidance/)
  assert.match(source, /role="tablist"/)
  assert.match(source, /role="tab"/)
  assert.match(source, /aria-selected=\{isActive\}/)
  assert.match(source, /role="tabpanel"/)
})

test('defines responsive layouts without masking page overflow', () => {
  assert.match(css, /@media \(max-width: 850px\)/)
  assert.match(css, /@media \(max-width: 768px\)/)
  assert.match(css, /@media \(max-width: 540px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css, /\.site-shell\s*\{[^}]*overflow-x:\s*(hidden|clip)/s)
})

test('keeps the compact download action at the minimum touch target size', () => {
  assert.match(css, /\.button-compact\s*\{[^}]*min-height:\s*44px/s)
})

test('keeps four buyer tabs in a two-by-two mobile layout', () => {
  assert.match(css, /@media \(max-width: 540px\)\s*\{[\s\S]*?\.story-tabs-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
})
