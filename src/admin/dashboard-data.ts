import type { SupabaseClient } from '@supabase/supabase-js'

export type DashboardUser = { user_id: number; role: string; user_status: string; created_at: string }
export type DashboardEvent = { market_event_id: number; event_name: string; status: string; event_date: string; end_date: string | null; end_time: string | null; coordinator_user_id: number | null; location: string | null }
export type DashboardInvitation = { invitation_id: number; account_user_id: number; expires_at: string; used_at: string | null; revoked_at: string | null }
export type DashboardData = { users: DashboardUser[]; totalUsers: number; events: DashboardEvent[]; invitations: DashboardInvitation[]; openReports: number; refreshedAt: string }

// Page every result set so statistics cannot silently stop at the API row limit.
async function readAll<T>(client: SupabaseClient, table: string, columns: string, key: string) {
  const rows: T[] = []
  let total = 0
  for (let offset = 0; ; offset += 500) {
    const result = await client.from(table).select(columns, { count: 'exact' }).order(key).range(offset, offset + 499)
    if (result.error) throw result.error
    total = result.count ?? 0
    rows.push(...(result.data ?? []) as T[])
    if (rows.length >= total || !result.data?.length) break
  }
  return { rows, total }
}

export async function loadDashboardData(client: SupabaseClient): Promise<DashboardData> {
  const [users, events, invitations, reports] = await Promise.all([
    readAll<DashboardUser>(client, 'users', 'user_id,role,user_status,created_at', 'user_id'),
    readAll<DashboardEvent>(client, 'market_events', 'market_event_id,event_name,status,event_date,end_date,end_time,coordinator_user_id,location', 'market_event_id'),
    readAll<DashboardInvitation>(client, 'event_manager_account_invitations', 'invitation_id,account_user_id,expires_at,used_at,revoked_at', 'invitation_id'),
    client.from('reservation_reports').select('report_id', { count: 'exact', head: true }).not('status', 'in', '(resolved,closed,dismissed)'),
  ])
  if (reports.error) throw reports.error
  return { users: users.rows, totalUsers: users.total, events: events.rows, invitations: invitations.rows.filter(invitation => !invitation.used_at && !invitation.revoked_at && new Date(invitation.expires_at).getTime() < Date.now()), openReports: reports.count ?? 0, refreshedAt: new Date().toISOString() }
}

export function activeEvents(events: DashboardEvent[], now: number) {
  return events.filter(event => event.status === 'published' && new Date(`${event.end_date || event.event_date}T${event.end_time || '23:59:59'}+08:00`).getTime() >= now)
}

export function registrationDays(users: DashboardUser[], days: number, now: number) {
  const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const buckets = Array.from({ length: days }, (_, index) => ({ date: dayKey(new Date(now - (days - 1 - index) * 86400000)), count: 0 }))
  const index = new Map(buckets.map(bucket => [bucket.date, bucket]))
  for (const user of users) {
    const date = new Date(user.created_at)
    if (!Number.isFinite(date.getTime()) || date.getTime() > now) continue
    const bucket = index.get(dayKey(date))
    if (bucket) bucket.count++
  }
  return buckets
}
