import { useState, type FormEvent } from 'react'
import AppSelect from '../../components/AppSelect'
import type { ListingCase, ListingCaseAction } from '../types'

type Props = {
  listingCase: ListingCase
  onAction: (action: ListingCaseAction, reason: string) => void
  onClose: () => void
}

const statusLabels: Record<ListingCase['status'], string> = {
  'needs-review': 'Needs review',
  investigating: 'In review',
  'waiting-for-info': 'Waiting for information',
  resolved: 'Closed',
}

const statusBadgeClasses: Record<ListingCase['status'], string> = {
  'needs-review': 'status-pill-amber',
  investigating: 'status-pill-emerald',
  'waiting-for-info': 'status-pill-sky',
  resolved: 'status-pill-slate',
}

const eventLabels: Record<ListingCaseAction, string> = {
  'start-review': 'Review started',
  note: 'Internal note',
  'request-correction': 'Correction requested',
  keep: 'Listing kept',
  hide: 'Listing hidden',
  remove: 'Listing removed',
  reopen: 'Case reopened',
}

export default function ListingCaseDetail({ listingCase, onAction, onClose }: Props) {
  const [note, setNote] = useState('')
  const [action, setAction] = useState<ListingCaseAction>('keep')
  const [reason, setReason] = useState('')
  const [reopenReason, setReopenReason] = useState('')

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!note.trim()) return
    onAction('note', note)
    setNote('')
  }

  function saveAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason.trim()) return
    onAction(action, reason)
    setReason('')
  }

  function reopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reopenReason.trim()) return
    onAction('reopen', reopenReason)
    setReopenReason('')
  }

  return (
    <section className="listing-case-detail" aria-labelledby="listing-case-title">
      {/* Modal Header */}
      <div className="listing-case-heading">
        <div className="listing-case-header-main">
          <div className="listing-case-tags">
            <span className="case-id-badge">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h8" />
              </svg>
              Case #{listingCase.reportId}
            </span>
            <span className={`case-status-badge ${statusBadgeClasses[listingCase.status]}`}>
              <span className="case-status-dot" aria-hidden="true" />
              Case status: <strong>{statusLabels[listingCase.status]}</strong>
            </span>
            <span className="case-visibility-badge">
              Recorded visibility: <strong>{listingCase.visibility}</strong>
            </span>
            {listingCase.outcome && (
              <span className="case-outcome-badge">
                Decision outcome: <strong>{eventLabels[listingCase.outcome]}</strong>
              </span>
            )}
          </div>
          <p className="listing-case-label">Listing report case</p>
          <h3 id="listing-case-title" tabIndex={-1}>
            {listingCase.listingTitle}
          </h3>
        </div>
        <button
          type="button"
          className="listing-case-close"
          onClick={onClose}
          aria-label="Close listing case"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>

      <div className="listing-case-layout">
        {/* Left Column: Facts, Evidence, and Audit History */}
        <div className="listing-case-main-col">
          <section className="listing-case-card" aria-labelledby="listing-snapshot-title">
            <div className="case-card-header">
              <div className="case-card-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 4h12v12H4z" />
                  <path d="M4 8h12M8 4v12" />
                </svg>
              </div>
              <h4 id="listing-snapshot-title">Listing snapshot</h4>
            </div>
            <dl className="listing-case-facts">
              <div className="fact-item">
                <dt>Farmer or group</dt>
                <dd>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 14a5.5 5.5 0 0 1 11 0" />
                  </svg>
                  {listingCase.farmer}
                </dd>
              </div>
              <div className="fact-item">
                <dt>Location</dt>
                <dd>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5z" />
                    <circle cx="8" cy="6" r="1.5" />
                  </svg>
                  {listingCase.location}
                </dd>
              </div>
              <div className="fact-item">
                <dt>Price</dt>
                <dd>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M2.5 8h11M8 2.5v11" />
                  </svg>
                  {listingCase.price}
                </dd>
              </div>
              <div className="fact-item">
                <dt>Availability</dt>
                <dd>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M3 3h10v10H3zM6 8l2 2 4-4" />
                  </svg>
                  {listingCase.availability}
                </dd>
              </div>
            </dl>
          </section>

          <section className="listing-case-card" aria-labelledby="listing-report-title">
            <div className="case-card-header">
              <div className="case-card-icon case-icon-amber" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 3l7 13H3l7-13z" />
                  <path d="M10 8v4M10 14.5v.5" />
                </svg>
              </div>
              <h4 id="listing-report-title">Report and evidence</h4>
            </div>

            <div className="listing-report-meta-box">
              <span className="reporter-tag">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 14a5.5 5.5 0 0 1 11 0" />
                </svg>
                Reported by {listingCase.reportedBy}
              </span>
              <p className="listing-report-reason-text">{listingCase.reportReason}</p>
            </div>

            <div className="evidence-subsection">
              <h5 className="evidence-heading">Submitted evidence</h5>
              <ul className="evidence-checklist">
                {listingCase.evidence.map((item) => (
                  <li key={item}>
                    <span className="evidence-bullet-icon" aria-hidden="true">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8.5l3.5 3.5 6.5-7" />
                      </svg>
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="evidence-subsection">
              <h5 className="evidence-heading">Related history</h5>
              <ul className="history-bullet-list">
                {listingCase.relatedHistory.map((item) => (
                  <li key={item}>
                    <span className="history-bullet-dot" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Audit Trail & Case History */}
          <section className="listing-case-card" aria-labelledby="listing-case-history-title">
            <div className="case-card-header">
              <div className="case-card-icon case-icon-emerald" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="10" cy="10" r="7" />
                  <path d="M10 6v4l2.5 2" />
                </svg>
              </div>
              <h4 id="listing-case-history-title">Case history</h4>
              <span className="history-count-badge">{listingCase.events.length} logs</span>
            </div>

            {listingCase.events.length ? (
              <ol className="case-timeline">
                {listingCase.events.map((event) => (
                  <li key={event.id} className="case-timeline-entry">
                    <div className="timeline-marker" aria-hidden="true" />
                    <div className="timeline-body">
                      <div className="timeline-meta">
                        <span className="timeline-action-label">{eventLabels[event.action]}</span>
                        <time dateTime={event.at}>
                          {new Date(event.at).toLocaleString('en-PH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </time>
                      </div>
                      <p className="timeline-reason">{event.reason}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="case-history-empty">
                <p>No actions recorded yet.</p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Workflow Actions & Notes Dock */}
        <div className="listing-case-sidebar-col">
          <div className="listing-case-action-dock">
            {listingCase.status === 'needs-review' && (
              <div className="listing-case-card listing-case-prompt-card">
                <div className="case-card-header">
                  <div className="case-card-icon case-icon-amber" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="10" cy="10" r="7" />
                      <path d="M10 6v5M10 14v.5" />
                    </svg>
                  </div>
                  <h4>Review triage</h4>
                </div>
                <p className="dock-hint">
                  Start the review to record a decision on this report.
                </p>
                <button
                  type="button"
                  className="case-btn-primary"
                  onClick={() => onAction('start-review', '')}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 10l4 4 6-8" />
                  </svg>
                  Start review
                </button>
              </div>
            )}

            {(listingCase.status === 'waiting-for-info' || listingCase.status === 'resolved') && (
              <form className="listing-case-card listing-case-form" onSubmit={reopen}>
                <div className="case-card-header">
                  <div className="case-card-icon case-icon-sky" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 10a6 6 0 1 1 2 4.5" />
                      <path d="M4 14.5V10h4.5" />
                    </svg>
                  </div>
                  <h4>{listingCase.status === 'resolved' ? 'Reopen case' : 'Resume review'}</h4>
                </div>
                <div className="form-field-group">
                  <label htmlFor="listing-reopen-reason">Reason to resume</label>
                  <textarea
                    id="listing-reopen-reason"
                    rows={2}
                    required
                    value={reopenReason}
                    onChange={(event) => setReopenReason(event.target.value)}
                    placeholder="Provide justification to reopen or resume review..."
                  />
                </div>
                <button
                  type="submit"
                  className="case-btn-primary"
                  disabled={!reopenReason.trim()}
                >
                  {listingCase.status === 'resolved' ? 'Reopen case' : 'Resume review'}
                </button>
              </form>
            )}

            {listingCase.status === 'investigating' && (
              <form className="listing-case-card listing-case-form" onSubmit={saveAction}>
                <div className="case-card-header">
                  <div className="case-card-icon case-icon-emerald" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M9 12l2 2 4-4" />
                      <path d="M12 3.5 20 7v5.2c0 4.1-2.6 7.3-8 9.3-5.4-2-8-5.2-8-9.3V7z" />
                    </svg>
                  </div>
                  <h4>Record an action</h4>
                </div>
                <p className="dock-hint">
                  This demo records the outcome in the case history. It does not change a live listing or send a message.
                </p>

                <div className="form-field-group">
                  <label htmlFor="listing-case-action">Action</label>
                  <div className="custom-select-wrapper">
                    <AppSelect id="listing-case-action" label="Action" value={action} onChange={(value) => setAction(value as ListingCaseAction)} options={[{ value: 'keep', label: 'Keep listing' }, { value: 'request-correction', label: 'Request correction' }, { value: 'hide', label: 'Hide listing' }, { value: 'remove', label: 'Remove listing' }]} />
                  </div>
                </div>

                <div className="form-field-group">
                  <label htmlFor="listing-case-reason">Reason for action</label>
                  <textarea
                    id="listing-case-reason"
                    rows={3}
                    required
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain the evidence and decision"
                  />
                </div>

                <button
                  type="submit"
                  className="case-btn-primary"
                  disabled={!reason.trim()}
                >
                  Save action
                </button>
              </form>
            )}

            {/* Internal Note Taker */}
            <form className="listing-case-card listing-case-form listing-case-note-form" onSubmit={saveNote}>
              <div className="case-card-header">
                <div className="case-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M13.5 3.5l3 3L6.5 16.5H3.5v-3L13.5 3.5z" />
                  </svg>
                </div>
                <h4>Internal note</h4>
              </div>

              <div className="form-field-group">
                <label htmlFor="listing-case-note">Add a note to this case</label>
                <textarea
                  id="listing-case-note"
                  rows={2}
                  required
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Record what you checked"
                />
              </div>

              <button
                type="submit"
                className="case-btn-secondary"
                disabled={!note.trim()}
              >
                Save note
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
