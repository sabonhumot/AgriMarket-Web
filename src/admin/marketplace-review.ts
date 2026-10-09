import type { SupabaseClient } from '@supabase/supabase-js'

const bucket = 'farmer-verifications'
const signedUrlTtlSeconds = 300

export async function loadFaceCaptureUrl(client: SupabaseClient, profileId: number): Promise<string | null> {
  const { data: path, error: pathError } = await client.rpc('get_farmer_marketplace_face_capture', { p_farmer_profile_id: profileId })
  if (pathError) throw pathError
  if (!path) return null
  if (!/^[0-9a-f-]+\/face-scan\/front\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(path)) {
    throw new Error('The stored face capture path is not valid.')
  }
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, signedUrlTtlSeconds)
  if (error) throw error
  return data.signedUrl
}

export async function reviewFarmerMarketplaceProfile(
  client: SupabaseClient,
  profileId: number,
  submittedAt: string,
  decision: 'approved' | 'changes_requested',
  notes: string,
): Promise<void> {
  const { error } = await client.rpc('review_farmer_marketplace_profile', {
    p_farmer_profile_id: profileId,
    p_decision: decision,
    p_notes: notes.trim() || null,
    p_submitted_at: submittedAt,
  })
  if (error) throw error
}
