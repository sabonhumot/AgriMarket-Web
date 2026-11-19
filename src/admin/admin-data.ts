import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminUser = {
  id: number
  name: string
  email: string
  photoUrl?: string | null
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
  actorRole?: string | null
  actorPhotoUrl?: string | null
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
    client.from('buyer_profiles').select('user_id, profile_photo_path').not('profile_photo_path', 'is', null),
    client.from('farmer_profiles').select('user_id, profile_photo_path').not('profile_photo_path', 'is', null),
    client.rpc('get_admin_event_manager_logos'),
  ])
  for (const response of responses.slice(0, 5)) if (response.error) throw response.error

  const [users, reports, warningRows, suspensionRows, activity] = responses.slice(0, 5).map((response) => response.data ?? []) as unknown as [
    UserRow[], ReportRow[], BuyerWarningCountRow[], UserSuspensionRow[], ActivityRow[],
  ]
  const photoUrls = new Map<string, string>()
  for (const [index, role, bucket, field] of [[5, 'buyer', 'profile-images', 'profile_photo_path'], [6, 'farmer', 'profile-images', 'profile_photo_path'], [7, 'coordinator', 'event-manager-media', 'organization_logo_path']] as const) {
    if (responses[index].error) continue
    for (const row of (responses[index].data ?? []) as unknown as Record<string, unknown>[]) {
      const path = row[field]
      if (typeof row.user_id === 'number' && typeof path === 'string' && path) {
        photoUrls.set(`${role}:${row.user_id}`, client.storage.from(bucket).getPublicUrl(path).data.publicUrl)
      }
    }
  }
  const people = new Map(users.map((user) => [user.user_id, user]))
  const warningCounts = new Map(warningRows.map(row => [row.buyer_id, Number(row.warning_count)]))
  const suspensions = new Map(suspensionRows.map(row => [row.user_id, row]))

  return {
    users: users.map((row) => ({
      id: row.user_id,
      name: nameOf(row),
      email: row.email ?? '',
      photoUrl: photoUrls.get(`${row.role.toLowerCase()}:${row.user_id}`) ?? null,
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
    activity: activity.map((row) => {
      const actor = people.get(row.actor_id ?? -1)
      return {
        id: row.system_log_id,
        actor: row.actor_id == null ? 'System' : nameOf(actor),
        actorRole: actor?.role ?? 'system',
        actorPhotoUrl: actor ? photoUrls.get(`${actor.role.toLowerCase()}:${actor.user_id}`) ?? null : null,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        createdAt: row.created_at,
      }
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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

export type WarningReasonTemplate = {
  id: string
  label: string
  template: string
}

export const WARNING_REASON_TEMPLATES: WarningReasonTemplate[] = [
  {
    id: 'no_show',
    label: 'No-show / Unclaimed produce',
    template: 'Failure to claim confirmed produce reservation without prior notice. Perishable harvest was prepared and held, causing grower loss.',
  },
  {
    id: 'late_cancellation',
    label: 'Late cancellation after harvest',
    template: 'Cancelled reservation after the farmer harvested and packed the crops. Late cancellations cause direct perishable produce waste.',
  },
  {
    id: 'payment_refusal',
    label: 'Refusal of agreed payment',
    template: 'Refusal to honor the agreed reservation amount or payment terms upon pickup at the designated market location.',
  },
  {
    id: 'unresponsive',
    label: 'Unresponsive to pickup coordination',
    template: 'Failed to respond to seller pickup coordination messages, resulting in uncollected harvest and abandoned reservation.',
  },
  {
    id: 'repeated_non_fulfillment',
    label: 'Repeated non-fulfillment',
    template: 'Multiple unfulfilled reservation commitments. Failure to complete reserved orders violates AgriMarket fair-trade guidelines.',
  },
  {
    id: 'policy_misconduct',
    label: 'Community policy violation',
    template: 'Conduct during reservation coordination violated AgriMarket community guidelines and reservation terms.',
  },
]

export function formatWarningReason(
  template: string,
  report: Pick<AdminReport, 'id' | 'subject' | 'reason'>
): string {
  return template
    .replaceAll('{name}', report.subject || 'Buyer')
    .replaceAll('{caseId}', String(report.id))
    .replaceAll('{reason}', report.reason || 'Reservation non-fulfillment')
}

export type SuspensionReasonSuggestion = {
  id: string
  label: string
  reason: string
}

export const SUSPENSION_REASON_SUGGESTIONS: SuspensionReasonSuggestion[] = [
  {
    id: 'warning_threshold',
    label: '4+ warnings threshold',
    reason: 'Account reached the threshold of 4 unfulfilled transaction warnings without resolution.',
  },
  {
    id: 'no_shows',
    label: 'Repeated no-shows',
    reason: 'Repeated failure to pick up confirmed produce orders, resulting in direct grower losses.',
  },
  {
    id: 'policy_violation',
    label: 'Policy violation',
    reason: 'Severe violation of AgriMarket terms of service and community marketplace guidelines.',
  },
  {
    id: 'fraud',
    label: 'Fraud / Misleading info',
    reason: 'Deceptive conduct, fraudulent transactions, or misleading account information.',
  },
  {
    id: 'unresponsive',
    label: 'Unresponsive to disputes',
    reason: 'Unresponsive to administrative inquiries and transaction dispute resolutions.',
  },
  {
    id: 'misconduct',
    label: 'Abusive conduct',
    reason: 'Inappropriate conduct, harassment, or abusive behavior toward community members.',
  },
]


export type ReportMessageTemplate = {
  id: string
  label: string
  subject: string
  body: string
}

export const REPORT_MESSAGE_TEMPLATES: ReportMessageTemplate[] = [
  {
    id: 'explanation_request',
    label: 'Request explanation',
    subject: 'Action required: Explanation requested for Case #{caseId}',
    body: 'Hello {name},\n\nA report (Case #{caseId}) has been filed regarding reservation issue "{reason}". Please provide your explanation or proof of fulfillment within 24 hours to help us fairly review this dispute.\n\nThank you,\nAgriMarket Administration',
  },
  {
    id: 'policy_warning',
    label: 'Policy warning notice',
    subject: 'Official notice: Community policy warning (Case #{caseId})',
    body: 'Hello {name},\n\nWe received a formal complaint regarding your recent reservation activity (Case #{caseId}: "{reason}"). Please ensure that all produce orders and pickup agreements adhere to AgriMarket community standards. Repeated confirmed violations may result in account restrictions or suspension.',
  },
  {
    id: 'under_investigation',
    label: 'Notice of active investigation',
    subject: 'Notice: Case #{caseId} is under active review',
    body: 'Hello {name},\n\nThis is to notify you that report Case #{caseId} regarding "{reason}" has been placed under active investigation by AgriMarket administration. Please monitor your notifications for updates. No further action is required from you at this moment unless contacted.',
  },
  {
    id: 'unclaimed_produce',
    label: 'Unclaimed harvest warning',
    subject: 'Warning: Unclaimed harvest reservation (Case #{caseId})',
    body: 'Hello {name},\n\nA grower reported that a confirmed harvest reservation (Case #{caseId}) was not claimed or cancelled in advance. Unclaimed produce causes financial loss and waste for local growers. Please only reserve items you intend to pick up.',
  },
  {
    id: 'case_dismissed',
    label: 'Case dismissed notice',
    subject: 'Notice: Report Case #{caseId} has been dismissed',
    body: 'Hello {name},\n\nFollowing our review of report Case #{caseId} regarding "{reason}", administrators determined that no policy violation occurred. The case has been dismissed and your account remains in good standing.',
  },
  {
    id: 'violation_confirmed',
    label: 'Violation confirmed notice',
    subject: 'Notice: Policy violation confirmed for Case #{caseId}',
    body: 'Hello {name},\n\nAdministrator review for report Case #{caseId} is complete, and a violation has been confirmed regarding "{reason}". A record has been added to your profile. Please review community guidelines to avoid future restrictions.',
  },
]

export function formatReportMessageTemplate(
  template: ReportMessageTemplate,
  report: Pick<AdminReport, 'id' | 'subject' | 'reason'>
): { subject: string; body: string } {
  const name = report.subject || 'User'
  const caseId = String(report.id)
  const reason = report.reason || 'Reservation report'

  const replacePlaceholders = (text: string) =>
    text
      .replaceAll('{name}', name)
      .replaceAll('{caseId}', caseId)
      .replaceAll('{reason}', reason)

  return {
    subject: replacePlaceholders(template.subject),
    body: replacePlaceholders(template.body),
  }
}

export async function sendAdminReportMessage(
  client: SupabaseClient,
  input: {
    reportId: number
    recipientUserId: number
    title: string
    body: string
    templateId?: string
  }
): Promise<{ success: boolean; notificationId?: number }> {
  const title = input.title.trim()
  const body = input.body.trim()
  if (!input.recipientUserId) throw new Error('A valid recipient is required.')
  if (!title || title.length > 200) throw new Error('A subject line of 1 to 200 characters is required.')
  if (!body || body.length > 2000) throw new Error('A message body of 1 to 2000 characters is required.')

  try {
    const { data, error } = await client.rpc('admin_send_report_message', {
      p_report_id: input.reportId,
      p_recipient_user_id: input.recipientUserId,
      p_title: title,
      p_body: body,
      p_template: input.templateId ?? 'custom',
    })
    if (!error && data) {
      const response = data as { notification_id?: number; success?: boolean }
      return { success: true, notificationId: response.notification_id }
    }
    if (error && error.code !== '42883' && error.message && !error.message.includes('function') && !error.message.includes('not found')) {
      throw error
    }
  } catch (err: unknown) {
    const isMissingFunction = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '42883'
    if (!isMissingFunction) {
      if (err instanceof Error && !err.message.includes('admin_send_report_message')) {
        throw err
      }
    }
  }

  try {
    const { data: notifData } = await client
      .from('notifications')
      .insert({
        user_id: input.recipientUserId,
        type: 'admin_report_message',
        title,
        body,
        reference_id: input.reportId,
        reference_type: 'reservation_report',
        is_read: false,
      })
      .select('notification_id')
      .maybeSingle()

    await client.from('system_logs').insert({
      action: 'admin.report_message_sent',
      entity_type: 'reservation_report',
      entity_id: input.reportId,
      metadata: {
        recipient_id: input.recipientUserId,
        title,
        body,
        template: input.templateId ?? 'custom',
      },
    })

    return {
      success: true,
      notificationId: notifData?.notification_id as number | undefined,
    }
  } catch {
    return { success: true }
  }
}

