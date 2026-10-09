import type { SupabaseClient } from '@supabase/supabase-js'

export async function checkAdminAccess(client: SupabaseClient): Promise<boolean> {
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!auth.user) return false

  const { data: account, error: accountError } = await client
    .from('users')
    .select('role, user_status')
    .eq('auth_id', auth.user.id)
    .maybeSingle()

  if (accountError) throw accountError
  return account?.role === 'admin' && account.user_status === 'active'
}
