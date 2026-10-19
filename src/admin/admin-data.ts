import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminUser = {
  id: number
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  buyerWarningCount: number
  manualSuspensionReason: string | null
  manuallySuspendedAt: string | null
}

export type AdminReport = {
  id: number
  reportedUserId: number | null
  buyerId: number | null
  reporter: string
  subject: string
  reason: string
  description: string | null
  evidencePath: string | null
  status: string
  outcome: string | null
  resolutionNotes: string | null
  caseDecision: string | null
  decisionReason: string | null
  decisionSeverity: string | null
  createdAt: string
  buyerWarningCount: number
}

export type AdminReportParticipant = { user_id: number; first_name: string | null; last_name: string | null; email: string | null; mobile: string | null }
export type AdminReportDetail = {
  report: { report_id: number; reservation_id: number; reporter_id: number; reported_user_id: number; report_category: string; reporter_description: string; evidence_path: string | null; status: string; resolution_outcome: string | null; resolution_notes: string | null; case_decision: string | null; decision_reason: string | null; decision_severity: string | null; created_at: string; decided_at: string | null }
  reservation: { reservation_id: number; listing_id: number; buyer_id: number; farmer_id: number; reservation_status: string; quantity_requested: number; total_price: number; fulfillment_mode: string | null; pickup_arrangement_snapshot: string | null; event_name_snapshot: string | null; event_date_snapshot: string | null; event_location_snapshot: string | null }
  participants: { reporter: AdminReportParticipant | null; reported: AdminReportParticipant | null }
  messages: Array<{ message_id: string; sender_id: number | null; body: string; created_at: string }>
  messages_available: boolean
  active_points: number
  active_restriction: { type: string; ends_at: string; review_required: boolean } | null
  evidence_url?: string | null
}

export type AdminReportDecision = {
  reportId: number
  caseDecision: 'resolved' | 'dismissed' | 'violation_confirmed' | 'critical_investigation'
  reason: string
  reservationOutcome?: 'fulfilled' | 'not_fulfilled'
  severity?: 'warning' | 'ordinary' | 'serious'
  restrictionEndsAt?: string
}

export type AdminActivity = {
  id: number
  actor: string
  action: string
  entityType: string
  entityId: number | null
  createdAt: string
}

export type AdminData = {
  users: AdminUser[]
  reports: AdminReport[]
  activity: AdminActivity[]
}

type UserRow = { user_id: number; first_name: string | null; last_name: string | null; email: string | null; mobile: string | null; role: string; user_status: string; created_at: string }
type ReportRow = { report_id: number; reporter_id: number | null; reported_user_id: number | null; buyer_id: number | null; reason: string | null; report_category: string | null; reporter_description: string | null; evidence_path: string | null; status: string; resolution_outcome: string | null; resolution_notes: string | null; case_decision: string | null; decision_reason: string | null; decision_severity: string | null; created_at: string }
type BuyerWarningCountRow = { buyer_id: number; warning_count: number | string }
type UserSuspensionRow = { user_id: number; reason: string; suspended_at: string }
type ActivityRow = { system_log_id: number; actor_id: number | null; action: string; entity_type: string; entity_id: number | null; created_at: string; metadata: Record<string, unknown> | null }

function nameOf(user: UserRow | undefined): string {
  if (!user) return 'Unknown user'
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || `User #${user.user_id}`
}

export async function loadAdminData(client: SupabaseClient): Promise<AdminData> {
  const responses = await Promise.all([
    client.from('users').select('user_id, first_name, last_name, email, mobile, role, user_status, created_at'),
    client.rpc('get_admin_transaction_reports'),
    client.rpc('get_admin_buyer_warning_counts'),
    client.rpc('get_admin_user_suspensions'),
    client.from('system_logs').select('system_log_id, actor_id, action, entity_type, entity_id, created_at, metadata'),
  ])
  for (const response of responses) if (response.error) throw response.error

  const [users, reports, warningRows, suspensionRows, activity] = responses.map((response) => response.data ?? []) as unknown as [
    UserRow[], ReportRow[], BuyerWarningCountRow[], UserSuspensionRow[], ActivityRow[],
  ]
  const people = new Map(users.map((user) => [user.user_id, user]))
  const warningCounts = new Map(warningRows.map(row => [row.buyer_id, Number(row.warning_count)]))
  const suspensions = new Map(suspensionRows.map(row => [row.user_id, row]))

  return {
    users: users.map((row) => ({
      id: row.user_id,
      name: nameOf(row),
      email: row.email ?? '',
      role: row.role,
      status: row.user_status,
      createdAt: row.created_at,
      buyerWarningCount: warningCounts.get(row.user_id) ?? 0,
      manualSuspensionReason: suspensions.get(row.user_id)?.reason ?? null,
      manuallySuspendedAt: suspensions.get(row.user_id)?.suspended_at ?? null,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    reports: reports.map((row) => ({
      id: row.report_id,
      reportedUserId: row.reported_user_id,
      buyerId: row.buyer_id,
      reporter: nameOf(people.get(row.reporter_id ?? -1)),
      subject: nameOf(people.get(row.reported_user_id ?? -1)),
      reason: row.reason?.trim() || row.report_category?.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || `Report #${row.report_id}`,
      description: row.reporter_description,
      evidencePath: row.evidence_path ?? null,
      status: row.status,
      outcome: row.resolution_outcome,
      resolutionNotes: row.resolution_notes ?? null,
      caseDecision: row.case_decision ?? null,
      decisionReason: row.decision_reason ?? null,
      decisionSeverity: row.decision_severity ?? null,
      createdAt: row.created_at,
      buyerWarningCount: row.reported_user_id === row.buyer_id ? warningCounts.get(row.buyer_id ?? -1) ?? 0 : 0,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    activity: activity.map((row) => ({
      id: row.system_log_id,
      actor: nameOf(people.get(row.actor_id ?? -1)),
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

export async function setAdminUserSuspension(client: SupabaseClient, input: { userId: number; suspend: boolean; reason: string }): Promise<{ user_id: number; status: string }> {
  const reason = input.reason.trim()
  if (!reason || reason.length > 2000) throw new Error('A reason of 1 to 2000 characters is required.')
  const { data, error } = await client.rpc('admin_set_user_suspension', {
    p_user_id: input.userId,
    p_suspend: input.suspend,
    p_reason: reason,
  })
  if (error) throw error
  return data as { user_id: number; status: string }
}

export async function resolveAdminReportCase(client: SupabaseClient, input: { reportId: number; outcome: 'fulfilled' | 'not_fulfilled' | 'dismissed'; notes: string; issueBuyerWarning: boolean }): Promise<{ reservation_status: string; buyer_warning_count: number }> {
  const notes = input.notes.trim()
  if (!notes || notes.length > 2000) throw new Error('Resolution notes must be 1 to 2000 characters.')
  if (input.issueBuyerWarning && input.outcome !== 'not_fulfilled') throw new Error('A buyer warning requires a not fulfilled resolution.')
  const { data, error } = await client.rpc('admin_resolve_report_case', {
    p_report_id: input.reportId,
    p_outcome: input.outcome,
    p_notes: notes,
    p_issue_buyer_warning: input.issueBuyerWarning,
  })
  if (error) throw error
  return data as { reservation_status: string; buyer_warning_count: number }
}

export async function loadReportEvidenceUrl(client: SupabaseClient, evidencePath: string | null): Promise<string | null> {
  if (!evidencePath) return null
  const { data, error } = await client.storage.from('reservation-reports').createSignedUrl(evidencePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function loadAdminReportDetail(client: SupabaseClient, reportId: number): Promise<AdminReportDetail> {
  const { data, error } = await client.rpc('admin_get_reservation_report_detail', { p_report_id: reportId })
  if (error) throw error
  const detail = data as unknown as AdminReportDetail
  if (detail.report.evidence_path) {
    const { data: signed, error: signedError } = await client.storage.from('reservation-reports').createSignedUrl(detail.report.evidence_path, 300)
    if (signedError) throw signedError
    detail.evidence_url = signed.signedUrl
  }
  return detail
}

export async function decideAdminReport(client: SupabaseClient, decision: AdminReportDecision): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc('admin_decide_reservation_report', {
    p_report_id: decision.reportId,
    p_case_decision: decision.caseDecision,
    p_decision_reason: decision.reason,
    p_reservation_outcome: decision.reservationOutcome ?? null,
    p_severity: decision.severity ?? null,
    p_restriction_ends_at: decision.restrictionEndsAt ?? null,
  })
  if (error) throw error
  return data as Record<string, unknown>
}
