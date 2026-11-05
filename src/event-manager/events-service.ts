import type { SupabaseClient } from '@supabase/supabase-js'

export type ManagerEventInput = {
  name: string
  type: 'Regular Market Day' | 'Special Event' | 'Pop-Up Market'
  description: string
  date: string
  endDate: string
  startTime: string
  endTime: string
  location: string
  venueName: string
  venueBarangay: string
  venueCity: string
  municipalityKey: string
  farmerCount: number
  applicationDeadline: string
  eligibilityScope: 'municipality' | 'cebu'
  joinMode: 'applications_and_invites' | 'invite_only'
  farmerInstructions: string
  mapLatitude: number | null
  mapLongitude: number | null
  coverPhotoPath: string | null
  status: 'draft' | 'published'
}

export type ManagerEvent = Omit<ManagerEventInput, 'status'> & {
  id: string
  status: string
  databaseStatus: string
  approvedFarmers: number
  pendingApplications: number
  checkedInFarmers: number
  completedSalesValue: number
}

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0

export function mapManagerEvent(value: unknown): ManagerEvent {
  const row = asRecord(value)
  const date = String(row.date ?? row.event_date ?? '')
  const endDate = String(row.end_date ?? row.endDate ?? date)
  const status = String(row.database_status ?? row.status ?? 'published').toLowerCase()
  return {
    id: String(row.id ?? row.market_event_id ?? ''),
    name: String(row.name ?? row.event_name ?? 'Market event'),
    type: String(row.type ?? row.event_type ?? row.category ?? 'Regular Market Day') as ManagerEvent['type'],
    description: String(row.description ?? ''),
    date,
    endDate,
    startTime: String(row.start_time ?? String(row.time ?? '').split(/\s+-\s+/)[0] ?? ''),
    endTime: String(row.end_time ?? String(row.time ?? '').split(/\s+-\s+/)[1] ?? ''),
    location: String(row.location ?? row.venue_name ?? ''),
    venueName: String(row.venue_name ?? row.location ?? ''),
    venueBarangay: String(row.venue_barangay ?? ''),
    venueCity: String(row.venue_city ?? row.municipality_key ?? ''),
    municipalityKey: String(row.municipality_key ?? row.venue_city ?? ''),
    farmerCount: count(row.farmer_count ?? row.expected_farmer_count ?? row.max_farmer_slots),
    applicationDeadline: String(row.application_deadline ?? ''),
    eligibilityScope: row.farmer_eligibility_scope === 'cebu' ? 'cebu' : 'municipality',
    joinMode: row.farmer_join_mode === 'invite_only' ? 'invite_only' : 'applications_and_invites',
    farmerInstructions: String(row.farmer_instructions ?? row.logistics_note ?? ''),
    mapLatitude: row.map_latitude == null ? null : Number(row.map_latitude),
    mapLongitude: row.map_longitude == null ? null : Number(row.map_longitude),
    coverPhotoPath: row.cover_photo_path == null ? null : String(row.cover_photo_path),
    status,
    databaseStatus: status,
    approvedFarmers: count(row.approved_farmers),
    pendingApplications: count(row.pending_applications),
    checkedInFarmers: count(row.checked_in_farmers),
    completedSalesValue: count(row.completed_sales_value),
  }
}

async function call<T>(client: SupabaseClient, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return data as T
}

function toRpcInput(input: ManagerEventInput) {
  return {
    event_name: input.name.trim(), event_type: input.type, category: input.type, description: input.description.trim(),
    event_date: input.date, end_date: input.endDate || input.date, start_time: input.startTime, end_time: input.endTime,
    location: input.location.trim(), venue_name: input.venueName.trim(), venue_barangay: input.venueBarangay.trim(),
    venue_city: input.venueCity.trim(), municipality_key: input.municipalityKey.trim() || input.venueCity.trim(),
    expected_farmer_count: input.farmerCount, max_farmer_slots: input.farmerCount,
    application_deadline: input.applicationDeadline || null, farmer_eligibility_scope: input.eligibilityScope,
    farmer_join_mode: input.joinMode, farmer_instructions: input.farmerInstructions.trim(), logistics_note: input.farmerInstructions.trim(),
    map_latitude: input.mapLatitude, map_longitude: input.mapLongitude, cover_photo_path: input.coverPhotoPath, status: input.status,
  }
}

export function loadManagedEvent(client: SupabaseClient, eventId: string) {
  return call<Record<string, unknown>>(client, 'get_managed_event_details', { p_event_id: Number(eventId) }).then((value) => ({
    ...value,
    event: mapManagerEvent(value?.event ?? {}),
    applications: Array.isArray(value?.applications) ? value.applications : [],
    invite_links: Array.isArray(value?.invite_links) ? value.invite_links : [],
    invitations: Array.isArray(value?.invitations) ? value.invitations : [],
    summary: asRecord(value?.summary),
    performance: asRecord(value?.performance),
  }))
}

export async function createManagedEvent(client: SupabaseClient, input: ManagerEventInput) {
  return mapManagerEvent(await call(client, 'create_my_market_event', { p_input: toRpcInput(input) }))
}

export async function updateManagedEvent(client: SupabaseClient, eventId: string, input: ManagerEventInput) {
  return mapManagerEvent(await call(client, 'update_my_market_event', { p_event_id: Number(eventId), p_input: toRpcInput(input) }))
}

export async function publishManagedEvent(client: SupabaseClient, eventId: string) {
  return mapManagerEvent(await call(client, 'publish_my_market_event', { p_event_id: Number(eventId) }))
}

export const reviewApplication = (client: SupabaseClient, applicationId: number, decision: 'approved' | 'rejected', reason?: string) => call(client, 'review_event_application', { p_application_id: applicationId, p_decision: decision, p_reason: reason ?? null })
export const createInviteLink = (client: SupabaseClient, eventId: string) => call<Record<string, unknown>>(client, 'create_event_invite_link', { p_event_id: Number(eventId) })
export const loadEligibleFarmers = (client: SupabaseClient, eventId: string, query: string) => call<Record<string, unknown>[]>(client, 'get_event_eligible_farmer_directory', { p_event_id: Number(eventId), p_query: query || null })
export const inviteFarmers = (client: SupabaseClient, eventId: string, farmerIds: number[]) => call<{ sent: number; skipped: number }>(client, 'send_direct_event_invitations', { p_event_id: Number(eventId), p_farmer_ids: farmerIds })
export const markNoShow = (client: SupabaseClient, applicationId: number) => call(client, 'mark_event_farmer_no_show', { p_application_id: applicationId })
export const checkInFarmer = (client: SupabaseClient, eventId: string, qrData: string) => call<Record<string, unknown>>(client, 'check_in_event_farmer', { p_event_id: Number(eventId), p_qr_data: qrData })
export const sendBroadcast = (client: SupabaseClient, eventId: string, message: string) => call(client, 'send_event_broadcast', { p_event_id: Number(eventId), p_message: message })
export const promoteEvent = (client: SupabaseClient, eventId: string, message: string) => call(client, 'promote_event_to_nearby_buyers', { p_event_id: Number(eventId), p_message: message })
export const cancelEvent = (client: SupabaseClient, eventId: string, reason: string, notes: string) => call(client, 'cancel_my_market_event', { p_event_id: Number(eventId), p_reason: reason, p_notes: notes || null })
export const loadEventPerformance = (client: SupabaseClient, eventId: string) => call<Record<string, unknown>>(client, 'get_event_performance', { p_event_id: Number(eventId) })
export const loadAttendance = (client: SupabaseClient, eventId: string) => call<Record<string, unknown>[]>(client, 'export_event_attendance', { p_event_id: Number(eventId) })
export const loadSalesSummary = (client: SupabaseClient, eventId: string) => call<Record<string, unknown>[]>(client, 'export_event_sales_summary', { p_event_id: Number(eventId) })

export function recordsToCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  return [columns.map(cell).join(','), ...rows.map((row) => columns.map((column) => cell(row[column])).join(','))].join('\r\n')
}
