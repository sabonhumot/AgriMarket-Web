import type { SupabaseClient } from '@supabase/supabase-js'

export type OverviewEvent = {
  id: string
  name: string
  date: string
  endDate: string | null
  time: string
  location: string
  status: string
  approvedFarmers: number
  farmerCount: number
  pendingApplications: number
}

export type EventManagerDashboard = {
  organizationName: string
  activeCount: number
  expectedFarmers: number
  completedCount: number
  pendingApplications: number
  events: OverviewEvent[]
}

const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export function mapEventManagerDashboard(value: unknown): EventManagerDashboard {
  const root = record(value)
  const profile = record(root.profile)
  const organization = record(profile.profile)
  const analytics = record(profile.analytics)
  const organizationName = String(organization.organization_name ?? '').trim() || 'AgriMarket Operations'
  const rows = Array.isArray(root.events) ? root.events : []
  const events = rows.map((value): OverviewEvent => {
    const row = record(value)
    return {
      id: String(row.id ?? row.market_event_id ?? ''),
      name: String(row.name ?? row.event_name ?? 'Market event'),
      date: String(row.date ?? row.event_date ?? ''),
      endDate: row.end_date == null ? null : String(row.end_date),
      time: String(row.time ?? ''),
      location: String(row.location ?? row.venue_name ?? 'Venue to be announced'),
      status: String(row.status ?? 'upcoming'),
      approvedFarmers: count(row.approved_farmers),
      farmerCount: count(row.farmer_count ?? row.farmer_slots ?? row.max_farmer_slots),
      pendingApplications: count(row.pending_applications),
    }
  }).sort((a, b) => a.date.localeCompare(b.date))

  return {
    organizationName,
    activeCount: count(root.upcoming_event_count),
    expectedFarmers: count(root.approved_farmer_count),
    completedCount: count(analytics.total_events),
    pendingApplications: count(root.pending_application_count),
    events,
  }
}

export async function loadEventManagerDashboard(client: SupabaseClient): Promise<EventManagerDashboard> {
  const { data, error } = await client.rpc('get_event_manager_dashboard')
  if (error) throw error
  return mapEventManagerDashboard(data)
}
