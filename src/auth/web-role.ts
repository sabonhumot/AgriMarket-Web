import type { SupabaseClient } from '@supabase/supabase-js'

export type WebRole = 'admin' | 'event_manager'

export async function getWebRole(client: SupabaseClient): Promise<WebRole | null> {
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!auth.user) return null

  const { data: account, error: accountError } = await client
    .from('users')
    .select('role,user_status')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  if (accountError) throw accountError
  if (account?.user_status !== 'active') return null
  if (account.role === 'admin') return 'admin'
  if (account.role === 'coordinator') return 'event_manager'
  return null
}

export function webRolePath(role: WebRole) {
  return role === 'admin' ? '/admin' : '/event-manager'
}
