import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import AdminLogin from './AdminLogin'
import AdminWorkspace from './AdminWorkspace'
import { checkAdminAccess } from './admin-auth'
import { getSupabaseClient } from './supabase'

type Access = 'checking' | 'signed-out' | 'authorized' | 'error'

export default function AdminRoute() {
  const [access, setAccess] = useState<Access>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let subscription: { unsubscribe: () => void } | undefined

    async function refresh() {
      try {
        const client = getSupabaseClient()
        const { data: sessionData, error: sessionError } = await client.auth.getSession()
        if (sessionError) throw sessionError
        if (!sessionData.session) {
          if (active) {
            setAccess('signed-out')
            setError(null)
          }
          return
        }
        const allowed = await checkAdminAccess(client)
        if (!active) return
        if (!allowed) {
          await client.auth.signOut({ scope: 'local' })
          if (!active) return
        }
        setAccess(allowed ? 'authorized' : 'signed-out')
        setError(null)
      } catch (cause) {
        if (!active) return
        setAccess('error')
        setError(cause instanceof Error ? cause.message : 'Unable to check administrator access.')
      }
    }

    try {
      const client = getSupabaseClient()
      subscription = client.auth.onAuthStateChange(() => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => { if (active) void refresh() }, 0)
      }).data.subscription
      void refresh()
    } catch (cause) {
      timer = setTimeout(() => {
        if (!active) return
        setAccess('error')
        setError(cause instanceof Error ? cause.message : 'Unable to start administrator sign-in.')
      }, 0)
    }
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      subscription?.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const client = getSupabaseClient()
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw new Error('Email or password is incorrect. Please try again.')
    try {
      if (!(await checkAdminAccess(client))) {
        await client.auth.signOut({ scope: 'local' })
        throw new Error('This account does not have active administrator access.')
      }
      setError(null)
      setAccess('authorized')
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'This account does not have active administrator access.') throw cause
      await client.auth.signOut({ scope: 'local' })
      throw new Error('Administrator access could not be verified. Please try again.', { cause })
    }
  }

  async function signOut() {
    const client = getSupabaseClient()
    const { error: signOutError } = await client.auth.signOut({ scope: 'local' })
    if (signOutError) throw new Error('Sign-out failed. Please try again.', { cause: signOutError })
    setAccess('signed-out')
    toast.success('Signed out of the admin portal')
  }

  if (access === 'checking') return <main className="admin-access-check" role="status">Checking administrator access…</main>
  if (access === 'authorized') return <AdminWorkspace onSignOut={signOut} />
  return <AdminLogin onSignIn={signIn} initialError={error} />
}
