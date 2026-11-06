import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import brandLogo from '../../assets/AgriMarket.svg'
import type { AdminView } from '../types'
import { getWebAccount } from '../../auth/web-role'
import { getSupabaseClient } from '../supabase'

const navigation: Array<{ id: AdminView; label: string; badge?: string; badgeVariant?: 'warning' | 'alert' | 'neutral' }> = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
  { id: 'events', label: 'Events' },
  { id: 'moderation', label: 'Reports', badgeVariant: 'alert' },
  { id: 'activity', label: 'Activity log' },
]

type AdminSidebarProps = {
  activeView: AdminView
  onViewChange: (view: AdminView) => void
  reportCount?: number
  onSignOut?: () => void | Promise<void>
}

function NavigationIcon({ view }: { view: AdminView }) {
  const paths: Record<AdminView, string> = {
    overview: 'M3 3.5h7v7H3z M14 3.5h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    users: 'M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20v-1.5a6 6 0 0 1 12 0V20z M17 4.5a3 3 0 0 1 0 6 M17 14a5 5 0 0 1 4.5 5v1',
    events: 'M5 5h14v16H5z M8 3v4 M16 3v4 M5 10h14 M9 14h2 M14 14h2 M9 18h2',
    moderation: 'M12 3.5 20 7v5.2c0 4.1-2.6 7.3-8 9.3-5.4-2-8-5.2-8-9.3V7z M9 12.5l2 2 4-4',
    activity: 'M4 4v5h5 M4.5 9a8 8 0 1 1-.2 6 M12 8v4l3 2',
  }

  return (
    <svg
      className="admin-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[view]} />
    </svg>
  )
}

export default function AdminSidebar({ activeView, onViewChange, reportCount, onSignOut }: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null)

  useEffect(() => {
    let active = true
    void getWebAccount(getSupabaseClient()).then((value) => {
      if (active && value?.role === 'admin') setAccount(value)
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

  function selectView(view: AdminView) {
    onViewChange(view)
    setIsOpen(false)
  }

  return (
    <>
      <button
        ref={menuButton}
        className="admin-menu-button"
        type="button"
        aria-expanded={isOpen}
        aria-controls="administrator-navigation"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <span>{isOpen ? 'Close' : 'Menu'}</span>
      </button>

      <button
        className="admin-sidebar-scrim"
        type="button"
        aria-label="Close administrator navigation"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        inert={!isOpen}
        data-open={isOpen}
        onClick={() => setIsOpen(false)}
      />

      <aside className={`admin-sidebar${isOpen ? ' is-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <a href="/" className="admin-brand-link" aria-label="Return to AgriMarket public site">
            <img src={brandLogo} alt="AgriMarket" className="admin-sidebar-logo" width="666" height="375" />
          </a>
          <p className="admin-workspace-label">Administrator workspace</p>
        </div>

        <nav id="administrator-navigation" aria-label="Administrator navigation">
          <ul className="admin-nav-list">
            {navigation.map((item) => {
              const isActive = item.id === activeView
              return (
                <li key={item.id} className={item.id === 'activity' ? 'admin-nav-divider' : undefined}>
                  <button
                    className={`admin-nav-item${isActive ? ' is-active' : ''}`}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => selectView(item.id)}
                  >
                    <NavigationIcon view={item.id} />
                    <span className="admin-nav-label">{item.label}</span>
                    {item.id === 'moderation' && (reportCount ?? 0) > 0 && (
                      <span className={`admin-nav-badge admin-nav-badge-${item.badgeVariant || 'neutral'}`}>
                        {Math.min(99, reportCount ?? 0)}{(reportCount ?? 0) > 99 ? '+' : ''}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-profile">
            <div className="admin-profile-avatar-wrap">
              <span className="admin-profile-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg></span>
            </div>
            <div className="admin-profile-info">
              <strong>{account?.name || 'Administrator'}</strong>
              <small>{account?.email || 'Administrator account'}</small>
            </div>
          </div>
          {onSignOut && <button className="admin-signout-button" type="button" disabled={signingOut} onClick={() => {
            setSigningOut(true)
            setSignOutError(null)
            Promise.resolve().then(onSignOut).catch((cause: unknown) => {
              const message = cause instanceof Error ? cause.message : 'Sign-out failed. Please try again.'
              setSignOutError(message)
              toast.error(message)
            }).finally(() => setSigningOut(false))
          }}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M9 4H4v16h5m6-12 4 4-4 4m-6-4h10" /></svg>{signingOut ? 'Signing out…' : 'Sign out'}</button>}
          {signOutError && <p className="admin-sidebar-error" role="alert">{signOutError}</p>}
        </div>
      </aside>
    </>
  )
}
