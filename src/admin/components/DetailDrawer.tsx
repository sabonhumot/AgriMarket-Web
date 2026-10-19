import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { loadReportEvidenceUrl, resolveAdminReportCase, setAdminUserSuspension, type AdminActivity, type AdminReport, type AdminUser } from '../admin-data'
import { getSupabaseClient } from '../supabase'
import type { DashboardEvent } from '../dashboard-data'
import './DetailDrawer.css'

export type DetailModalTarget =
  | { type: 'user'; data: AdminUser }
  | { type: 'report'; data: AdminReport }
  | { type: 'activity'; data: AdminActivity }
  | { type: 'event'; data: DashboardEvent; managerName: string }

const humanize = (value: string) => value.replace(/[._]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const roleLabel = (value: string) => value.toLowerCase() === 'coordinator' ? 'Event Manager' : humanize(value)
const dateLabel = (value: string) => !value || Number.isNaN(Date.parse(value)) ? 'Not recorded' : new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
const eventDateLabel = (value: string | null) => !value ? 'Not recorded' : new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })
const eventTimeLabel = (value: string | null) => !value ? 'Not recorded' : new Date(`1970-01-01T${value}+08:00`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="record-field"><dt>{label}</dt><dd>{children}</dd></div> }
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="record-section"><h3>{title}</h3>{children}</section> }
function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const tone = ['active', 'approved', 'resolved', 'verified', 'success', 'completed', 'closed'].includes(normalized) ? 'success' : ['rejected', 'suspended', 'failed', 'banned'].includes(normalized) ? 'danger' : ['pending', 'pending_verification', 'open', 'waiting', 'investigating', 'submitted', 'under_review'].includes(normalized) ? 'attention' : 'neutral'
  return <span className={`record-status record-status-${tone}`}><i aria-hidden="true" />{humanize(value)}</span>
}
function RecordIcon({ type }: { type: DetailModalTarget['type'] }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type === 'report' ? <><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z" /><path d="M12 8v5m0 3v.1" /></> : type === 'event' ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></> : <><path d="M4 4v5h5M4.5 9a8 8 0 1 1-.2 6M12 8v4l3 2" /></>}</svg>
}

function ReportEvidence({ path, reportId }: { path: string | null; reportId: number }) {
  const [state, setState] = useState<{ url: string | null; error: boolean }>({ url: null, error: false })
  useEffect(() => {
    if (!path) return
    let active = true
    void Promise.resolve().then(() => loadReportEvidenceUrl(getSupabaseClient(), path))
      .then(url => { if (active) setState({ url, error: false }) })
      .catch(() => { if (active) setState({ url: null, error: true }) })
    return () => { active = false }
  }, [path])

  return <Section title="Screenshot evidence">
    {!path && <p className="record-note is-empty">No screenshot was attached to this report.</p>}
    {path && !state.url && !state.error && <p className="record-note is-empty" role="status">Loading screenshot…</p>}
    {path && state.error && <p className="record-note is-empty" role="alert">The screenshot could not be loaded. Close and reopen this report to try again.</p>}
    {state.url && <a className="record-evidence-link" href={state.url} target="_blank" rel="noopener noreferrer" aria-label={`Open screenshot evidence for case ${reportId} in a new tab`}>
      <img className="record-evidence-image" src={state.url} alt={`Screenshot evidence for case ${reportId}`} onError={() => setState({ url: null, error: true })} />
      <span>Open full-size screenshot ↗</span>
    </a>}
  </Section>
}

function ResolutionConfirmation({ reportId, outcome, notes, issueBuyerWarning, busy, error, onCancel, onConfirm }: { reportId: number; outcome: 'fulfilled' | 'not_fulfilled' | 'dismissed'; notes: string; issueBuyerWarning: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('.record-confirm-cancel')?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  const decision = outcome === 'fulfilled' ? 'Fulfilled' : outcome === 'not_fulfilled' ? 'Not fulfilled' : 'Dismiss report'
  const inventoryEffect = outcome === 'fulfilled' ? 'Finalize any held inventory.' : outcome === 'not_fulfilled' ? 'Release inventory if it is still held.' : 'Restore the reservation to its previous status.'
  return <dialog ref={dialogRef} className="record-confirm-dialog" aria-labelledby="record-confirm-heading" aria-describedby="record-confirm-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }} onClick={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className="record-confirm-content">
      <span className="record-confirm-eyebrow">Case #{reportId}</span>
      <h2 id="record-confirm-heading">Resolve this case?</h2>
      <p id="record-confirm-description">Review the decision before it is recorded.</p>
      <dl className="record-confirm-details">
        <div><dt>Decision</dt><dd>{decision}</dd></div>
        <div><dt>Inventory</dt><dd>{inventoryEffect}</dd></div>
        <div><dt>Buyer warning</dt><dd>{issueBuyerWarning ? 'Issue one warning and notify the buyer.' : 'No warning will be issued.'}</dd></div>
        <div><dt>Resolution notes</dt><dd className="record-confirm-notes">{notes.trim()}</dd></div>
      </dl>
      {error && <p className="record-resolution-error" role="alert">{error}</p>}
      <div className="record-confirm-actions">
        <button type="button" className="record-confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="record-done" onClick={onConfirm} disabled={busy}>{busy ? 'Resolving…' : 'Resolve case'}</button>
      </div>
    </div>
  </dialog>
}

function ReportResolution({ report, onResolved }: { report: AdminReport; onResolved: () => Promise<void> }) {
  const [outcome, setOutcome] = useState<'' | 'fulfilled' | 'not_fulfilled' | 'dismissed'>('')
  const [notes, setNotes] = useState('')
  const [issueBuyerWarning, setIssueBuyerWarning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reportedBuyer = report.reportedUserId != null && report.reportedUserId === report.buyerId
  const open = ['open', 'under_review'].includes(report.status.toLowerCase())

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!outcome || !notes.trim() || busy) return
    setError(null)
    setConfirming(true)
  }

  async function confirmResolution() {
    if (!outcome || !notes.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await resolveAdminReportCase(getSupabaseClient(), { reportId: report.id, outcome, notes, issueBuyerWarning })
      await onResolved()
      toast.success(`Case #${report.id} resolved${issueBuyerWarning ? ' and buyer warning issued' : ''}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The report could not be resolved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <Section title="Resolve case">
    {reportedBuyer && <div className={`record-warning-count${report.buyerWarningCount >= 4 ? ' needs-review' : ''}`}><strong>{report.buyerWarningCount} {report.buyerWarningCount === 1 ? 'buyer warning' : 'buyer warnings'}</strong>{report.buyerWarningCount >= 4 && <span>Suspension review needed</span>}</div>}
    {!open ? <><p className="record-note is-empty">This case has been closed.</p>{report.resolutionNotes && <p className="record-note record-resolution-notes">{report.resolutionNotes}</p>}</> : <form className="record-resolution-form" onSubmit={event => { void submit(event) }}>
      <label htmlFor="report-outcome">Decision</label>
      <select id="report-outcome" value={outcome} onChange={event => { setOutcome(event.target.value as typeof outcome); setIssueBuyerWarning(false) }} required disabled={busy}>
        <option value="">Choose an outcome</option><option value="fulfilled">Fulfilled — finalize held inventory</option><option value="not_fulfilled">Not fulfilled — release inventory if held</option><option value="dismissed">Dismiss report — restore previous status</option>
      </select>
      {reportedBuyer && <label className="record-warning-option"><input type="checkbox" checked={issueBuyerWarning} onChange={event => setIssueBuyerWarning(event.target.checked)} disabled={busy || outcome !== 'not_fulfilled'} /><span>Issue a warning to this buyer if the report is proven true. One warning is recorded for this case.</span></label>}
      <label htmlFor="report-resolution-notes">Resolution notes</label>
      <textarea id="report-resolution-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} rows={4} required disabled={busy} placeholder="Explain the evidence and decision" />
      {issueBuyerWarning && <p className="record-resolution-hint">The buyer will be notified. A fourth warning flags the account for admin suspension review; it does not suspend the account.</p>}
      {error && <p className="record-resolution-error" role="alert">{error}</p>}
      <button type="submit" className="record-done" disabled={busy || !outcome || !notes.trim()}>{busy ? 'Resolving…' : 'Review resolution'}</button>
    </form>}
    {confirming && outcome && <ResolutionConfirmation reportId={report.id} outcome={outcome} notes={notes} issueBuyerWarning={issueBuyerWarning} busy={busy} error={error} onCancel={() => { setConfirming(false); setError(null) }} onConfirm={() => { void confirmResolution() }} />}
  </Section>
}

function UserActionConfirmation({ user, suspend, reason, busy, error, onCancel, onConfirm }: { user: AdminUser; suspend: boolean; reason: string; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('.record-confirm-cancel')?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  const accountType = roleLabel(user.role).toLowerCase()
  return <dialog ref={dialogRef} className="record-confirm-dialog" aria-labelledby="user-confirm-heading" aria-describedby="user-confirm-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }} onClick={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className="record-confirm-content">
      <span className="record-confirm-eyebrow">{roleLabel(user.role)} #{user.id}</span>
      <h2 id="user-confirm-heading">{suspend ? `Suspend this ${accountType}?` : `Reactivate this ${accountType}?`}</h2>
      <p id="user-confirm-description">{suspend ? 'This account will be suspended until an admin reactivates it.' : 'The account will become active unless another report restriction still applies.'}</p>
      <dl className="record-confirm-details">
        <div><dt>Account</dt><dd>{user.name}</dd></div>
        <div><dt>Reason</dt><dd className="record-confirm-notes">{reason.trim()}</dd></div>
      </dl>
      {error && <p className="record-resolution-error" role="alert">{error}</p>}
      <div className="record-confirm-actions">
        <button type="button" className="record-confirm-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="record-done" onClick={onConfirm} disabled={busy}>{busy ? 'Saving…' : suspend ? `Suspend ${accountType}` : `Reactivate ${accountType}`}</button>
      </div>
    </div>
  </dialog>
}

function UserActions({ user, reports, onUpdated, onOpenReport }: { user: AdminUser; reports: AdminReport[]; onUpdated: () => Promise<void>; onOpenReport: (report: AdminReport) => void }) {
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suspendedByAdmin = Boolean(user.manuallySuspendedAt)
  const canSuspend = user.status === 'active'
  const canReactivate = user.status === 'suspended' && suspendedByAdmin
  const suspend = !canReactivate
  const userReports = reports.filter(report => report.reportedUserId === user.id)
  const accountType = roleLabel(user.role).toLowerCase()

  async function confirmAction() {
    if (!reason.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await setAdminUserSuspension(getSupabaseClient(), { userId: user.id, suspend, reason })
      await onUpdated()
      toast.success(`${user.name} ${suspend ? 'suspended' : 'reactivated'}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The account could not be updated. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <Section title="Account action">
      {suspendedByAdmin && <p className="record-note">Suspended by an admin on {dateLabel(user.manuallySuspendedAt ?? '')}. Reason: {user.manualSuspensionReason}</p>}
      {canSuspend || canReactivate ? <form className="record-resolution-form record-user-action-form" onSubmit={event => { event.preventDefault(); if (reason.trim()) { setError(null); setConfirming(true) } }}>
        <p className="record-resolution-hint">{canSuspend ? 'Review this account and enter a reason before suspending it.' : 'Reactivation lifts this manual suspension. Another active report restriction may still keep the account suspended.'}</p>
        <label htmlFor="user-action-reason">Reason for {suspend ? 'suspension' : 'reactivation'}</label>
        <textarea id="user-action-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={3} required disabled={busy} placeholder="Explain this account decision" />
        {error && <p className="record-resolution-error" role="alert">{error}</p>}
        <button type="submit" className="record-done" disabled={!reason.trim() || busy}>{suspend ? `Suspend ${accountType}` : `Reactivate ${accountType}`}</button>
      </form> : <p className="record-note is-empty">{user.status === 'suspended' ? 'This suspension was created by another process and cannot be lifted here.' : 'No account action is available for this status.'}</p>}
    </Section>
    <Section title="Reports about this user">
      {userReports.length ? <ul className="record-user-reports">{userReports.map(report => <li key={report.id}><button type="button" onClick={() => onOpenReport(report)}><strong>Case #{report.id}: {report.reason}</strong><span>{humanize(report.status)} · {dateLabel(report.createdAt)}</span></button></li>)}</ul> : <p className="record-note is-empty">No reports about this user.</p>}
    </Section>
    {confirming && <UserActionConfirmation user={user} suspend={suspend} reason={reason} busy={busy} error={error} onCancel={() => { setConfirming(false); setError(null) }} onConfirm={() => { void confirmAction() }} />}
  </>
}

export default function DetailDrawer({ target, reports, onClose, onReportResolved, onUserUpdated, onOpenReport }: { target: DetailModalTarget; reports: AdminReport[]; onClose: () => void; onReportResolved: () => Promise<void>; onUserUpdated: () => Promise<void>; onOpenReport: (report: AdminReport) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeTimer = useRef<number | null>(null)
  const closingRef = useRef(false)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog.dataset.motion = previousFocus?.matches(':focus-visible') ? 'false' : 'true'
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    dialog.querySelector<HTMLButtonElement>('.record-close')?.focus({ preventScroll: true })
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  function requestClose(animate: boolean) {
    if (closingRef.current) return
    const dialog = dialogRef.current
    if (!animate || dialog?.dataset.motion !== 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    closingRef.current = true
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 260)
  }
  const heading = { user: 'User details', report: 'Report details', activity: 'Activity details', event: 'Event details' }[target.type]
  const title = target.type === 'user' ? target.data.name : target.type === 'report' ? target.data.reason : target.type === 'event' ? target.data.event_name : humanize(target.data.action)
  const reference = target.type === 'event' ? `Event #${target.data.market_event_id}` : `${target.type === 'report' ? 'Case' : target.type === 'user' ? 'User' : 'Log'} #${target.data.id}`
  return <dialog ref={dialogRef} className="record-dialog" aria-labelledby="record-dialog-heading" data-closing={closing} onCancel={event => { event.preventDefault(); requestClose(false) }} onClick={event => { if (event.target === event.currentTarget) requestClose(event.detail !== 0) }} onTransitionEnd={event => { if (closing && event.target === event.currentTarget && event.propertyName === 'transform') onClose() }}>
    <div className="record-dialog-layout">
      <header className="record-header"><div><h2 id="record-dialog-heading">{heading}</h2><p>{reference}</p></div><button type="button" className="record-close" onClick={event => requestClose(event.detail !== 0)} aria-label="Close details"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
      <div className="record-body">
        <div className="record-summary"><span className={`record-symbol${target.type === 'user' ? ' is-person' : ''}`} aria-hidden="true">{target.type === 'user' ? target.data.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?' : <RecordIcon type={target.type} />}</span><div className="record-summary-content"><h3>{title}</h3>{target.type === 'user' && <p>{target.data.email || 'No email recorded'}</p>}<div className="record-summary-meta">{target.type === 'user' && <span className="record-type">{roleLabel(target.data.role)}</span>}{target.type !== 'activity' && <Status value={target.data.status} />}{target.type === 'activity' && <span className="record-type">{humanize(target.data.entityType)}</span>}</div></div></div>
        {target.type === 'user' && <>
          <Section title="Account information"><dl className="record-fields"><Field label="User ID">#{target.data.id}</Field><Field label="Role">{roleLabel(target.data.role)}</Field><Field label="Account status"><Status value={target.data.status} /></Field><Field label="Registered">{dateLabel(target.data.createdAt)}</Field>{target.data.role === 'buyer' && <Field label="Buyer warnings">{target.data.buyerWarningCount}{target.data.buyerWarningCount >= 4 && ' · Suspension review needed'}</Field>}</dl></Section>
          <Section title="Contact details"><dl className="record-fields"><Field label="Full name">{target.data.name}</Field><Field label="Email address">{target.data.email || 'Not recorded'}</Field></dl></Section>
          {target.data.role !== 'admin' && <UserActions user={target.data} reports={reports} onUpdated={onUserUpdated} onOpenReport={onOpenReport} />}
        </>}
        {target.type === 'report' && <>
          <Section title="People involved"><dl className="record-fields"><Field label="Reporter">{target.data.reporter}</Field><Field label="Reported user">{target.data.subject}</Field></dl></Section>
          <Section title="Report information"><dl className="record-fields"><Field label="Case ID">#{target.data.id}</Field><Field label="Filed">{dateLabel(target.data.createdAt)}</Field></dl><h4 className="record-note-label">Description</h4><p className={`record-note${target.data.description ? '' : ' is-empty'}`}>{target.data.description || 'No additional description was provided.'}</p></Section>
          <ReportEvidence key={target.data.id} path={target.data.evidencePath} reportId={target.data.id} />
          <Section title="Resolution"><p className={`record-note${target.data.outcome ? ' record-outcome' : ' is-empty'}`}>{target.data.outcome ? humanize(target.data.outcome) : 'No resolution outcome has been recorded.'}</p></Section>
          <ReportResolution key={target.data.id} report={target.data} onResolved={onReportResolved} />
        </>}
        {target.type === 'event' && <>
          <Section title="Event information"><dl className="record-fields"><Field label="Event ID">#{target.data.market_event_id}</Field><Field label="Type">{target.data.event_type ? humanize(target.data.event_type) : 'Not recorded'}</Field><Field label="Status"><Status value={target.data.status} /></Field><Field label="Event Manager">{target.managerName}</Field></dl></Section>
          <Section title="Schedule & location"><dl className="record-fields"><Field label="Starts">{eventDateLabel(target.data.event_date)}{target.data.start_time && ` · ${eventTimeLabel(target.data.start_time)}`}</Field><Field label="Ends">{eventDateLabel(target.data.end_date || target.data.event_date)}{target.data.end_time && ` · ${eventTimeLabel(target.data.end_time)}`}</Field><Field label="Venue">{target.data.venue_name || 'Not recorded'}</Field><Field label="Location">{target.data.location || 'Not recorded'}</Field></dl></Section>
          <Section title="Description"><p className={`record-note${target.data.description ? '' : ' is-empty'}`}>{target.data.description || 'No description was provided.'}</p></Section>
        </>}
        {target.type === 'activity' && <>
          <Section title="Activity information"><dl className="record-fields"><Field label="Actor">{target.data.actor}</Field><Field label="Recorded">{dateLabel(target.data.createdAt)}</Field><Field label="Log ID">#{target.data.id}</Field></dl></Section>
          <Section title="Recorded action"><dl className="record-fields"><Field label="Action"><code className="record-action-code">{target.data.action}</code></Field><Field label="Record type">{humanize(target.data.entityType)}</Field><Field label="Record ID">{target.data.entityId == null ? 'Not recorded' : `#${target.data.entityId}`}</Field></dl></Section>
        </>}
      </div>
      <footer className="record-footer"><span>Times shown in Philippine time</span><button type="button" className="record-done" onClick={event => requestClose(event.detail !== 0)}>Done</button></footer>
    </div>
  </dialog>
}
