import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({ root, appType: 'custom', server: { middlewareMode: true } })
after(() => server.close())

function queryResult(result) {
  const query = Promise.resolve(result)
  query.not = () => query
  return query
}

test('admin data comes from the shared tables and maps real statuses', async () => {
  const { loadAdminData } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const rows = {
    users: [{ user_id: 1, first_name: 'Ana', last_name: 'Reyes', email: 'ana@example.test', role: 'farmer', user_status: 'active', created_at: '2026-09-30T10:00:00Z' }],
    get_admin_transaction_reports: [{ report_id: 3, reporter_id: 1, reported_user_id: 1, buyer_id: 1, reason: 'Missing crop', report_category: 'product_not_received', reporter_description: 'Reservation problem', evidence_path: 'farmer-1/report-3.png', status: 'open', resolution_outcome: null, created_at: '2026-10-01T07:00:00Z' }],
    get_admin_buyer_warning_counts: [{ buyer_id: 1, warning_count: 4 }],
    get_admin_user_suspensions: [{ user_id: 1, reason: 'Account review', suspended_at: '2026-10-02T07:00:00Z' }],
    system_logs: [{ system_log_id: 5, actor_id: 1, action: 'event.published', entity_type: 'market_event', entity_id: 4, created_at: '2026-10-01T06:00:00Z' }],
    buyer_profiles: [],
    farmer_profiles: [{ user_id: 1, profile_photo_path: 'farmer-1/avatar.png' }],
    get_admin_event_manager_logos: [],
  }
  const requested = []
  const client = { rpc(name) {
    requested.push(name)
    return Promise.resolve({ data: rows[name], error: null })
  }, from(table) {
    requested.push(table)
    return { select: () => queryResult({ data: rows[table], error: null }) }
  }, storage: { from(bucket) {
    return { getPublicUrl: path => ({ data: { publicUrl: `https://example.test/${bucket}/${path}` } }) }
  } } }

  const result = await loadAdminData(client)
  assert.deepEqual(requested.sort(), Object.keys(rows).sort())
  assert.equal(result.users[0].name, 'Ana Reyes')
  assert.equal('applications' in result, false)
  assert.equal('marketplaceReviews' in result, false)
  assert.equal(result.reports[0].reason, 'Missing crop')
  assert.equal(result.reports[0].evidencePath, 'farmer-1/report-3.png')
  assert.equal(result.reports[0].buyerWarningCount, 4)
  assert.equal(result.users[0].buyerWarningCount, 4)
  assert.equal(result.users[0].manualSuspensionReason, 'Account review')
  assert.equal(result.users[0].manuallySuspendedAt, '2026-10-02T07:00:00Z')
  assert.equal(result.activity[0].action, 'event.published')
  assert.equal(result.activity[0].actorRole, 'farmer')
  assert.equal(result.activity[0].actorPhotoUrl, 'https://example.test/profile-images/farmer-1/avatar.png')
})

test('user suspension requires a reason and sends one admin action', async () => {
  const { setAdminUserSuspension } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const calls = []
  const client = { rpc: async (name, args) => {
    calls.push([name, args])
    return { data: { user_id: 7, status: 'suspended' }, error: null }
  } }
  await assert.rejects(setAdminUserSuspension(client, { userId: 7, suspend: true, reason: '  ' }), /reason/i)
  const result = await setAdminUserSuspension(client, { userId: 7, suspend: true, reason: '  Account review  ' })
  assert.equal(result.status, 'suspended')
  assert.deepEqual(calls, [['admin_set_user_suspension', { p_user_id: 7, p_suspend: true, p_reason: 'Account review' }]])
})

test('report title falls back to a readable category when no reason was supplied', async () => {
  const { loadAdminData } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const client = {
    rpc: async (name) => ({ data: name === 'get_admin_transaction_reports' ? [{ report_id: 4, reporter_id: null, reported_user_id: null, buyer_id: null, reason: '', report_category: 'participant_no_show', reporter_description: null, evidence_path: null, status: 'open', resolution_outcome: null, case_decision: null, decision_reason: null, decision_severity: null, created_at: '2026-10-01T07:00:00Z' }] : [], error: null }),
    from: () => ({ select: () => queryResult({ data: [], error: null }) }),
  }
  const result = await loadAdminData(client)
  assert.equal(result.reports[0].reason, 'Participant No Show')
})

test('resolving a report sends a buyer warning only when confirmed', async () => {
  const { resolveAdminReportCase } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const calls = []
  const client = { rpc: async (name, args) => {
    calls.push([name, args])
    return { data: { reservation_status: 'cancelled', buyer_warning_count: 4 }, error: null }
  } }
  const result = await resolveAdminReportCase(client, { reportId: 3, outcome: 'not_fulfilled', notes: 'Buyer did not appear.', issueBuyerWarning: true })
  assert.equal(result.buyer_warning_count, 4)
  assert.deepEqual(calls, [['admin_resolve_report_case', { p_report_id: 3, p_outcome: 'not_fulfilled', p_notes: 'Buyer did not appear.', p_issue_buyer_warning: true }]])
  await assert.rejects(resolveAdminReportCase(client, { reportId: 3, outcome: 'fulfilled', notes: 'Done', issueBuyerWarning: true }), /not fulfilled/i)
  assert.equal(calls.length, 1)
})

test('signs report evidence only through its private storage bucket', async () => {
  const { loadReportEvidenceUrl } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const requested = []
  const client = { storage: { from(bucket) {
    requested.push(bucket)
    return { createSignedUrl: async (path, lifetime) => {
      requested.push([path, lifetime])
      return { data: { signedUrl: 'https://example.test/evidence' }, error: null }
    } }
  } } }

  assert.equal(await loadReportEvidenceUrl(client, 'farmer-1/report-3.png'), 'https://example.test/evidence')
  assert.deepEqual(requested, ['reservation-reports', ['farmer-1/report-3.png', 3600]])
  assert.equal(await loadReportEvidenceUrl(client, null), null)
  assert.equal(requested.length, 2)
})

test('admin data fails closed when any protected query fails', async () => {
  const { loadAdminData } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const client = { from(table) {
    return { select: () => queryResult(table === 'system_logs'
      ? { data: null, error: new Error('permission denied') }
      : { data: [], error: null }) }
  }, rpc: async () => ({ data: [], error: null }) }
  await assert.rejects(loadAdminData(client), /permission denied/)
})
