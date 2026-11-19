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

test('formatReportMessageTemplate populates placeholders for reported person and report', async () => {
  const { REPORT_MESSAGE_TEMPLATES, formatReportMessageTemplate } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  assert.ok(REPORT_MESSAGE_TEMPLATES.length >= 5)

  const template = REPORT_MESSAGE_TEMPLATES.find(t => t.id === 'explanation_request')
  assert.ok(template)

  const formatted = formatReportMessageTemplate(template, {
    id: 42,
    subject: 'Carlos Mendoza',
    reason: 'Participant No Show',
  })

  assert.match(formatted.subject, /Case #42/)
  assert.match(formatted.body, /Hello Carlos Mendoza/)
  assert.match(formatted.body, /Case #42/)
  assert.match(formatted.body, /Participant No Show/)
  assert.doesNotMatch(formatted.body, /\{name\}|\{caseId\}|\{reason\}/)
})

test('sendAdminReportMessage validates inputs and invokes rpc or notifications table', async () => {
  const { sendAdminReportMessage } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  const rpcCalls = []
  const clientWithRpc = {
    rpc: async (name, args) => {
      rpcCalls.push([name, args])
      return { data: { success: true, notification_id: 101 }, error: null }
    },
  }

  // Validation checks
  await assert.rejects(sendAdminReportMessage(clientWithRpc, {
    reportId: 5, recipientUserId: 0, title: 'Notice', body: 'Message',
  }), /recipient/i)

  await assert.rejects(sendAdminReportMessage(clientWithRpc, {
    reportId: 5, recipientUserId: 8, title: '  ', body: 'Message',
  }), /subject/i)

  await assert.rejects(sendAdminReportMessage(clientWithRpc, {
    reportId: 5, recipientUserId: 8, title: 'Notice', body: '  ',
  }), /body/i)

  // Success via RPC
  const result = await sendAdminReportMessage(clientWithRpc, {
    reportId: 5,
    recipientUserId: 8,
    title: '  Official Notice  ',
    body: '  Please attend your scheduled pickup.  ',
    templateId: 'policy_warning',
  })

  assert.equal(result.success, true)
  assert.equal(result.notificationId, 101)
  assert.deepEqual(rpcCalls, [[
    'admin_send_report_message',
    {
      p_report_id: 5,
      p_recipient_user_id: 8,
      p_title: 'Official Notice',
      p_body: 'Please attend your scheduled pickup.',
      p_template: 'policy_warning',
    },
  ]])

  // Success fallback via table insert
  const tableInserts = []
  const clientWithoutRpc = {
    rpc: async () => ({ data: null, error: { code: '42883', message: 'function not found' } }),
    from: (table) => ({
      insert: (payload) => {
        tableInserts.push([table, payload])
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { notification_id: 202 }, error: null }),
          }),
        }
      },
    }),
  }

  const fallbackResult = await sendAdminReportMessage(clientWithoutRpc, {
    reportId: 7,
    recipientUserId: 12,
    title: 'Inquiry',
    body: 'Please contact admin.',
  })

  assert.equal(fallbackResult.success, true)
  assert.equal(fallbackResult.notificationId, 202)
  assert.equal(tableInserts.some(([tbl]) => tbl === 'notifications'), true)
  assert.equal(tableInserts.some(([tbl]) => tbl === 'system_logs'), true)
})

test('WARNING_REASON_TEMPLATES provides warning reasons and formatWarningReason replaces placeholders', async () => {
  const { WARNING_REASON_TEMPLATES, formatWarningReason } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  assert.ok(WARNING_REASON_TEMPLATES.length >= 6)
  const noShow = WARNING_REASON_TEMPLATES.find(t => t.id === 'no_show')
  assert.ok(noShow)
  assert.match(noShow.label, /No-show/)

  const formatted = formatWarningReason('Warning for {name} on case #{caseId}: {reason}.', {
    id: 99,
    subject: 'Elena Gomez',
    reason: 'Unclaimed harvest',
  })
  assert.equal(formatted, 'Warning for Elena Gomez on case #99: Unclaimed harvest.')
})

test('SUSPENSION_REASON_SUGGESTIONS provides floating suggestion pills for user suspension', async () => {
  const { SUSPENSION_REASON_SUGGESTIONS } = await server.ssrLoadModule('/src/admin/admin-data.ts')
  assert.ok(SUSPENSION_REASON_SUGGESTIONS.length >= 6)
  const threshold = SUSPENSION_REASON_SUGGESTIONS.find(s => s.id === 'warning_threshold')
  assert.ok(threshold)
  assert.match(threshold.label, /4\+ warnings threshold/)
  assert.match(threshold.reason, /threshold of 4 unfulfilled transaction warnings/)

  const policy = SUSPENSION_REASON_SUGGESTIONS.find(s => s.id === 'policy_violation')
  assert.ok(policy)
  assert.match(policy.label, /Policy violation/)
  assert.ok(policy.reason.length > 20)
})

