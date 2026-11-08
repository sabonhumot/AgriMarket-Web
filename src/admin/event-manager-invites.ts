import type { SupabaseClient } from '@supabase/supabase-js'

export type InviteHandoff = { userId: number; url: string; expiresAt: string; recipient: string; emailSent: boolean; emailError?: string }
export type CreateManagerInput = {
  firstName: string; lastName: string; email: string; organizationName: string
  organizationType: 'organization' | 'lgu'; pointOfContact: string
  officialEmail: string; officeContact: string; municipality: string
}

async function callInviteFunction(client: SupabaseClient, body: Record<string, unknown>): Promise<InviteHandoff | { success: true }> {
  const { data, error } = await client.functions.invoke('admin-event-manager-invites', { body })
  if (error) {
    const response = 'context' in error ? error.context : null
    if (response instanceof Response) {
      const details = await response.json().catch(() => null) as { error?: string; message?: string; code?: string } | null
      if (response.status === 404 || details?.code === 'NOT_FOUND')
        throw new Error('The invitation service is not deployed to this Supabase project yet.')
      throw new Error(details?.error || details?.message || `Invitation service returned HTTP ${response.status}. Please try again.`)
    }
    throw new Error('Could not reach the invitation service. It may not be deployed to this Supabase project, or its browser access may be blocked.')
  }
  if (!data || typeof data !== 'object') throw new Error('The invitation service returned an invalid response.')
  return data as InviteHandoff | { success: true }
}

export async function createManagerInvite(client: SupabaseClient, input: CreateManagerInput): Promise<InviteHandoff> {
  const result = await callInviteFunction(client, { action: 'create', ...input })
  if (!('url' in result)) throw new Error('The invitation link was not returned.')
  return result
}

export async function regenerateManagerInvite(client: SupabaseClient, userId: number): Promise<InviteHandoff> {
  const result = await callInviteFunction(client, { action: 'regenerate', userId })
  if (!('url' in result)) throw new Error('The invitation link was not returned.')
  return result
}

export async function completeManagerInvite(client: SupabaseClient, generationId: string, password: string) {
  const result = await callInviteFunction(client, { action: 'complete', generationId, password })
  if (!('success' in result) || !result.success) throw new Error('Account setup could not finish.')
}
