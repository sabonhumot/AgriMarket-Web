import type { ReviewItem } from '../types'

type ActionCenterProps = {
  items: ReviewItem[]
  onNavigateToModeration: () => void
  onNavigateToOrganizations: () => void
}

export default function ActionCenter({
  items,
  onNavigateToModeration,
  onNavigateToOrganizations,
}: ActionCenterProps) {
  const needsReviewCount = items.filter((i) => i.status === 'needs-review').length
  const investigatingCount = items.filter((i) => i.status === 'investigating').length
  const resolvedCount = items.filter((i) => i.status === 'resolved').length

  // High & medium priority items that require administrator action
  const urgentItems = items.filter((i) => i.status !== 'resolved').slice(0, 4)

  return (
    <section className="action-center-panel" aria-labelledby="action-center-title">
      <div className="action-center-header">
        <div className="action-center-title-group">
          <div className="action-center-badge-row">
            <span className="action-center-icon-spot" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </span>
            <h2 id="action-center-title">Action Center</h2>
            <span className="action-center-urgent-count">{urgentItems.length} require action</span>
          </div>
          <p>Prioritized items requiring administrator oversight across listings, verifications, and accounts.</p>
        </div>

        <div className="action-center-nav-actions">
          <button
            type="button"
            className="action-center-queue-btn"
            onClick={onNavigateToModeration}
            aria-label="Search review queue in moderation"
          >
            <span>Search review queue</span>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 10h11m-4-4 4 4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Workload Status Distribution Bar */}
      <div className="action-workload-bar" role="region" aria-label="Review status summary">
        <div className="workload-pill workload-needs-review" onClick={onNavigateToModeration}>
          <span className="workload-dot" aria-hidden="true" />
          <span className="workload-label">Needs review</span>
          <span className="workload-count">{needsReviewCount}</span>
        </div>
        <div className="workload-pill workload-investigating" onClick={onNavigateToModeration}>
          <span className="workload-dot" aria-hidden="true" />
          <span className="workload-label">Investigating</span>
          <span className="workload-count">{investigatingCount}</span>
        </div>
        <div className="workload-pill workload-resolved" onClick={onNavigateToModeration}>
          <span className="workload-dot" aria-hidden="true" />
          <span className="workload-label">Resolved</span>
          <span className="workload-count">{resolvedCount}</span>
        </div>
      </div>

      {/* Priority Action List */}
      <div className="action-items-list">
        {urgentItems.map((item) => (
          <article key={item.id} className="action-item-card">
            <div className="action-item-main">
              <div className="action-item-meta">
                <span className="action-item-type">{item.type}</span>
                <span className={`priority priority-${item.priority}`}>
                  <span className="priority-dot" aria-hidden="true" />
                  {item.priority} priority
                </span>
                <span className="action-item-time">{item.createdLabel}</span>
              </div>
              <h3 className="action-item-title">{item.title}</h3>
              <p className="action-item-subject">
                <svg className="subject-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5z" />
                  <circle cx="8" cy="6" r="1.5" />
                </svg>
                <span>{item.subject}</span>
              </p>
              <p className="action-item-details">{item.details}</p>
            </div>

            <div className="action-item-side">
              <button
                type="button"
                className="action-inspect-btn"
                onClick={() => {
                  if (item.type === 'Organization approval') {
                    onNavigateToOrganizations()
                  } else {
                    onNavigateToModeration()
                  }
                }}
              >
                <span>Review</span>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 5l5 5-5 5" />
                </svg>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
