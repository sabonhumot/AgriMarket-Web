import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import AdminLogin from '../admin/AdminLogin'
import AdminWorkspace from '../admin/AdminWorkspace'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerOverview from '../event-manager/EventManagerOverview'
import EventManagerEvents from '../event-manager/EventManagerEvents'
import EventManagerEventForm from '../event-manager/EventManagerEventForm'
import EventManagerEventDetail from '../event-manager/EventManagerEventDetail'
import EventManagerNotifications from '../event-manager/EventManagerNotifications'
import EventManagerProfile from '../event-manager/EventManagerProfile'
import EventManagerFarmers from '../event-manager/EventManagerFarmers'
import { getWebRole, webRolePath, type WebRole } from './web-role'
import brandLogo from '../assets/AgriMarket.svg'
import './WebAccessScreen.css'

type Access = 'checking' | 'guest' | 'error' | WebRole

export type WebPath = '/login' | '/admin' | '/event-manager' | '/event-manager/events' | '/event-manager/events/new' | '/event-manager/notifications' | '/event-manager/profile' | '/event-manager/farmers' | `/event-manager/events/${string}`

export default function WebRoute({ path }: { path: WebPath }) {
  const [access, setAccess] = useState<Access>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function check() {
      try {
        const client = getSupabaseClient()
        const { data: sessionData, error: sessionError } = await client.auth.getSession()
        if (sessionError) throw sessionError
        if (!sessionData.session) {
          if (!active) return
          setAccess('guest')
          if (path !== '/login') window.location.replace('/login')
          return
        }
        const role = await getWebRole(client)
        if (!active) return
        if (!role) {
          const { data: pending } = await client.from('users').select('role,user_status').eq('auth_id', sessionData.session.user.id).maybeSingle()
          if (pending?.role === 'coordinator' && pending.user_status === 'pending_verification') {
            window.location.replace('/invite/accept')
            return
          }
          await client.auth.signOut({ scope: 'local' })
          if (!active) return
          setAccess('guest')
          setError('This account does not have active web workspace access.')
          if (path !== '/login') window.location.replace('/login')
          return
        }
        setAccess(role)
        const allowedManagerPath = role === 'event_manager' && path.startsWith('/event-manager')
        if (!allowedManagerPath && path !== webRolePath(role)) window.location.replace(webRolePath(role))
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Unable to check account access.')
        setAccess('error')
      }
    }
    void check()
    return () => { active = false }
  }, [path])

  async function signIn(email: string, password: string) {
    const client = getSupabaseClient()
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw new Error('Email or password is incorrect. Please try again.')
    try {
      const role = await getWebRole(client)
      if (!role) {
        const { data: auth } = await client.auth.getUser()
        if (auth.user) {
          const { data: pending } = await client.from('users').select('role,user_status').eq('auth_id', auth.user.id).maybeSingle()
          if (pending?.role === 'coordinator' && pending.user_status === 'pending_verification') {
            window.location.assign('/invite/accept')
            return
          }
        }
        await client.auth.signOut({ scope: 'local' })
        throw new Error('This account does not have active web workspace access.')
      }
      setAccess(role)
      window.location.assign(webRolePath(role))
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'This account does not have active web workspace access.') throw cause
      await client.auth.signOut({ scope: 'local' })
      throw new Error('Account access could not be verified. Please try again.', { cause })
    }
  }

  async function signOut() {
    const { error: signOutError } = await getSupabaseClient().auth.signOut({ scope: 'local' })
    if (signOutError) throw new Error('Sign-out failed. Please try again.', { cause: signOutError })
    setAccess('guest')
    toast.success('Signed out of AgriMarket')
    window.location.assign('/login')
  }

  const allowedManagerPath = access === 'event_manager' && path.startsWith('/event-manager')
  if (access === 'checking' || (access === 'guest' && path !== '/login') || (access === 'admin' && path !== '/admin') || (access === 'event_manager' && !allowedManagerPath)) {
    return <main className="web-access-screen" role="status" aria-live="polite">
      <div className="web-access-content">
        <img className="web-access-logo" src={brandLogo} alt="AgriMarket" width="666" height="375" />
        <div className="web-access-progress" aria-hidden="true"><span /></div>
        <span className="web-access-sr-only">Opening AgriMarket…</span>
      </div>
    </main>
  }
  if (access === 'admin') return <AdminWorkspace onSignOut={signOut} />
  if (access === 'event_manager') {
    const edit = path.match(/^\/event-manager\/events\/([^/]+)\/edit$/)
    const detail = path.match(/^\/event-manager\/events\/([^/]+)$/)
    if (path === '/event-manager/events/new') return <EventManagerEventForm onSignOut={signOut} />
    if (path === '/event-manager/notifications') return <EventManagerNotifications onSignOut={signOut} />
    if (path === '/event-manager/profile') return <EventManagerProfile onSignOut={signOut} />
    if (path === '/event-manager/farmers') return <EventManagerFarmers onSignOut={signOut} />
    if (edit) return <EventManagerEventForm eventId={decodeURIComponent(edit[1])} onSignOut={signOut} />
    if (detail) return <EventManagerEventDetail eventId={decodeURIComponent(detail[1])} onSignOut={signOut} />
    if (path === '/event-manager/events') return <EventManagerEvents onSignOut={signOut} />
    if (path === '/event-manager') return <EventManagerOverview onSignOut={signOut} />
    window.history.replaceState({}, '', '/event-manager')
    return <EventManagerOverview onSignOut={signOut} />
  }
  if (access === 'error' && path !== '/login') return <main className="admin-access-check"><div role="alert"><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div></main>
  return <AdminLogin onSignIn={signIn} initialError={error} />
}
