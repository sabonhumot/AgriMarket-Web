import { useEffect, useRef, useState } from 'react'
import CustomDropdown from './CustomDropdown'
import GeneralReviewCaseDetail from './GeneralReviewCaseDetail'
import ListingCaseDetail from './ListingCaseDetail'
import type { ListingCase, ListingCaseAction, ReviewItem, ReviewStatus } from '../types'

const columns: Array<{ status: ReviewStatus; label: string; description: string; color: string }> = [
  { status: 'needs-review', label: 'Needs review', description: 'New items that need an owner.', color: 'amber' },
  { status: 'investigating', label: 'Investigating', description: 'Items being checked by an admin.', color: 'emerald' },
  { status: 'waiting-for-info', label: 'Waiting for info', description: 'A response or correction is needed.', color: 'sky' },
  { status: 'resolved', label: 'Resolved', description: 'Recently completed demo reviews.', color: 'slate' },
]

type ReviewBoardProps = {
  items: ReviewItem[]
  query: string
  onQueryChange: (query: string) => void
  onStatusChange: (id: string, status: ReviewStatus) => void
  onReset: () => void
  listingCases?: ListingCase[]
  onListingCaseAction?: (reportId: string, action: ListingCaseAction, reason: string) => void
}

export default function ReviewBoard({
  items,
  query,
  onQueryChange,
  onStatusChange,
  onReset,
  listingCases = [],
  onListingCaseAction = () => {},
}: ReviewBoardProps) {
  const [mobileStatus, setMobileStatus] = useState<ReviewStatus>('needs-review')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const caseDialogRef = useRef<HTMLDialogElement>(null)
  const caseTriggerRef = useRef<HTMLButtonElement | null>(null)

  const selectedCase = listingCases.find((item) => item.reportId === selectedReportId)
  const selectedItem = items.find((item) => item.id === selectedReportId)
  const isListingCase = selectedItem?.type === 'Listing report'

  useEffect(() => {
    if (!selectedReportId) return
    const dialog = caseDialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    document.getElementById(isListingCase ? 'listing-case-title' : 'general-review-case-title')?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [selectedReportId, isListingCase])

  function openCase(reportId: string, trigger?: HTMLButtonElement | null) {
    if (trigger) caseTriggerRef.current = trigger
    setSelectedReportId(reportId)
  }

  function closeCase() {
    setSelectedReportId(null)
    window.requestAnimationFrame(() => {
      const trigger = caseTriggerRef.current
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus()
      else document.getElementById('admin-page-title')?.focus()
    })
  }

  function recordCaseAction(action: ListingCaseAction, reason: string) {
    if (!selectedReportId) return
    onListingCaseAction(selectedReportId, action, reason)
    if (action === 'start-review' || action === 'reopen') setMobileStatus('investigating')
    if (action === 'request-correction') setMobileStatus('waiting-for-info')
    if (action === 'keep' || action === 'hide' || action === 'remove') setMobileStatus('resolved')
  }

  function changeStatus(id: string, status: ReviewStatus) {
    setMobileStatus(status)
    onStatusChange(id, status)
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() =>
        document.querySelector<HTMLSelectElement>(`#review-card-${id} select`)?.focus()
      )
    }
  }

  const categoryFilteredItems = items.filter((item) => {
    if (categoryFilter === 'all') return true
    return item.type === categoryFilter
  })

  const availableCategories = Array.from(new Set(items.map((i) => i.type)))

  const statusDropdownOptions = columns.map((col) => ({
    value: col.status,
    label: col.label,
  }))

  const countsByStatus: Record<ReviewStatus, number> = {
    'needs-review': items.filter((i) => i.status === 'needs-review').length,
    investigating: items.filter((i) => i.status === 'investigating').length,
    'waiting-for-info': items.filter((i) => i.status === 'waiting-for-info').length,
    resolved: items.filter((i) => i.status === 'resolved').length,
  }

  return (
    <section className="review-board" aria-label="Review queue">
      {/* Moderation Metrics Bar */}
      <div className="moderation-metrics-row">
        <div className="moderation-metric-pill mod-pill-total">
          <span className="mod-metric-num">{items.length}</span>
          <span className="mod-metric-name">Total queue</span>
        </div>
        <div className="moderation-metric-pill mod-pill-amber">
          <span className="mod-metric-dot" aria-hidden="true" />
          <span className="mod-metric-num">{countsByStatus['needs-review']}</span>
          <span className="mod-metric-name">Needs review</span>
        </div>
        <div className="moderation-metric-pill mod-pill-emerald">
          <span className="mod-metric-dot" aria-hidden="true" />
          <span className="mod-metric-num">{countsByStatus.investigating}</span>
          <span className="mod-metric-name">Investigating</span>
        </div>
        <div className="moderation-metric-pill mod-pill-sky">
          <span className="mod-metric-dot" aria-hidden="true" />
          <span className="mod-metric-num">{countsByStatus['waiting-for-info']}</span>
          <span className="mod-metric-name">Waiting for info</span>
        </div>
        <div className="moderation-metric-pill mod-pill-slate">
          <span className="mod-metric-dot" aria-hidden="true" />
          <span className="mod-metric-num">{countsByStatus.resolved}</span>
          <span className="mod-metric-name">Resolved</span>
        </div>
      </div>

      {/* Moderation Search & Filter Bar */}
      <div className="review-board-heading">
        <div className="review-board-controls">
          <label className="admin-search">
            <span className="sr-only">Search review queue</span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="4.75" />
              <path d="m12 12 4 4" />
            </svg>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search review queue"
            />
          </label>
        </div>
      </div>

      {availableCategories.length > 1 && (
        <div className="review-category-pills" role="toolbar" aria-label="Filter reviews by category">
          <button
            type="button"
            className={`review-category-pill${categoryFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            All categories ({items.length})
          </button>
          {availableCategories.map((cat) => {
            const count = items.filter((i) => i.type === cat).length
            return (
              <button
                key={cat}
                type="button"
                className={`review-category-pill${categoryFilter === cat ? ' is-active' : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat} ({count})
              </button>
            )
          })}
        </div>
      )}

      <label className="review-mobile-tabs">
        <span>Show review status</span>
        <select
          value={mobileStatus}
          onChange={(event) => setMobileStatus(event.target.value as ReviewStatus)}
        >
          {columns.map((column) => (
            <option key={column.status} value={column.status}>
              {column.label}
            </option>
          ))}
        </select>
      </label>

      {categoryFilteredItems.length === 0 ? (
        <div className="admin-empty-state">
          <div className="admin-empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3>No demo reviews match this search.</h3>
          <p>Try another name, organization, or review type.</p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all')
              onReset()
            }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="review-board-columns" data-mobile-status={mobileStatus}>
          {columns.map((column) => {
            const columnItems = categoryFilteredItems.filter((item) => item.status === column.status)
            return (
              <section
                className={`review-column review-column-${column.color}${
                  mobileStatus === column.status ? ' is-mobile-active' : ''
                }`}
                key={column.status}
                aria-label={column.label}
              >
                <header className="review-column-header">
                  <div className="review-column-title-row">
                    <span className="column-indicator-dot" aria-hidden="true" />
                    <h3>{column.label}</h3>
                    <span className="column-count-badge">{columnItems.length}</span>
                  </div>
                  <p>{column.description}</p>
                </header>

                <div className="review-card-list">
                  {columnItems.length === 0 ? (
                    <div className="review-column-empty">
                      <p>No matching items.</p>
                    </div>
                  ) : (
                    columnItems.map((item) => {
                      const hasCase = listingCases.some((entry) => entry.reportId === item.id)
                      return (
                        <article
                          className={`review-card${hasCase ? ' review-card-actionable' : ''}`}
                          id={`review-card-${item.id}`}
                          key={item.id}
                          data-priority={item.priority}
                          onClick={() => {
                            if (hasCase) openCase(item.id)
                          }}
                        >
                          <div className="review-card-meta">
                            <span className="review-type-tag">{item.type}</span>
                            <span className={`priority priority-${item.priority}`}>
                              <span className="priority-dot" aria-hidden="true" />
                              {item.priority} priority
                            </span>
                          </div>

                          <h4>{item.title}</h4>
                          <p className="review-subject">
                            <svg className="subject-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                              <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5z" />
                              <circle cx="8" cy="6" r="1.5" />
                            </svg>
                            <span>{item.subject}</span>
                          </p>

                          <p className="review-details">{item.details}</p>

                          <footer
                            className="review-card-footer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className="review-time">
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                                <circle cx="8" cy="8" r="6" />
                                <path d="M8 4.5V8l2.5 1.5" />
                              </svg>
                              {item.createdLabel}
                            </span>
                            
                            <div className="review-card-actions">
                              {hasCase && (
                                <button
                                  className="review-open-case"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    openCase(item.id, event.currentTarget)
                                  }}
                                >
                                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                    <path d="M2 3.5h4l1.5 2H14v7.5H2z" />
                                  </svg>
                                  Open case
                                </button>
                              )}

                              <div className="review-status-select-wrap">
                                <span className="sr-only">Change status for {item.title}</span>
                                <CustomDropdown
                                  variant="card"
                                  ariaLabel={`Change status for ${item.title}`}
                                  value={item.status}
                                  options={statusDropdownOptions}
                                  onChange={(val) => changeStatus(item.id, val as ReviewStatus)}
                                />
                                <select
                                  className="sr-only"
                                  value={item.status}
                                  onChange={(event) =>
                                    changeStatus(item.id, event.target.value as ReviewStatus)
                                  }
                                  tabIndex={-1}
                                  aria-hidden="true"
                                >
                                  {columns.map((option) => (
                                    <option key={option.status} value={option.status}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </footer>
                        </article>
                      )
                    })
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {selectedCase && selectedItem && (
        <dialog
          ref={caseDialogRef}
          className="listing-case-modal"
          aria-labelledby={isListingCase ? 'listing-case-title' : 'general-review-case-title'}
          onCancel={(event) => {
            event.preventDefault()
            closeCase()
          }}
        >
          {isListingCase ? (
            <ListingCaseDetail listingCase={selectedCase} onAction={recordCaseAction} onClose={closeCase} />
          ) : (
            <GeneralReviewCaseDetail item={selectedItem} reviewCase={selectedCase} onAction={recordCaseAction} onClose={closeCase} />
          )}
        </dialog>
      )}
    </section>
  )
}
