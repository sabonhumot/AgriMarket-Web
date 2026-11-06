import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import AdminSidebar from './components/AdminSidebar'
import DetailDrawer, { type DetailModalTarget } from './components/DetailDrawer'
import UsersDirectory from './components/UsersDirectory'
import EventsDirectory from './components/EventsDirectory'
import { ReportsDirectory } from './components/ReviewDirectory'
import DashboardOverview from './components/DashboardOverview'
import ActivityLog from './components/ActivityLog'
import { loadDashboardData, type DashboardData } from './dashboard-data'
import { loadAdminData, type AdminData } from './admin-data'
import { getSupabaseClient } from './supabase'
import type { AdminView } from './types'
import './AdminWorkspace.css'

const viewCopy: Record<AdminView, { title: string; description: string; badgeLabel?: string }> = {
  overview: { title: 'Dashboard', description: 'Your community, market events, and the work that needs attention.' },
  users: { title: 'Users', description: 'Find accounts, review their status, and open user details.' },
  events: { title: 'Events', description: 'View every market event, including drafts, published events, and past events.' },
  moderation: { title: 'Reports', description: 'Review reservation issues, the people involved, and each case’s status.' },
  activity: { title: 'Activity audit log', description: 'Chronological timeline of all administrative and system events.' },
}

function SkeletonTable() {
  return (
    <div className="admin-skeleton-table" role="status" aria-live="polite">
      <span className="admin-sr-only">Loading database records</span>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="admin-skeleton-row">
          <div className="admin-skeleton-cell avatar" />
          <div className="admin-skeleton-cell text" style={{ width: '30%' }} />
          <div className="admin-skeleton-cell badge" />
          <div className="admin-skeleton-cell text" style={{ width: '20%' }} />
        </div>
      ))}
    </div>
  )
}

export default function AdminWorkspace({ onSignOut }: { onSignOut?: () => void | Promise<void> }) {
  const [activeView, setActiveView] = useState<AdminView>('overview')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailTarget, setDetailTarget] = useState<DetailModalTarget | null>(null)
  const closeDetail = useCallback(() => setDetailTarget(null), [])
  const [data, setData] = useState<AdminData | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const refreshing = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const pageTitleRef = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async (notify = false) => {
    if (refreshing.current) return
    refreshing.current = true
    setLoading(true)
    setError(null)
    try {
      const [next, nextDashboard] = await Promise.all([loadAdminData(getSupabaseClient()), loadDashboardData(getSupabaseClient())])
      if (mounted.current) {
        setData(next)
        setDashboard(nextDashboard)
        setUpdatedAt(new Date().toISOString())
        if (notify) toast.success('Admin data refreshed')
      }
    } catch (cause) {
      if (mounted.current) {
        const message = cause instanceof Error ? cause.message : 'Could not load administrator data.'
        setError(message)
        if (notify) toast.error('Could not refresh admin data', { description: message })
      }
    } finally {
      refreshing.current = false
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const timer = setTimeout(() => { void refresh() }, 0)
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 60000)
    return () => { mounted.current = false; clearTimeout(timer); clearInterval(interval) }
  }, [refresh])

  const openReports = data?.reports.filter((item) => !['resolved', 'closed', 'dismissed'].includes(item.status)).length ?? 0

  const search = query.trim().toLocaleLowerCase()
  const matches = (...values: Array<string | null>) => !search || values.some((value) => value?.toLocaleLowerCase().includes(search))

  function changeView(view: AdminView) {
    setActiveView(view)
    setQuery('')
    setRoleFilter('all')
    setStatusFilter('all')
    requestAnimationFrame(() => pageTitleRef.current?.focus())
  }

  // Filtered Activity
  const filteredActivity = data?.activity.filter((item) => matches(item.action, item.actor, item.entityType)) ?? []


  return (
    <div className="admin-shell">
      <AdminSidebar
        activeView={activeView}
        onViewChange={changeView}
        reportCount={openReports}
        onSignOut={onSignOut}
      />

      <main className="admin-main" aria-labelledby="admin-page-title">
        {/* Top Header Bar */}
        <div className="admin-topbar-wrapper">
          <div className="admin-breadcrumb-bar">
            <nav aria-label="Breadcrumb" className="admin-breadcrumb">
              <span className="breadcrumb-root">Admin Portal</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{viewCopy[activeView].title}</span>
            </nav>
            <div className="admin-topbar-actions">
              <a className="admin-public-link" href="/" target="_blank" rel="noreferrer">
                <span>Public site</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3" />
                </svg>
              </a>
            </div>
          </div>

          <div className="admin-view-header">
            <div className="admin-view-header-main">
              <h1 id="admin-page-title" ref={pageTitleRef} tabIndex={-1}>
                {viewCopy[activeView].title}
              </h1>
              <p className="admin-page-description">{viewCopy[activeView].description}</p>
            </div>
            <div className="admin-header-sync">
              <button
                type="button"
                className="admin-btn-refresh"
                onClick={() => void refresh(true)}
                disabled={loading}
                title="Refresh database records"
              >
                <svg
                  className={loading ? 'animate-spin' : ''}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="16"
                  height="16"
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 7 M21 3v4h-4" />
                </svg>
                <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
              </button>
              {updatedAt && <span className="admin-sync-time">Updated {new Date(updatedAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' })} · refreshes every minute</span>}
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="admin-error-banner" role="alert">
            <div className="admin-error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4 M12 16h.01" />
              </svg>
            </div>
            <div className="admin-error-content">
              <strong>Database Connection Error</strong>
              <p>{error}</p>
            </div>
            <button type="button" className="admin-btn-secondary" onClick={() => void refresh(true)}>
              Retry
            </button>
          </div>
        )}

        <div className="admin-view-content">
        {/* Search & Filter Bar (Views other than Overview) */}
        {activeView === 'activity' && (
          <div className="admin-toolbar-card">
            <div className="admin-search-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="admin-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${viewCopy[activeView].title.toLowerCase()}…`}
                aria-label={`Search ${viewCopy[activeView].title}`}
              />
              {query && (
                <button className="search-clear-btn" onClick={() => setQuery('')} aria-label="Clear search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18 M6 6l12 12" /></svg>
                </button>
              )}
            </div>


          </div>
        )}

        {data && dashboard && activeView === 'overview' && (
          <DashboardOverview
            data={dashboard} reports={data.reports} activity={data.activity}
            onUsers={(role) => { changeView('users'); if (role) setRoleFilter(role) }}
            onEvents={() => changeView('events')}
            onReports={() => changeView('moderation')}
            onActivity={() => changeView('activity')}
            onReport={(report) => setDetailTarget({ type: 'report', data: report })}
          />
        )}

        {/* Loading Skeleton */}
        {loading && !data && <SkeletonTable />}

        {data && activeView === 'users' && (
          <UsersDirectory users={data.users} totalUsers={dashboard?.totalUsers}
            query={query} role={roleFilter} status={statusFilter}
            onQuery={setQuery} onRole={setRoleFilter} onStatus={setStatusFilter}
            onOpen={(user) => setDetailTarget({ type: 'user', data: user })}
            onManagerCreated={async () => { await refresh() }} />
        )}

        {data && dashboard && activeView === 'events' && <EventsDirectory events={dashboard.events} users={data.users} onOpen={(event, managerName) => setDetailTarget({ type: 'event', data: event, managerName })} />}

        {data && activeView === 'moderation' && (
          <ReportsDirectory reports={data.reports}
            onOpen={(item) => setDetailTarget({ type: 'report', data: item })} />
        )}

        {data && activeView === 'activity' && (
          <ActivityLog entries={filteredActivity}
            onOpen={(entry) => setDetailTarget({ type: 'activity', data: entry })} />
        )}
        </div>

      </main>

      {/* Slide-over Detail Drawer */}
      {detailTarget && <DetailDrawer target={detailTarget} reports={data?.reports ?? []} onClose={closeDetail} onReportResolved={async () => { closeDetail(); await refresh() }} onUserUpdated={async () => { closeDetail(); await refresh() }} onOpenReport={report => setDetailTarget({ type: 'report', data: report })} />}
    </div>
  )
}

