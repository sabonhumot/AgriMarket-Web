import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { getWebAccount } from '../auth/web-role'
import { getSupabaseClient } from '../admin/supabase'
import brandLogo from '../assets/AgriMarket.svg'
import { navigateWeb } from '../auth/web-navigation'
import { loadManagerProfile, loadManagerProfileCompletion, type ManagerProfile } from './manager-service'
import SignOutConfirmation from '../components/SignOutConfirmation'
import './EventManagerOverview.css'
import './EventManagerWorkspace.css'
import './EventManagerSidebar.css'
import './EventManagerAdminParity.css'

type IconName = 'grid' | 'calendar' | 'bell' | 'people' | 'person' | 'logout'
const paths: Record<IconName, string> = {
  grid: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h3 M8 18h6',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9z M10 21h4',
  people: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-2a7 7 0 0 1 14 0v2z M17 5a4 4 0 0 1 0 7 M18 15a6 6 0 0 1 4 6',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21v-2a8 8 0 0 1 16 0v2z',
  logout: 'M9 4H4v16h5 M14 8l4 4-4 4 M9 12h9',
}
function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

type Props = {
  active: 'overview' | 'events' | 'notifications' | 'farmers' | 'profile'
  organizationName?: string
  profile?: ManagerProfile | null
  onSignOut?: () => void | Promise<void>
}

type SidebarAccount = { name: string; email: string; logoPath: string | null }
let cachedSidebarAccount: SidebarAccount | null = null

export default function EventManagerSidebar({ active, profile, onSignOut }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [account, setAccount] = useState<SidebarAccount | null>(cachedSidebarAccount)
  const [accountLoading, setAccountLoading] = useState(!cachedSidebarAccount)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)
  const email = profile?.accountEmail || account?.email || ''
  const name = profile?.accountName || account?.name || email.split('@')[0] || 'Account unavailable'
  const showAccountSkeleton = !profile?.accountEmail && accountLoading
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('')
  const logoPath = profile ? profile.logoPath : account?.logoPath
  const photoUrl = logoPath ? getSupabaseClient().storage.from('event-manager-media').getPublicUrl(logoPath).data.publicUrl : ''

  useEffect(() => {
    let active = true
    const checkCompletion = () => {
      void loadManagerProfileCompletion(getSupabaseClient()).then((complete) => {
        if (active) setProfileComplete(complete)
      }).catch(() => { if (active) setProfileComplete(null) })
    }
    checkCompletion()
    window.addEventListener('event-manager-profile-changed', checkCompletion)
    const loadAccount = async () => {
      try {
        const value = await loadManagerProfile(getSupabaseClient())
        if (active) {
          cachedSidebarAccount = { name: value.accountName, email: value.accountEmail, logoPath: value.logoPath }
          setAccount(cachedSidebarAccount)
        }
      } catch {
        try {
          const value = await getWebAccount(getSupabaseClient())
          if (active && value?.role === 'event_manager') {
            cachedSidebarAccount = { ...value, logoPath: null }
            setAccount(cachedSidebarAccount)
          }
        } catch { /* Keep the account area available without blocking navigation. */ }
      } finally { if (active) setAccountLoading(false) }
    }
    void loadAccount()
    window.addEventListener('event-manager-profile-changed', loadAccount)
    return () => { active = false; window.removeEventListener('event-manager-profile-changed', checkCompletion); window.removeEventListener('event-manager-profile-changed', loadAccount) }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !confirmSignOut) { setIsOpen(false); menuButton.current?.focus() }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, confirmSignOut])

  function openPage(event: MouseEvent<HTMLAnchorElement>, path: string) {
    setIsOpen(false)
    navigateWeb(event, path)
  }

  async function signOut() {
    if (!onSignOut || signingOut) return
    setSigningOut(true)
    setSignOutError(null)
    try { await onSignOut(); cachedSidebarAccount = null; setConfirmSignOut(false) }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Sign-out failed. Please try again.'; setSignOutError(message); toast.error('Sign-out failed.', { description: message }) }
    finally { setSigningOut(false) }
  }

  return <>
    <button ref={menuButton} className="em-menu-button" type="button" aria-expanded={isOpen} aria-controls="event-manager-navigation" onClick={() => setIsOpen((open) => !open)}><span aria-hidden="true" /><span>{isOpen ? 'Close' : 'Menu'}</span></button>
    <button className="em-sidebar-scrim" type="button" aria-label="Close Event Manager navigation" aria-hidden={!isOpen} tabIndex={isOpen ? 0 : -1} inert={!isOpen} data-open={isOpen} onClick={() => setIsOpen(false)} />
    <aside className={'em-sidebar' + (isOpen ? ' is-open' : '')}>
      <div className="em-sidebar-brand"><a className="em-brand" href="/" aria-label="Return to AgriMarket public site"><img src={brandLogo} alt="AgriMarket" /></a></div>
      <nav id="event-manager-navigation" aria-label="Event Manager navigation">
        <span className="em-nav-group-label">Workspace</span>
        <a className={active === 'overview' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager" onClick={(event) => openPage(event, '/event-manager')} aria-current={active === 'overview' ? 'page' : undefined}><Icon name="grid" /><span>Dashboard</span></a>
        <a className={active === 'events' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager/events" onClick={(event) => openPage(event, '/event-manager/events')} aria-current={active === 'events' ? 'page' : undefined}><Icon name="calendar" /><span>Events</span></a>
        <a className={active === 'notifications' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager/notifications" onClick={(event) => openPage(event, '/event-manager/notifications')} aria-current={active === 'notifications' ? 'page' : undefined}><Icon name="bell" /><span>Notifications</span></a>
        <a className={active === 'farmers' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager/farmers" onClick={(event) => openPage(event, '/event-manager/farmers')} aria-current={active === 'farmers' ? 'page' : undefined}><Icon name="people" /><span>Farmers</span></a>
        <div className="em-nav-divider"><span className="em-nav-group-label">Account</span><a className={active === 'profile' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager/profile" onClick={(event) => openPage(event, '/event-manager/profile')} aria-current={active === 'profile' ? 'page' : undefined}><Icon name="person" /><span>Profile</span>{profileComplete === false && <span className="em-profile-incomplete-badge">Incomplete</span>}</a></div>
      </nav>
      <div className="em-sidebar-bottom">
        <div className="em-sidebar-user" aria-busy={showAccountSkeleton}>{showAccountSkeleton ? <><div className="em-user-avatar em-sidebar-skeleton-avatar" aria-hidden="true" /><div className="em-sidebar-skeleton-lines" aria-hidden="true"><span /><span /></div><span className="em-sr-only">Loading account details</span></> : <><div className="em-user-avatar" aria-hidden="true">{photoUrl ? <img src={photoUrl} alt="" /> : initials}</div><div><strong title={name}>{name}</strong><span title={email}>{email || 'Profile details unavailable'}</span></div></>}</div>
        {onSignOut && <button type="button" onClick={() => { setSignOutError(null); setConfirmSignOut(true) }} disabled={signingOut}><Icon name="logout" size={18} />Sign out</button>}
      </div>
    </aside>
    {confirmSignOut && <SignOutConfirmation busy={signingOut} error={signOutError} onCancel={() => { setConfirmSignOut(false); setSignOutError(null) }} onConfirm={() => { void signOut() }} />}
  </>
}
