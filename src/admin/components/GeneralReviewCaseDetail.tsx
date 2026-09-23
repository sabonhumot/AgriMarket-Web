import { useState, type FormEvent } from 'react'
import type { ListingCase, ListingCaseAction, ReviewItem } from '../types'

type Props = {
  item: ReviewItem
  reviewCase: ListingCase
  onAction: (action: ListingCaseAction, reason: string) => void
  onClose: () => void
}

const statusLabels = {
  'needs-review': 'Needs review',
  investigating: 'Investigating',
  'waiting-for-info': 'Waiting for information',
  resolved: 'Resolved',
}

const actionLabels: Record<ListingCaseAction, string> = {
  'start-review': 'Review started',
  note: 'Internal note',
  'request-correction': 'Information requested',
  keep: 'Review closed',
  hide: 'Review closed',
  remove: 'Review closed',
  reopen: 'Review resumed',
}

export default function GeneralReviewCaseDetail({ item, reviewCase, onAction, onClose }: Props) {
  const [decision, setDecision] = useState<'request-correction' | 'keep'>('request-correction')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason.trim()) return
    onAction(reviewCase.status === 'needs-review' ? 'start-review' : reviewCase.status === 'investigating' ? decision : 'reopen', reason)
    setReason('')
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!note.trim()) return
    onAction('note', note)
    setNote('')
  }

  const isInvestigating = reviewCase.status === 'investigating'

  return (
    <section className="general-review-case" aria-labelledby="general-review-case-title">
      <header className="general-review-header">
        <div>
          <div className="general-review-tags">
            <span>{item.type}</span>
            <span className={`priority priority-${item.priority}`}>{item.priority} priority</span>
            <span className="general-review-status">{statusLabels[reviewCase.status]}</span>
          </div>
          <h3 id="general-review-case-title" tabIndex={-1}>{item.title}</h3>
          <p>{item.subject} · {item.createdLabel}</p>
        </div>
        <button type="button" className="listing-case-close" onClick={onClose} aria-label="Close review case">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
        </button>
      </header>

      <div className="general-review-layout">
        <div className="general-review-main">
          <section className="general-review-section" aria-labelledby="general-review-summary">
            <h4 id="general-review-summary">What needs review</h4>
            <p>{item.details}</p>
            <p className="general-review-source">Source: {reviewCase.reportedBy}</p>
          </section>
          <section className="general-review-section" aria-labelledby="general-review-evidence">
            <h4 id="general-review-evidence">Evidence and context</h4>
            <ul>{reviewCase.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
            <h5>Related history</h5>
            <ul>{reviewCase.relatedHistory.map((entry) => <li key={entry}>{entry}</li>)}</ul>
          </section>
          <section className="general-review-section" aria-labelledby="general-review-history">
            <h4 id="general-review-history">Case history</h4>
            {reviewCase.events.length ? <ol>{reviewCase.events.map((entry) => (
              <li key={entry.id}>
                <strong>{actionLabels[entry.action]}</strong>
                <time dateTime={entry.at}>{new Date(entry.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                <p>{entry.reason}</p>
              </li>
            ))}</ol> : <p>No actions recorded yet.</p>}
          </section>
        </div>

        <aside className="general-review-actions" aria-label="Case actions">
          <form className="general-review-section general-review-form" onSubmit={submitDecision}>
            <h4>{reviewCase.status === 'needs-review' ? 'Start review' : isInvestigating ? 'Record a decision' : 'Resume review'}</h4>
            <p>Actions are recorded in this local demo. They do not change a live account or send a message.</p>
            {isInvestigating && <label htmlFor="general-review-decision">Decision</label>}
            {isInvestigating && <select id="general-review-decision" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}>
              <option value="request-correction">Request information</option>
              <option value="keep">Close review with no change</option>
            </select>}
            <label htmlFor="general-review-reason">Reason</label>
            <textarea id="general-review-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required placeholder="Record what you checked and why" />
            <button type="submit" disabled={!reason.trim()}>{reviewCase.status === 'needs-review' ? 'Start review' : isInvestigating ? 'Save decision' : 'Resume review'}</button>
          </form>
          <form className="general-review-section general-review-form" onSubmit={submitNote}>
            <h4>Internal note</h4>
            <label htmlFor="general-review-note">Add a note to this case</label>
            <textarea id="general-review-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} required placeholder="Record your findings" />
            <button type="submit" disabled={!note.trim()}>Save note</button>
          </form>
        </aside>
      </div>
    </section>
  )
}
