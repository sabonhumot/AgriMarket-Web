import type { SupabaseClient } from '@supabase/supabase-js'

export type WebRole = 'admin' | 'event_manager'
export type WebAccount = { name: string; email: string; role: WebRole }

export async function getWebAccount(client: SupabaseClient): Promise<WebAccount | null> {
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!auth.user) return null

  const { data: account, error: accountError } = await client
    .from('users')
    .select('first_name,last_name,email,role,user_status')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  if (accountError) throw accountError
  if (account?.user_status !== 'active') return null

  const role = account.role === 'admin' ? 'admin' : account.role === 'coordinator' ? 'event_manager' : null
  if (!role) return null
  const name = [account.first_name, account.last_name].filter(Boolean).join(' ').trim() || account.email || auth.user.email || 'Account'
  return { name, email: account.email || auth.user.email || '', role }
}

export async function getWebRole(client: SupabaseClient): Promise<WebRole | null> {
  return (await getWebAccount(client))?.role ?? null
}

export function webRolePath(role: WebRole) {
  return role === 'admin' ? '/admin' : '/event-manager'
}
