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

test('presents three buyer steps and keeps app guidance available separately', () => {
  assert.match(source, /label: 'Browse'/)
  assert.match(source, /label: 'Review'/)
  assert.match(source, /label: 'Request'/)
  assert.match(source, /journeyStories = stories\.slice\(0, 3\)/)
  assert.match(source, /aria-current=\{index === tourIndex \? 'step' : undefined\}/)
  assert.match(source, /Need a hand\?/)
  assert.match(source, /guidanceStory\.image/)
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

test('places the tour phone before its copy on narrow screens', () => {
  assert.match(css, /@media \(max-width: 540px\)\s*\{[\s\S]*?\.buyer-tour-phone\s*\{[^}]*order:\s*-1/s)
})
