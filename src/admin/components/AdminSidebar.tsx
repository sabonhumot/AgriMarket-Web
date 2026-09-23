import { useEffect, useState } from 'react'
import brandLogo from '../../assets/AgriMarket.svg'
import type { AdminView } from '../types'

const navigation: Array<{ id: AdminView; label: string; badge?: string; badgeVariant?: 'warning' | 'alert' | 'neutral' }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'organizations', label: 'Organizations', badge: '08', badgeVariant: 'warning' },
  { id: 'moderation', label: 'Moderation', badge: '12', badgeVariant: 'alert' },
  { id: 'security', label: 'Security & access', badge: '03', badgeVariant: 'warning' },
  { id: 'activity', label: 'Activity log' },
]

type AdminSidebarProps = {
  activeView: AdminView
  onViewChange: (view: AdminView) => void
  organizationCount?: number
  moderationCount?: number
}

function NavigationIcon({ view }: { view: AdminView }) {
  const paths: Record<AdminView, string> = {
    overview: 'M3 3.5h7v7H3z M14 3.5h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    users: 'M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20v-1.5a6 6 0 0 1 12 0V20z M17 4.5a3 3 0 0 1 0 6 M17 14a5 5 0 0 1 4.5 5v1',
    organizations: 'M3 20.5h18 M5 20V7l7-3 7 3v13 M9 10h1 M14 10h1 M9 14h1 M14 14h1 M11 20v-3h2v3',
    moderation: 'M12 3.5 20 7v5.2c0 4.1-2.6 7.3-8 9.3-5.4-2-8-5.2-8-9.3V7z M9 12.5l2 2 4-4',
    security: 'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z M12 14v3',
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

export default function AdminSidebar({ activeView, onViewChange, organizationCount, moderationCount }: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
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
        className="admin-menu-button"
        type="button"
        aria-expanded={isOpen}
        aria-controls="administrator-navigation"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <span>{isOpen ? 'Close' : 'Menu'}</span>
      </button>

      {isOpen && (
        <button
          className="admin-sidebar-scrim"
          type="button"
          aria-label="Close administrator navigation"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`admin-sidebar${isOpen ? ' is-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <a href="/" className="admin-brand-link" aria-label="Return to AgriMarket public site">
            <img src={brandLogo} alt="AgriMarket" className="admin-sidebar-logo" />
          </a>
          <div className="admin-workspace-tag">
            <span className="admin-status-dot" aria-hidden="true" />
            <p>Administrator workspace</p>
          </div>
        </div>

        <nav id="administrator-navigation" aria-label="Administrator navigation">
          <p className="admin-nav-heading">Workspace</p>
          <ul className="admin-nav-list">
            {navigation.map((item) => {
              const isActive = item.id === activeView
              return (
                <li key={item.id}>
                  <button
                    className={`admin-nav-item${isActive ? ' is-active' : ''}`}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => selectView(item.id)}
                  >
                    <NavigationIcon view={item.id} />
                    <span className="admin-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className={`admin-nav-badge admin-nav-badge-${item.badgeVariant || 'neutral'}`}>
                        {item.id === 'organizations' && organizationCount !== undefined
                          ? String(organizationCount).padStart(2, '0')
                          : item.id === 'moderation' && moderationCount !== undefined
                            ? String(moderationCount).padStart(2, '0')
                            : item.badge}
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
              <span className="admin-profile-avatar" aria-hidden="true">AM</span>
              <span className="admin-avatar-status" aria-hidden="true" />
            </div>
            <div className="admin-profile-info">
              <strong>AgriMarket admin</strong>
              <small>Local demo session</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
