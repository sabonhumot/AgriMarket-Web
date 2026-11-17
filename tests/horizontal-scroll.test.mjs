import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')
const inviteSource = readFileSync(fileURLToPath(new URL('../src/auth/InviteAccept.tsx', import.meta.url)), 'utf8')

test('uses the approved brand and supplied product screens', () => {
  assert.match(source, /import brandLogo from '\.\/assets\/AgriMarket\.svg'/)
  assert.match(source, /import cropDetailsScreen from '\.\/assets\/crop-details-page\.jpg'/)
  assert.match(source, /import farmerDashboardScreen from '\.\/assets\/farmer-dashboard\.jpg'/)
  assert.match(source, /import reservationSuccessScreen from '\.\/assets\/reservation-success\.jpg'/)
})

test('invitation registration page uses the original AgriMarket brand logo', () => {
  assert.match(inviteSource, /import brandLogo from '\.\.\/assets\/AgriMarket\.svg'/)
  assert.doesNotMatch(inviteSource, /AgriMarket-admin\.svg/)
})
