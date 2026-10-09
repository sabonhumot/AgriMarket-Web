import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminUser = {
  id: number
  name: string
  email: string
  role: string
  status: string
  createdAt: string
}

export type AdminApplication = {
  id: string
  kind: 'Farmer verification' | 'Event application'
  title: string
  applicant: string
  status: string
  submittedAt: string
  detail: string | null
}

export type AdminReport = {
  id: number
  reporter: string
  subject: string
  reason: string
  description: string | null
  status: string
  outcome: string | null
  createdAt: string
}

export type AdminActivity = {
  id: number
  actor: string
  action: string
  entityType: string
  entityId: number | null
  createdAt: string
}

export type AdminMarketplaceReview = {
  profileId: number
  userId: number
  farmerName: string
  email: string
  mobile: string
  farmName: string
  farmDescription: string
  municipality: string
  barangay: string
  landmark: string
  profilePhotoUrl: string | null
  status: 'not_submitted' | 'pending_review' | 'approved' | 'changes_requested'
  submittedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  notes: string | null
  history: Array<{ decision: string; notes: string | null; actor: string; createdAt: string }>
}

export type AdminData = {
  users: AdminUser[]
  applications: AdminApplication[]
  reports: AdminReport[]
  activity: AdminActivity[]
  marketplaceReviews: AdminMarketplaceReview[]
}

type UserRow = { user_id: number; first_name: string | null; last_name: string | null; email: string | null; mobile: string | null; role: string; user_status: string; created_at: string }
type FarmerProfileRow = { farmer_profile_id: number; user_id: number; farm_name: string | null; farm_description: string | null; farm_municipality: string | null; farm_barangay: string | null; farm_landmark: string | null; profile_photo_path: string | null; marketplace_review_status: AdminMarketplaceReview['status']; marketplace_review_submitted_at: string | null; marketplace_reviewed_by: number | null; marketplace_reviewed_at: string | null; marketplace_review_notes: string | null }
type VerificationRow = { verification_id: number; user_id: number; review_status: string; processing_status: string; submitted_at: string | null; review_notes: string | null }
type EventApplicationRow = { application_id: number; farmer_id: number; market_event_id: number; status: string; created_at: string; rejection_reason: string | null }
type EventRow = { market_event_id: number; event_name: string }
type ReportRow = { report_id: number; reporter_id: number | null; reported_user_id: number | null; reason: string; reporter_description: string | null; status: string; resolution_outcome: string | null; created_at: string }
type ActivityRow = { system_log_id: number; actor_id: number | null; action: string; entity_type: string; entity_id: number | null; created_at: string; metadata: Record<string, unknown> | null }

function nameOf(user: UserRow | undefined): string {
  if (!user) return 'Unknown user'
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || `User #${user.user_id}`
}

export async function loadAdminData(client: SupabaseClient): Promise<AdminData> {
  const responses = await Promise.all([
    client.from('users').select('user_id, first_name, last_name, email, mobile, role, user_status, created_at'),
    client.rpc('admin_list_farmer_verifications'),
    client.from('market_event_applications').select('application_id, farmer_id, market_event_id, status, created_at, rejection_reason'),
    client.from('market_events').select('market_event_id, event_name'),
    client.from('reservation_reports').select('report_id, reporter_id, reported_user_id, reason, reporter_description, status, resolution_outcome, created_at'),
    client.from('system_logs').select('system_log_id, actor_id, action, entity_type, entity_id, created_at, metadata'),
    client.from('farmer_profiles').select('farmer_profile_id, user_id, farm_name, farm_description, farm_municipality, farm_barangay, farm_landmark, profile_photo_path, marketplace_review_status, marketplace_review_submitted_at, marketplace_reviewed_by, marketplace_reviewed_at, marketplace_review_notes'),
  ])
  for (const response of responses) if (response.error) throw response.error

  const [users, verifications, eventApplications, events, reports, activity, profiles] = responses.map((response) => response.data ?? []) as unknown as [
    UserRow[], VerificationRow[], EventApplicationRow[], EventRow[], ReportRow[], ActivityRow[], FarmerProfileRow[],
  ]
  const people = new Map(users.map((user) => [user.user_id, user]))
  const eventNames = new Map(events.map((event) => [event.market_event_id, event.event_name]))
  const marketplaceReviews: AdminMarketplaceReview[] = profiles.map((profile) => {
    const user = people.get(profile.user_id)
    const history = activity
      .filter((entry) => entry.entity_type === 'farmer_profile' && entry.entity_id === profile.farmer_profile_id && entry.action === 'farmer.marketplace_reviewed')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((entry) => ({
        decision: String(entry.metadata?.decision ?? 'reviewed'),
        notes: typeof entry.metadata?.notes === 'string' ? entry.metadata.notes : null,
        actor: nameOf(people.get(entry.actor_id ?? -1)),
        createdAt: entry.created_at,
      }))
    return {
      profileId: profile.farmer_profile_id,
      userId: profile.user_id,
      farmerName: nameOf(user),
      email: user?.email ?? '',
      mobile: user?.mobile ?? '',
      farmName: profile.farm_name ?? '',
      farmDescription: profile.farm_description ?? '',
      municipality: profile.farm_municipality ?? '',
      barangay: profile.farm_barangay ?? '',
      landmark: profile.farm_landmark ?? '',
      profilePhotoUrl: profile.profile_photo_path
        ? client.storage.from('profile-images').getPublicUrl(profile.profile_photo_path).data.publicUrl
        : null,
      status: profile.marketplace_review_status,
      submittedAt: profile.marketplace_review_submitted_at ?? '',
      reviewedAt: profile.marketplace_reviewed_at,
      reviewedBy: profile.marketplace_reviewed_by == null ? null : nameOf(people.get(profile.marketplace_reviewed_by)),
      notes: profile.marketplace_review_notes,
      history,
    }
  }).filter((profile) => profile.status !== 'not_submitted').sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const applications: AdminApplication[] = [
    ...verifications.map((row) => ({
      id: `verification-${row.verification_id}`,
      kind: 'Farmer verification' as const,
      title: 'Farmer identity verification',
      applicant: nameOf(people.get(row.user_id)),
      status: row.review_status,
      submittedAt: row.submitted_at ?? '',
      detail: row.review_notes,
    })),
    ...eventApplications.map((row) => ({
      id: `event-${row.application_id}`,
      kind: 'Event application' as const,
      title: eventNames.get(row.market_event_id) ?? `Event #${row.market_event_id}`,
      applicant: nameOf(people.get(row.farmer_id)),
      status: row.status,
      submittedAt: row.created_at,
      detail: row.rejection_reason,
    })),
  ].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  return {
    users: users.map((row) => ({
      id: row.user_id,
      name: nameOf(row),
      email: row.email ?? '',
      role: row.role,
      status: row.user_status,
      createdAt: row.created_at,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    applications,
    reports: reports.map((row) => ({
      id: row.report_id,
      reporter: nameOf(people.get(row.reporter_id ?? -1)),
      subject: nameOf(people.get(row.reported_user_id ?? -1)),
      reason: row.reason,
      description: row.reporter_description,
      status: row.status,
      outcome: row.resolution_outcome,
      createdAt: row.created_at,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    activity: activity.map((row) => ({
      id: row.system_log_id,
      actor: nameOf(people.get(row.actor_id ?? -1)),
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    marketplaceReviews,
  }
}
