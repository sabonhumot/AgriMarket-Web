import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadEventManagerMedia } from './upload-media'

export type ManagerNotification = {
  id: number
  type: string
  title: string
  body: string
  referenceId: number | null
  referenceType: string | null
  isRead: boolean
  createdAt: string
}
export type ManagerProfile = {
  organizationName: string
  organizationType: 'organization' | 'lgu'
  logoPath: string | null
  contactName: string
  firstName: string
  middleName: string
  lastName: string
  managerContactNumber: string
  officialEmail: string
  officePhone: string
  municipalityKey: string
  street: string
  barangay: string
  city: string
  zipCode: string
  accountName: string
  accountEmail: string
}
export type ManagerFarmer = {
  id: string
  name: string
  profilePhotoPath: string | null
  farmName: string
  barangay: string
  municipality: string
  verified: boolean
  activeListings: number
  totalTransactions: number
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const string = (value: unknown) => String(value ?? '')
const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
async function rpc(client: SupabaseClient, name: string, args?: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return data as unknown
}

export function mapManagerNotification(value: unknown): ManagerNotification {
  const row = record(value)
  const referenceId = Number(row.reference_id)
  return {
    id: Number(row.notification_id),
    type: string(row.type),
    title: string(row.title) || 'Event update',
    body: string(row.body),
    referenceId: row.reference_id == null || !Number.isInteger(referenceId) ? null : referenceId,
    referenceType: row.reference_type == null ? null : string(row.reference_type),
    isRead: row.is_read === true,
    createdAt: string(row.created_at),
  }
}
export async function loadManagerNotifications(client: SupabaseClient): Promise<ManagerNotification[]> {
  const result = await rpc(client, 'get_event_manager_notifications')
  if (!Array.isArray(result)) throw new Error('Notifications returned an unexpected response.')
  return result.map(mapManagerNotification)
}
export async function markManagerNotificationRead(client: SupabaseClient, id: number) {
  await rpc(client, 'mark_event_manager_notification_read', { p_notification_id: id })
}
export async function markAllManagerNotificationsRead(client: SupabaseClient) {
  await rpc(client, 'mark_all_event_manager_notifications_read')
}
export function mapManagerProfile(value: unknown): ManagerProfile {
  const root = record(value)
  const profile = record(root.profile)
  const address = record(root.office_address)
  const user = record(root.user)
  return {
    organizationName: string(profile.organization_name),
    organizationType: profile.organization_type === 'lgu' ? 'lgu' : 'organization',
    logoPath: profile.organization_logo_path == null ? null : string(profile.organization_logo_path),
    contactName: string(profile.point_of_contact_name),
    firstName: string(user.first_name),
    middleName: string(user.middle_name),
    lastName: string(user.last_name),
    managerContactNumber: string(profile.manager_contact_number),
    officialEmail: string(profile.official_email),
    officePhone: string(profile.office_contact_number),
    municipalityKey: string(profile.municipality_key),
    street: string(address.street),
    barangay: string(address.barangay),
    city: string(address.city),
    zipCode: string(address.zip_code),
    accountName: [user.first_name, user.last_name].filter(Boolean).join(' '),
    accountEmail: string(user.email),
  }
}
export async function loadManagerProfile(client: SupabaseClient) {
  return mapManagerProfile(await rpc(client, 'get_event_manager_profile'))
}

export async function loadManagerProfileCompletion(client: SupabaseClient): Promise<boolean> {
  return (await rpc(client, 'is_my_event_manager_profile_complete')) === true
}
export async function saveManagerProfile(client: SupabaseClient, input: ManagerProfile) {
  return mapManagerProfile(await rpc(client, 'upsert_event_manager_profile', { p_input: {
    organization_name: input.organizationName.trim(),
    organization_type: input.organizationType,
    organization_logo_path: input.logoPath,
    point_of_contact_name: input.contactName.trim(),
    first_name: input.firstName.trim(),
    middle_name: input.middleName.trim(),
    last_name: input.lastName.trim(),
    manager_contact_number: input.managerContactNumber.trim(),
    official_email: input.officialEmail.trim(),
    office_contact_number: input.officePhone.trim(),
    municipality_key: input.municipalityKey.trim(),
    street: input.street.trim(),
    barangay: input.barangay.trim(),
    city: input.city.trim(),
    zip_code: input.zipCode.trim(),
  } }))
}
export async function uploadManagerLogo(client: SupabaseClient, file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Use a JPG or PNG image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Organization logos must be 5 MB or smaller.')
  const { data, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!data.user) throw new Error('Sign in again to upload the logo.')
  const path = data.user.id + '/organization/logo-' + Date.now() + '.' + (file.type === 'image/png' ? 'png' : 'jpg')
  const bucket = client.storage.from('event-manager-media')
  const uploadedPath = await uploadEventManagerMedia(client, path, file)
  try { await rpc(client, 'set_my_event_manager_logo', { p_logo_path: uploadedPath }) }
  catch (cause) { await bucket.remove([uploadedPath]); throw cause }
  return uploadedPath
}
export async function removeManagerLogo(client: SupabaseClient, profile: ManagerProfile) {
  if (!profile.logoPath) return { profile, storageError: null }
  const updated = await saveManagerProfile(client, { ...profile, logoPath: null })
  if (updated.logoPath) throw new Error('The profile photo could not be removed. Try again.')
  try {
    const { error } = await client.storage.from('event-manager-media').remove([profile.logoPath])
    return { profile: updated, storageError: error }
  } catch (cause) {
    return { profile: updated, storageError: cause }
  }
}
export function mapManagerFarmer(value: unknown): ManagerFarmer {
  const row = record(value)
  return {
    id: string(row.id), name: string(row.name) || 'Farmer', profilePhotoPath: row.profile_photo_path == null ? null : string(row.profile_photo_path), farmName: string(row.farm_name),
    barangay: string(row.barangay), municipality: string(row.municipality),
    verified: row.verified === true, activeListings: count(row.active_listings), totalTransactions: count(row.total_transactions),
  }
}
export async function loadManagerFarmers(client: SupabaseClient, query: string): Promise<ManagerFarmer[]> {
  const result = await rpc(client, 'get_event_manager_farmer_directory', { p_query: query.trim() || null })
  if (!Array.isArray(result)) throw new Error('The farmer directory returned an unexpected response.')
  return result.map(mapManagerFarmer)
}
