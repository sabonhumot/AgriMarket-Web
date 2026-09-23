import { useEffect, useMemo, useRef, useState } from 'react'
import { matchesQuery, updateReviewStatus } from './admin-state'
import { activityEntries, demoDataLabel, listingCases, organizations, reviewItems, securityEvents } from './demo-data'
import { applyListingCaseAction, listingCaseActivityEntries, loadListingCases, saveListingCases } from './listing-cases'
import { applyOrganizationDecision, decisionActivityEntries, loadOrganizationReviews, saveOrganizationReviews } from './organization-reviews'
import ActionCenter from './components/ActionCenter'
import AdminSidebar from './components/AdminSidebar'
import ManagementView from './components/ManagementView'
import ReviewBoard from './components/ReviewBoard'
import type { AdminView, ListingCaseAction, OrganizationDecision, ReviewStatus } from './types'
import './AdminWorkspace.css'

const viewCopy: Record<AdminView, { title: string; description: string; breadcrumb: string }> = {
  overview: {
    title: 'Platform overview',
    description: 'A focused view of the administrator work that needs attention.',
    breadcrumb: 'Dashboard',
  },
  users: {
    title: 'User oversight',
    description: 'Search and review the people using AgriMarket.',
    breadcrumb: 'Users Oversight',
  },
  organizations: {
    title: 'Organization reviews',
    description: 'Track organizations and the details awaiting review.',
    breadcrumb: 'Organizations',
  },
  moderation: {
    title: 'Moderation queue',
    description: 'Review reports and checks across the platform.',
    breadcrumb: 'Moderation',
  },
  security: {
    title: 'Security & access',
    description: 'Inspect account access and suspicious activity.',
    breadcrumb: 'Security & Access',
  },
  activity: {
    title: 'Activity log',
    description: 'Review the recent administrative activity stream.',
    breadcrumb: 'Activity Audit Log',
  },
}

const overviewMetrics: Array<{
  label: string
  value: string
  detail: string
  view: AdminView
  action: string
  trend: string
  trendType: 'positive' | 'warning' | 'alert' | 'neutral'
  icon: string
}> = [
  {
    label: 'Active users',
    value: '1,248',
    detail: 'Across buyer and farmer accounts',
    view: 'users',
    action: 'View users',
    trend: '+12% this month',
    trendType: 'positive',
    icon: 'M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20v-1.5a6 6 0 0 1 12 0V20z M17 4.5a3 3 0 0 1 0 6 M17 14a5 5 0 0 1 4.5 5v1',
  },
  {
    label: 'Organization reviews',
    value: '08',
    detail: 'Awaiting administrator review',
    view: 'organizations',
    action: 'View organizations',
    trend: '4 urgent',
    trendType: 'warning',
    icon: 'M3 20.5h18 M5 20V7l7-3 7 3v13 M9 10h1 M14 10h1 M9 14h1 M14 14h1 M11 20v-3h2v3',
  },
  {
    label: 'Open cases',
    value: '12',
    detail: 'Review items awaiting action',
    view: 'moderation',
    action: 'View moderation',
    trend: '2 high priority',
    trendType: 'alert',
    icon: 'M12 3.5 20 7v5.2c0 4.1-2.6 7.3-8 9.3-5.4-2-8-5.2-8-9.3V7z M9 12.5l2 2 4-4',
  },
  {
    label: 'Access alerts',
    value: '03',
    detail: 'Security checks to inspect',
    view: 'security',
    action: 'View security',
    trend: '1 new today',
    trendType: 'warning',
    icon: 'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5z M12 14v3',
  },
]

export default function AdminWorkspace() {
  const [activeView, setActiveView] = useState<AdminView>('overview')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(reviewItems)
  const [cases, setCases] = useState(() => {
    try {
      return loadListingCases(typeof window === 'undefined' ? null : window.localStorage, listingCases)
    } catch {
      return loadListingCases(null, listingCases)
    }
  })
  const [organizationReviews, setOrganizationReviews] = useState(() => {
    try {
      return loadOrganizationReviews(typeof window === 'undefined' ? null : window.localStorage, organizations)
    } catch {
      return loadOrganizationReviews(null, organizations)
    }
  })
  const [notice, setNotice] = useState<string | null>(null)
  const [viewSelectionCount, setViewSelectionCount] = useState(0)
  const pageTitleRef = useRef<HTMLHeadingElement>(null)
  const currentView = viewCopy[activeView]
  const visibleItems = useMemo(() => items.map((item) => {
    if (item.type === 'Listing report') {
      const listingCase = cases.find((entry) => entry.reportId === item.id)
      return listingCase ? { ...item, status: listingCase.status } : item
    }
    if (item.type !== 'Organization approval') return item
    const organization = organizationReviews.organizations.find((entry) => entry.name === item.subject)
    if (!organization || organization.status === 'Pending review') return item
    return { ...item, status: organization.status === 'Needs details' ? 'investigating' as const : 'resolved' as const }
  }), [items, cases, organizationReviews.organizations])
  const filteredItems = useMemo(() => visibleItems.filter((item) => matchesQuery(item, query)), [visibleItems, query])
  const reviewCount = organizationReviews.organizations.filter((item) => item.status === 'Pending review' || item.status === 'Needs details').length
  const openCaseCount = visibleItems.filter((item) => item.status !== 'resolved').length
  const highPriorityCount = visibleItems.filter((item) => item.status !== 'resolved' && item.priority === 'high').length
  const currentActivity = [
    ...[...listingCaseActivityEntries(cases), ...decisionActivityEntries(organizationReviews.decisions)]
      .sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || '')),
    ...activityEntries,
  ]

  function handleViewChange(view: AdminView) {
    setActiveView(view)
    setViewSelectionCount((count) => count + 1)
    setQuery('')
    setNotice(null)
  }

  function handleStatusChange(id: string, status: ReviewStatus) {
    setItems((currentItems) => updateReviewStatus(currentItems, id, status))
    setNotice('Demo review status updated locally.')
  }

  function handleOrganizationDecision(organizationId: string, decision: OrganizationDecision['decision'], reason: string) {
    const next = applyOrganizationDecision(organizationReviews, {
      organizationId, decision, reason, decidedAt: new Date().toISOString(),
    })
    setOrganizationReviews(next)
    const saved = (() => {
      try {
        return saveOrganizationReviews(window.localStorage, next)
      } catch {
        return false
      }
    })()
    setNotice(saved ? 'Decision saved in this browser and added to the activity log.' : 'Decision recorded for this session. Browser storage is unavailable.')
  }

  function handleListingCaseAction(reportId: string, action: ListingCaseAction, reason: string) {
    const next = applyListingCaseAction(cases, reportId, action, reason, new Date().toISOString())
    setCases(next)
    const saved = (() => {
      try {
        return saveListingCases(window.localStorage, next)
      } catch {
        return false
      }
    })()
    setNotice(saved ? 'Case action saved in this browser and added to the activity log.' : 'Case action recorded for this session. Browser storage is unavailable.')
  }

  useEffect(() => {
    if (viewSelectionCount > 0) pageTitleRef.current?.focus()
  }, [activeView, viewSelectionCount])

  return (
    <div className="admin-shell">
      <AdminSidebar activeView={activeView} onViewChange={handleViewChange} organizationCount={reviewCount} moderationCount={openCaseCount} />

      <main
        className="admin-main"
        aria-labelledby="admin-page-title"
      >
        <div className="admin-breadcrumb-bar">
          <nav aria-label="Breadcrumb" className="admin-breadcrumb">
            <span className="breadcrumb-root">Admin</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{currentView.breadcrumb}</span>
          </nav>
          <div className="admin-topbar-actions">
            <a
              className="admin-public-link"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M10 4H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
                <path d="M13 3h4v4" />
                <path d="M17 3l-7 7" />
              </svg>
              Public site
            </a>
          </div>
        </div>

        <div className="admin-view-header">
          <header className="admin-topbar">
            <div>
              <p className="admin-demo-label">
                <span className="demo-indicator-pulse" aria-hidden="true" />
                {demoDataLabel}
              </p>
              <h1 id="admin-page-title" ref={pageTitleRef} tabIndex={-1}>
                {currentView.title}
              </h1>
            </div>
          </header>

          <p className="admin-page-description">{currentView.description}</p>
        </div>

        {notice && (
          <div className="admin-notice-banner" role="status">
            <span className="notice-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 6l-8 8-4-4" />
              </svg>
            </span>
            <p className="admin-notice">{notice}</p>
            <button
              type="button"
              className="notice-dismiss"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}

        {activeView === 'overview' && (
          <>
            <dl className="admin-summary" aria-label="Demo platform summary">
              {overviewMetrics.map((metric) => (
                <div className="admin-metric" key={metric.label}>
                  <dt className="admin-metric-heading">
                    <span>{metric.label}</span>
                    <div className="admin-metric-icon-spot">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d={metric.icon} />
                      </svg>
                    </div>
                  </dt>
                  <dd>{metric.view === 'organizations' ? String(reviewCount).padStart(2, '0') : metric.view === 'moderation' ? String(openCaseCount).padStart(2, '0') : metric.value}</dd>
                  <div className="admin-metric-trend-row">
                    <span className={`admin-metric-trend trend-${metric.trendType}`}>
                      {metric.view === 'organizations' ? `${reviewCount} awaiting action` : metric.view === 'moderation' ? `${highPriorityCount} high priority` : metric.trend}
                    </span>
                    <p>{metric.detail}</p>
                  </div>
                  <button type="button" onClick={() => handleViewChange(metric.view)}>
                    {metric.action}
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 10h11m-4-4 4 4-4 4" />
                    </svg>
                  </button>
                </div>
              ))}
            </dl>

            <ActionCenter
              items={visibleItems}
              onNavigateToModeration={() => handleViewChange('moderation')}
              onNavigateToOrganizations={() => handleViewChange('organizations')}
            />

            <div className="admin-overview-lower">
              <section className="snapshot-panel" aria-labelledby="security-snapshot-title">
                <div className="admin-panel-heading">
                  <div>
                    <div className="snapshot-title-row">
                      <span className="snapshot-icon-badge snapshot-icon-security" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                      </span>
                      <h2 id="security-snapshot-title">Security snapshot</h2>
                    </div>
                    <p>Recent signals that may need an access check.</p>
                  </div>
                  <button type="button" onClick={() => handleViewChange('security')}>
                    View all
                  </button>
                </div>
                <ul className="snapshot-list">
                  {securityEvents.slice(0, 2).map((event) => (
                    <li key={event.id} className="snapshot-item">
                      <span className={`severity severity-${event.severity.toLocaleLowerCase()}`}>
                        {event.severity}
                      </span>
                      <div className="snapshot-item-content">
                        <strong>{event.title}</strong>
                        <small>{event.createdLabel}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="snapshot-panel" aria-labelledby="recent-activity-title">
                <div className="admin-panel-heading">
                  <div>
                    <div className="snapshot-title-row">
                      <span className="snapshot-icon-badge snapshot-icon-activity" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </span>
                      <h2 id="recent-activity-title">Recent activity</h2>
                    </div>
                    <p>Latest platform events in this local demo.</p>
                  </div>
                  <button type="button" onClick={() => handleViewChange('activity')}>
                    View all
                  </button>
                </div>
                <ul className="snapshot-list">
                  {currentActivity.slice(0, 3).map((entry) => (
                    <li key={entry.id} className="snapshot-item">
                      <div className="snapshot-item-content">
                        <strong>{entry.title}</strong>
                        <small>{entry.subject}</small>
                      </div>
                      <time dateTime={entry.dateTime}>{entry.createdLabel}</time>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}

        {activeView === 'moderation' && (
          <ReviewBoard
            items={filteredItems}
            query={query}
            onQueryChange={setQuery}
            onStatusChange={handleStatusChange}
            onReset={() => setQuery('')}
            listingCases={cases}
            onListingCaseAction={handleListingCaseAction}
          />
        )}

        {activeView !== 'overview' && activeView !== 'moderation' && (
          <ManagementView
            view={activeView}
            query={query}
            onQueryChange={setQuery}
            onReset={() => setQuery('')}
            organizations={organizationReviews.organizations}
            activityEntries={currentActivity}
            decisions={organizationReviews.decisions}
            onOrganizationDecision={handleOrganizationDecision}
          />
        )}
      </main>
    </div>
  )
}
