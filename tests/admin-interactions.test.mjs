import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

const server = await createServer({
  root: projectRoot,
  appType: 'custom',
  plugins: [react()],
  server: { middlewareMode: true },
})

after(async () => {
  await server.close()
})

test('filters case-insensitively across review title, subject, and type', async () => {
  const { matchesQuery } = await server.ssrLoadModule('/src/admin/admin-state.ts')
  const record = {
    title: 'Duplicate bok choy listing',
    subject: 'Cebu Fresh Cooperative',
    type: 'Listing report',
  }

  assert.equal(matchesQuery(record, 'COOPERATIVE'), true)
  assert.equal(matchesQuery(record, 'bok-choy'), false)
  assert.equal(matchesQuery(record, ''), true)
})

test('moves only the selected review item without mutating the source list', async () => {
  const { updateReviewStatus } = await server.ssrLoadModule('/src/admin/admin-state.ts')
  const source = [
    { id: 'review-1', status: 'needs-review' },
    { id: 'review-2', status: 'investigating' },
  ]
  const updated = updateReviewStatus(source, 'review-1', 'resolved')

  assert.equal(updated[0].status, 'resolved')
  assert.equal(updated[1].status, 'investigating')
  assert.equal(source[0].status, 'needs-review')
  assert.notEqual(updated, source)
})

test('keeps activity entries in newest-first order for the chronological log', async () => {
  const { activityEntries } = await server.ssrLoadModule('/src/admin/demo-data.ts')

  assert.equal(activityEntries[0].title, 'Listing report submitted')
  assert.equal(activityEntries[1].title, 'Organization application received')
})

test('records an organization decision with a reason and updates only that application', async () => {
  const { applyOrganizationDecision } = await server.ssrLoadModule('/src/admin/organization-reviews.ts')
  const state = {
    organizations: [
      { id: 'org-1', name: 'Buhisan Growers Circle', status: 'Pending review' },
      { id: 'org-2', name: 'Cebu Fresh Cooperative', status: 'Approved' },
    ],
    decisions: [],
  }

  const updated = applyOrganizationDecision(state, {
    organizationId: 'org-1',
    decision: 'request-details',
    reason: '  Please provide the membership document.  ',
    decidedAt: '2026-09-23T08:00:00.000Z',
  })

  assert.equal(updated.organizations[0].status, 'Needs details')
  assert.equal(updated.organizations[1].status, 'Approved')
  assert.equal(state.organizations[0].status, 'Pending review')
  assert.equal(updated.decisions[0].reason, 'Please provide the membership document.')
  assert.equal(updated.decisions[0].organizationName, 'Buhisan Growers Circle')
})

test('requires a reason and a known application before recording a decision', async () => {
  const { applyOrganizationDecision } = await server.ssrLoadModule('/src/admin/organization-reviews.ts')
  const state = { organizations: [{ id: 'org-1', name: 'Buhisan Growers Circle', status: 'Pending review' }], decisions: [] }

  assert.throws(() => applyOrganizationDecision(state, {
    organizationId: 'org-1', decision: 'approve', reason: '  ', decidedAt: '2026-09-23T08:00:00.000Z',
  }), /reason/i)
  assert.throws(() => applyOrganizationDecision(state, {
    organizationId: 'missing', decision: 'reject', reason: 'Incomplete', decidedAt: '2026-09-23T08:00:00.000Z',
  }), /application/i)
})

test('supports approval and rejection outcomes for an application', async () => {
  const { applyOrganizationDecision } = await server.ssrLoadModule('/src/admin/organization-reviews.ts')
  const initial = { organizations: [{ id: 'org-1', name: 'Buhisan Growers Circle', status: 'Pending review' }], decisions: [] }
  const approved = applyOrganizationDecision(initial, {
    organizationId: 'org-1', decision: 'approve', reason: 'Documents verified', decidedAt: '2026-09-23T08:00:00.000Z',
  })
  const rejected = applyOrganizationDecision(approved, {
    organizationId: 'org-1', decision: 'reject', reason: 'Submission withdrawn', decidedAt: '2026-09-23T09:00:00.000Z',
  })

  assert.equal(approved.organizations[0].status, 'Approved')
  assert.equal(rejected.organizations[0].status, 'Rejected')
  assert.equal(rejected.decisions.length, 2)
  assert.equal(rejected.decisions[0].reason, 'Submission withdrawn')
})

test('restores organization decisions after reload and falls back from corrupt storage', async () => {
  const { loadOrganizationReviews, saveOrganizationReviews } = await server.ssrLoadModule('/src/admin/organization-reviews.ts')
  const values = new Map()
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  const defaults = [{ id: 'org-1', name: 'Buhisan Growers Circle', status: 'Pending review' }]
  const state = {
    organizations: [{ id: 'org-1', name: 'Buhisan Growers Circle', status: 'Approved' }],
    decisions: [{ id: 'decision-1', organizationId: 'org-1', organizationName: 'Buhisan Growers Circle', decision: 'approve', reason: 'Documents checked', decidedAt: '2026-09-23T08:00:00.000Z' }],
  }

  assert.equal(saveOrganizationReviews(storage, state), true)
  assert.deepEqual(loadOrganizationReviews(storage, defaults), state)
  values.set('agrimarket-admin-organization-reviews-v1', '{broken')
  assert.deepEqual(loadOrganizationReviews(storage, defaults), { organizations: defaults, decisions: [] })
})

test('shows the newest organization decision and its reason in the activity feed', async () => {
  const { decisionActivityEntries } = await server.ssrLoadModule('/src/admin/organization-reviews.ts')
  const entries = decisionActivityEntries([
    { id: 'd1', organizationId: 'org-1', organizationName: 'Buhisan Growers Circle', decision: 'approve', reason: 'Membership confirmed', decidedAt: '2026-09-23T08:00:00.000Z' },
    { id: 'd2', organizationId: 'org-1', organizationName: 'Buhisan Growers Circle', decision: 'request-details', reason: 'Missing document', decidedAt: '2026-09-23T09:00:00.000Z' },
  ])

  assert.equal(entries[0].title, 'More details requested')
  assert.equal(entries[0].subject, 'Buhisan Growers Circle')
  assert.equal(entries[0].details, 'Missing document')
  assert.equal(entries[1].title, 'Organization approved')
})

test('keeps listing case progress separate from its decision outcome', async () => {
  const { applyListingCaseAction } = await server.ssrLoadModule('/src/admin/listing-cases.ts')
  const original = [{ reportId: 'review-1', status: 'needs-review', outcome: null, visibility: 'Visible', events: [] }]
  const started = applyListingCaseAction(original, 'review-1', 'start-review', '', '2026-09-23T08:00:00.000Z')
  const waiting = applyListingCaseAction(started, 'review-1', 'request-correction', 'Please remove the duplicate.', '2026-09-23T08:05:00.000Z')
  const hidden = applyListingCaseAction(waiting, 'review-1', 'hide', 'The duplicate is still live.', '2026-09-23T09:00:00.000Z')

  assert.equal(original[0].status, 'needs-review')
  assert.equal(started[0].status, 'investigating')
  assert.equal(waiting[0].status, 'waiting-for-info')
  assert.equal(waiting[0].outcome, null)
  assert.equal(hidden[0].status, 'resolved')
  assert.equal(hidden[0].outcome, 'hide')
  assert.equal(hidden[0].visibility, 'Hidden')
  assert.equal(hidden[0].events[0].reason, 'The duplicate is still live.')
})

test('requires a reason for listing decisions and preserves case history on reopen', async () => {
  const { applyListingCaseAction } = await server.ssrLoadModule('/src/admin/listing-cases.ts')
  const original = [{ reportId: 'review-1', status: 'investigating', outcome: null, visibility: 'Visible', events: [] }]
  assert.throws(() => applyListingCaseAction(original, 'review-1', 'remove', '  ', '2026-09-23T08:00:00.000Z'), /reason/i)
  assert.throws(() => applyListingCaseAction(original, 'missing', 'keep', 'No issue', '2026-09-23T08:00:00.000Z'), /case/i)
  const closed = applyListingCaseAction(original, 'review-1', 'remove', 'Repeated duplicate listing', '2026-09-23T08:00:00.000Z')
  const reopened = applyListingCaseAction(closed, 'review-1', 'reopen', 'Farmer disputed this decision', '2026-09-23T09:00:00.000Z')
  assert.equal(reopened[0].status, 'investigating')
  assert.equal(reopened[0].outcome, null)
  assert.equal(reopened[0].visibility, 'Removed')
  assert.equal(reopened[0].events.length, 2)
})

test('restores listing cases and exposes actions in the activity log', async () => {
  const { applyListingCaseAction, loadListingCases, saveListingCases, listingCaseActivityEntries } = await server.ssrLoadModule('/src/admin/listing-cases.ts')
  const defaults = [{ reportId: 'review-1', status: 'needs-review', outcome: null, visibility: 'Visible', events: [] }]
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const updated = applyListingCaseAction(defaults, 'review-1', 'note', 'Photo shows matching harvest details.', '2026-09-23T08:00:00.000Z')

  assert.equal(saveListingCases(storage, updated), true)
  assert.deepEqual(loadListingCases(storage, defaults), updated)
  assert.equal(listingCaseActivityEntries(updated)[0].title, 'Listing case note added')
  assert.equal(listingCaseActivityEntries(updated)[0].details, 'Photo shows matching harvest details.')
  values.set('agrimarket-admin-listing-cases-v1', '{broken')
  assert.deepEqual(loadListingCases(storage, defaults), defaults)
})
