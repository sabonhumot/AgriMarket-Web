import { useState, type FormEvent } from 'react'
import type { ListingCase, ListingCaseAction, ReviewItem } from '../types'

type Props = {
  item: ReviewItem
  reviewCase: ListingCase
  onAction: (action: ListingCaseAction, reason: string) => void
  onClose: () => void
}

const caseCopy: Record<ReviewItem['type'], {
  subjectLabel: string
  locationLabel: string
  contextLabel: string
  scopeLabel: string
  evidenceLabel: string
  requestLabel: string
  closeLabel: string
  workflowHint: string
}> = {
  'Listing report': {
    subjectLabel: 'Listing owner', locationLabel: 'Location', contextLabel: 'Price',
    scopeLabel: 'Availability', evidenceLabel: 'Report evidence',
    requestLabel: 'Request correction', closeLabel: 'Close report with no change',
    workflowHint: 'This demo records the review outcome without changing a live listing.',
  },
  'Organization approval': {
    subjectLabel: 'Applicant organization', locationLabel: 'Location', contextLabel: 'Application type',
    scopeLabel: 'Membership', evidenceLabel: 'Application documents and checks',
    requestLabel: 'Request application details', closeLabel: 'Close review without approval',
    workflowHint: 'Approve or reject the application in Organization reviews. This case records the moderation follow-up only.',
  },
  'User verification': {
    subjectLabel: 'Account holder', locationLabel: 'Location', contextLabel: 'Verification tier',
    scopeLabel: 'Account context', evidenceLabel: 'Identity check evidence',
    requestLabel: 'Request a clearer document', closeLabel: 'Close verification review',
    workflowHint: 'This case records the document review; it does not verify or change a live account.',
  },
  'Security alert': {
    subjectLabel: 'Affected account', locationLabel: 'Sign-in origin', contextLabel: 'Incident type',
    scopeLabel: 'Attempt summary', evidenceLabel: 'Security signals',
    requestLabel: 'Request security follow-up', closeLabel: 'Close security alert',
    workflowHint: 'This case records the investigation; it does not change sign-in controls.',
  },
  'Access request': {
    subjectLabel: 'Organization', locationLabel: 'Location', contextLabel: 'Requested role',
    scopeLabel: 'Access scope', evidenceLabel: 'Authorization evidence',
    requestLabel: 'Request authorization details', closeLabel: 'Close access review',
    workflowHint: 'This case records authorization checks; it does not grant or remove access.',
  },
}

const statusLabels: Record<ListingCase['status'], string> = {
  'needs-review': 'Needs review',
  investigating: 'Investigating',
  'waiting-for-info': 'Waiting for information',
  resolved: 'Resolved',
}

const eventLabels: Record<ListingCaseAction, string> = {
  'start-review': 'Review started',
  note: 'Internal note',
  'request-correction': 'Information requested',
  keep: 'Review closed',
  hide: 'Review closed',
  remove: 'Review closed',
  reopen: 'Review resumed',
}

export default function GeneralReviewCaseDetail({ item, reviewCase, onAction, onClose }: Props) {
  const copy = caseCopy[item.type]
  const [decision, setDecision] = useState<'request-correction' | 'keep'>('request-correction')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason.trim()) return
    onAction(reviewCase.status === 'investigating' ? decision : 'reopen', reason)
    setReason('')
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!note.trim()) return
    onAction('note', note)
    setNote('')
  }

  const facts = [
    [copy.subjectLabel, reviewCase.farmer],
    [copy.locationLabel, reviewCase.location],
    [copy.contextLabel, reviewCase.price],
    [copy.scopeLabel, reviewCase.availability],
  ]

  return (
    <section className="listing-case-detail general-review-case" aria-labelledby="general-review-case-title">
      <header className="listing-case-heading">
        <div className="listing-case-header-main">
          <div className="listing-case-tags">
            <span className="case-id-badge">{item.type}</span>
            <span className="case-status-badge">{statusLabels[reviewCase.status]}</span>
            <span className={'priority priority-' + item.priority}>{item.priority} priority</span>
          </div>
          <h3 id="general-review-case-title" tabIndex={-1}>{item.title}</h3>
          <p className="general-review-meta">{item.subject} · {item.createdLabel}</p>
        </div>
        <button type="button" className="listing-case-close" onClick={onClose} aria-label={'Close ' + item.type.toLowerCase() + ' case'}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </header>

      <div className="listing-case-layout">
        <div className="listing-case-main-col">
          <section className="listing-case-card general-review-section" aria-labelledby="general-review-summary">
            <h4 id="general-review-summary">{item.type} summary</h4>
            <p>{item.details}</p>
            <dl className="listing-case-facts">
              {facts.map(([label, value]) => <div className="fact-item" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          </section>
          <section className="listing-case-card general-review-section" aria-labelledby="general-review-evidence">
            <h4 id="general-review-evidence">{copy.evidenceLabel}</h4>
            <p className="general-review-source">Source: {reviewCase.reportedBy}</p>
            <ul>{reviewCase.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
            <h5>Related history</h5>
            <ul>{reviewCase.relatedHistory.map((entry) => <li key={entry}>{entry}</li>)}</ul>
          </section>
          <section className="listing-case-card general-review-section" aria-labelledby="general-review-history">
            <h4 id="general-review-history">Case history</h4>
            {reviewCase.events.length ? <ol>{reviewCase.events.map((entry) => (
              <li key={entry.id}>
                <strong>{eventLabels[entry.action]}</strong>
                <time dateTime={entry.at}>{new Date(entry.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                <p>{entry.reason}</p>
              </li>
            ))}</ol> : <p>No actions recorded yet.</p>}
          </section>
        </div>

        <aside className="listing-case-sidebar-col general-review-actions" aria-label="Case actions">
          {reviewCase.status === 'needs-review' ? (
            <section className="listing-case-card general-review-section">
              <h4>Start {item.type.toLowerCase()} review</h4>
              <p>Open this case for a documented review.</p>
              <button type="button" className="case-btn-primary" onClick={() => onAction('start-review', '')}>Start review</button>
            </section>
          ) : (
            <form className="listing-case-card listing-case-form general-review-section" onSubmit={submitDecision}>
              <h4>{reviewCase.status === 'investigating' ? 'Record a review outcome' : 'Resume review'}</h4>
              <p>{copy.workflowHint}</p>
              {reviewCase.status === 'investigating' && (
                <div className="form-field-group">
                  <label htmlFor="general-review-decision">Action</label>
                  <select id="general-review-decision" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>
                    <option value="request-correction">{copy.requestLabel}</option>
                    <option value="keep">{copy.closeLabel}</option>
                  </select>
                </div>
              )}
              <div className="form-field-group">
                <label htmlFor="general-review-reason">Reason</label>
                <textarea id="general-review-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required placeholder="Record what you checked and why" />
              </div>
              <button type="submit" className="case-btn-primary" disabled={!reason.trim()}>{reviewCase.status === 'investigating' ? 'Save action' : 'Resume review'}</button>
            </form>
          )}
          <form className="listing-case-card listing-case-form general-review-section" onSubmit={submitNote}>
            <h4>Internal note</h4>
            <div className="form-field-group">
              <label htmlFor="general-review-note">Add a note to this case</label>
              <textarea id="general-review-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} required placeholder="Record your findings" />
            </div>
            <button type="submit" className="case-btn-secondary" disabled={!note.trim()}>Save note</button>
          </form>
        </aside>
      </div>
    </section>
  )
}
