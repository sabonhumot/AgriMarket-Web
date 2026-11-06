import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { getWebAccount } from '../auth/web-role'
import { getSupabaseClient } from '../admin/supabase'
import brandLogo from '../assets/AgriMarket.svg'
import { navigateWeb } from '../auth/web-navigation'
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
  onSignOut?: () => void | Promise<void>
}

export default function EventManagerSidebar({ active, onSignOut }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null)
  const name = account?.name || 'Event Manager'

  useEffect(() => {
    let active = true
    void getWebAccount(getSupabaseClient()).then((value) => {
      if (active && value?.role === 'event_manager') setAccount(value)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setIsOpen(false); menuButton.current?.focus() }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  function openPage(event: MouseEvent<HTMLAnchorElement>, path: string) {
    setIsOpen(false)
    navigateWeb(event, path)
  }

  async function signOut() {
    if (!onSignOut || signingOut) return
    setSigningOut(true)
    setSignOutError(null)
    try { await onSignOut() }
    catch (cause) { setSignOutError(cause instanceof Error ? cause.message : 'Sign-out failed. Please try again.') }
    finally { setSigningOut(false) }
  }

  return <>
    <button ref={menuButton} className="em-menu-button" type="button" aria-expanded={isOpen} aria-controls="event-manager-navigation" onClick={() => setIsOpen((open) => !open)}><span aria-hidden="true" /><span>{isOpen ? 'Close' : 'Menu'}</span></button>
    <button className="em-sidebar-scrim" type="button" aria-label="Close Event Manager navigation" aria-hidden={!isOpen} tabIndex={isOpen ? 0 : -1} inert={!isOpen} data-open={isOpen} onClick={() => setIsOpen(false)} />
    <aside className={'em-sidebar' + (isOpen ? ' is-open' : '')}>
      <div className="em-sidebar-brand"><a className="em-brand" href="/" aria-label="Return to AgriMarket public site"><img src={brandLogo} alt="AgriMarket" /></a><p className="em-sidebar-label">Event Manager workspace</p></div>
      <nav id="event-manager-navigation" aria-label="Event Manager navigation">
        <a className={active === 'overview' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager" onClick={(event) => openPage(event, '/event-manager')} aria-current={active === 'overview' ? 'page' : undefined}><Icon name="grid" /><span>Overview</span></a>
        <a className={active === 'events' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager/events" onClick={(event) => openPage(event, '/event-manager/events')} aria-current={active === 'events' ? 'page' : undefined}><Icon name="calendar" /><span>Events</span></a>
        <a className={active === 'notifications' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager/notifications" onClick={(event) => openPage(event, '/event-manager/notifications')} aria-current={active === 'notifications' ? 'page' : undefined}><Icon name="bell" /><span>Notifications</span></a>
        <a className={active === 'farmers' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager/farmers" onClick={(event) => openPage(event, '/event-manager/farmers')} aria-current={active === 'farmers' ? 'page' : undefined}><Icon name="people" /><span>Farmers</span></a>
        <div className="em-nav-divider"><a className={active === 'profile' ? 'em-nav-active' : 'em-nav-link'} href="/event-manager/profile" onClick={(event) => openPage(event, '/event-manager/profile')} aria-current={active === 'profile' ? 'page' : undefined}><Icon name="person" /><span>Profile</span></a></div>
      </nav>
      <div className="em-sidebar-bottom">
        <div className="em-sidebar-user"><div className="em-user-avatar" aria-hidden="true"><Icon name="person" size={20} /></div><div><strong>{name}</strong><span>{account?.email || 'Event Coordinator'}</span></div></div>
        {onSignOut && <button type="button" onClick={() => void signOut()} disabled={signingOut}><Icon name="logout" size={18} />{signingOut ? 'Signing out…' : 'Sign out'}</button>}
        {signOutError && <p role="alert">{signOutError}</p>}
      </div>
    </aside>
  </>
}
