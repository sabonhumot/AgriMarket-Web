import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import AppSelect from '../../components/AppSelect'
import { toast } from 'sonner'
import { loadReportEvidenceUrl, resolveAdminReportCase, setAdminUserSuspension, type AdminActivity, type AdminReport, type AdminUser } from '../admin-data'
import { getSupabaseClient } from '../supabase'
import { regenerateManagerInvite, type InviteHandoff as Handoff } from '../event-manager-invites'
import InviteHandoff from './InviteHandoff'
import AdminUserAvatar from './AdminUserAvatar'
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
function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) { return <section className={`record-section ${className}`}><h3>{title}</h3>{children}</section> }
function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const tone = ['active', 'approved', 'resolved', 'verified', 'success', 'completed', 'closed'].includes(normalized) ? 'success' : ['rejected', 'suspended', 'failed', 'banned'].includes(normalized) ? 'danger' : ['pending', 'pending_verification', 'open', 'waiting', 'investigating', 'submitted', 'under_review'].includes(normalized) ? 'attention' : 'neutral'
  return <span className={`record-status record-status-${tone}`}><i aria-hidden="true" />{humanize(value)}</span>
}
function EventCover({ url, name }: { url?: string | null; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (!url || failedUrl === url) return null
  return <div className="record-event-cover"><img src={url} alt={`Cover photo for ${name}`} onError={() => setFailedUrl(url)} /></div>
}

function EvidencePreview({ url, reportId, onClose, onError }: { url: string; reportId: number; onClose: () => void; onError: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('.record-evidence-close')?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={dialogRef} className="record-evidence-preview" aria-label={`Screenshot evidence for case ${reportId}`} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="record-evidence-preview-content">
      <header><div><span>Screenshot evidence</span><strong>Case #{reportId}</strong></div><button type="button" className="record-evidence-close" onClick={onClose} aria-label="Close screenshot preview">Close</button></header>
      <img src={url} alt={`Screenshot evidence for case ${reportId}`} onError={onError} />
    </div>
  </dialog>
}

function ReportEvidence({ path, reportId }: { path: string | null; reportId: number }) {
  const [state, setState] = useState<{ url: string | null; error: boolean }>({ url: null, error: false })
  const [previewOpen, setPreviewOpen] = useState(false)
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
    {state.url && <button type="button" className="record-evidence-link" onClick={() => setPreviewOpen(true)} aria-label={`Preview screenshot evidence for case ${reportId}`}>
      <img className="record-evidence-image" src={state.url} alt={`Screenshot evidence for case ${reportId}`} onError={() => setState({ url: null, error: true })} />
      <span>View full-size screenshot</span>
    </button>}
    {previewOpen && state.url && <EvidencePreview url={state.url} reportId={reportId} onClose={() => setPreviewOpen(false)} onError={() => { setPreviewOpen(false); setState({ url: null, error: true }) }} />}
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
      <AppSelect id="report-outcome" label="Decision" value={outcome} onChange={value => { setOutcome(value as typeof outcome); setIssueBuyerWarning(false) }} disabled={busy} options={[{ value: '', label: 'Choose an outcome' }, { value: 'fulfilled', label: 'Fulfilled — finalize held inventory' }, { value: 'not_fulfilled', label: 'Not fulfilled — release inventory if held' }, { value: 'dismissed', label: 'Dismiss report — restore previous status' }]} />
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

function UserActions({ user, onUpdated }: { user: AdminUser; onUpdated: () => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suspendedByAdmin = Boolean(user.manuallySuspendedAt)
  const canSuspend = user.status === 'active'
  const canReactivate = user.status === 'suspended' && suspendedByAdmin
  const suspend = !canReactivate
  const accountType = roleLabel(user.role).toLowerCase()

  async function confirmAction() {
    if (!reason.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await setAdminUserSuspension(getSupabaseClient(), { userId: user.id, suspend, reason })
      await onUpdated()
      if (!suspend && result.status === 'suspended') {
        toast.info('Manual suspension lifted, but an active report restriction still applies.')
      } else {
        toast.success(`${user.name} ${suspend ? 'suspended' : 'reactivated'}`)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' ? cause.message : null
      setError(message || 'The account could not be updated. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <Section title="Account action" className="record-user-action-section">
      {suspendedByAdmin && <p className="record-note">Suspended by an admin on {dateLabel(user.manuallySuspendedAt ?? '')}. Reason: {user.manualSuspensionReason}</p>}
      {canSuspend || canReactivate ? <form className="record-resolution-form record-user-action-form" data-action={suspend ? 'suspend' : 'reactivate'} onSubmit={event => { event.preventDefault(); if (reason.trim()) { setError(null); setConfirming(true) } }}>
        <p className="record-resolution-hint">{canSuspend ? 'Review this account and enter a reason before suspending it.' : 'Reactivation lifts this manual suspension. Another active report restriction may still keep the account suspended.'}</p>
        <label htmlFor="user-action-reason">Reason for {suspend ? 'suspension' : 'reactivation'}</label>
        <textarea id="user-action-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={3} required disabled={busy} placeholder="Explain this account decision" />
        {error && <p className="record-resolution-error" role="alert">{error}</p>}
        <button type="submit" className="record-done" disabled={!reason.trim() || busy}>{suspend ? `Suspend ${accountType}` : `Reactivate ${accountType}`}</button>
      </form> : <p className="record-note is-empty">{user.status === 'suspended' ? 'This suspension was created by another process and cannot be lifted here.' : 'No account action is available for this status.'}</p>}
    </Section>
    {confirming && <UserActionConfirmation user={user} suspend={suspend} reason={reason} busy={busy} error={error} onCancel={() => { setConfirming(false); setError(null) }} onConfirm={() => { void confirmAction() }} />}
  </>
}

function UserReports({ user, reports, onOpenReport }: { user: AdminUser; reports: AdminReport[]; onOpenReport: (report: AdminReport) => void }) {
  const userReports = reports.filter(report => report.reportedUserId === user.id)
  return <Section title="Reports about this user" className="record-user-reports-section">
    {userReports.length ? <ul className="record-user-reports">{userReports.map(report => <li key={report.id}><button type="button" onClick={() => onOpenReport(report)}><span className="record-user-report-id">Case #{report.id}</span><strong>{report.reason}</strong><span className="record-user-report-meta">{humanize(report.status)} · {dateLabel(report.createdAt)}</span><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg></button></li>)}</ul> : <p className="record-note is-empty">No reports about this user.</p>}
  </Section>
}

function PendingManagerInvite({ user }: { user: AdminUser }) {
  const [invite, setInvite] = useState<Handoff | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function regenerate() {
    setBusy(true); setError(''); setInvite(null)
    try { setInvite(await regenerateManagerInvite(getSupabaseClient(), user.id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The invitation could not be generated.') }
    finally { setBusy(false) }
  }
  return <Section title="Event Manager invitation">
    {!invite && <p className="record-resolution-hint">This account is waiting for its owner to complete browser setup and choose a password.</p>}
    {invite ? <InviteHandoff invite={invite} /> : <button type="button" className="record-done record-invite-regenerate" disabled={busy} onClick={() => void regenerate()}>{busy ? 'Generating…' : 'Generate new invite'}</button>}
    {error && <p className="record-resolution-error" role="alert">{error}</p>}
  </Section>
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
  return <dialog ref={dialogRef} className="record-dialog" aria-labelledby="record-dialog-heading" data-record-type={target.type} data-closing={closing} onCancel={event => { event.preventDefault(); requestClose(false) }} onClick={event => { if (event.target === event.currentTarget) requestClose(event.detail !== 0) }} onTransitionEnd={event => { if (closing && event.target === event.currentTarget && event.propertyName === 'transform') onClose() }}>
    <div className="record-dialog-layout">
      <header className="record-header"><div><h2 id="record-dialog-heading">{heading}</h2><p>{reference}</p></div><button type="button" className="record-close" onClick={event => requestClose(event.detail !== 0)} aria-label="Close details"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
      <div className="record-body">
        {target.type === 'event' ? <><EventCover url={target.data.coverPhotoUrl} name={target.data.event_name} /><div className="record-event-hero"><h3>{title}</h3><div className="record-event-hero-meta"><Status value={target.data.status} /><span>{target.data.event_type ? humanize(target.data.event_type) : 'Market event'}</span></div></div></> : target.type === 'report' ? <div className="record-report-hero"><span className="record-hero-eyebrow">Case #{target.data.id} · Filed {dateLabel(target.data.createdAt)}</span><h3>{title}</h3><div className="record-report-hero-meta"><Status value={target.data.status} />{target.data.outcome && <span className="record-hero-tag">{humanize(target.data.outcome)}</span>}</div></div> : target.type === 'activity' ? <div className="record-activity-hero"><span className="record-hero-eyebrow">Log #{target.data.id} · {dateLabel(target.data.createdAt)}</span><h3>{title}</h3><span className="record-hero-tag">{humanize(target.data.entityType)}{target.data.entityId == null ? '' : ` #${target.data.entityId}`}</span></div> : <div className="record-summary"><AdminUserAvatar name={target.data.name} role={target.data.role} photoUrl={target.data.photoUrl} large /><div className="record-summary-content"><h3>{title}</h3><p>{target.data.email || 'No email recorded'}</p><div className="record-summary-meta"><span className={`record-user-role record-user-role-${target.data.role.toLowerCase()}`}>{roleLabel(target.data.role)}</span><Status value={target.data.status} /></div><span className="record-user-joined">Joined {dateLabel(target.data.createdAt)}</span>{target.data.role === 'buyer' && target.data.buyerWarningCount > 0 && <span className="record-user-warnings">{target.data.buyerWarningCount} {target.data.buyerWarningCount === 1 ? 'buyer warning' : 'buyer warnings'}{target.data.buyerWarningCount >= 4 && ' · Suspension review needed'}</span>}</div></div>}
        {target.type === 'user' && <>
          {target.data.role === 'coordinator' && target.data.status === 'pending_verification' && <PendingManagerInvite user={target.data} />}
          {target.data.role !== 'admin' && <><UserReports user={target.data} reports={reports} onOpenReport={onOpenReport} /><UserActions user={target.data} onUpdated={onUserUpdated} /></>}
        </>}
        {target.type === 'report' && <>
          <Section title="People involved" className="record-report-people"><div className="record-people-grid"><div><span>Reported by</span><strong>{target.data.reporter}</strong></div><div><span>Reported account</span><strong>{target.data.subject}</strong></div></div></Section>
          <Section title="Report details"><h4 className="record-note-label">Description</h4><p className={`record-note${target.data.description ? '' : ' is-empty'}`}>{target.data.description || 'No additional description was provided.'}</p></Section>
          <ReportEvidence key={target.data.id} path={target.data.evidencePath} reportId={target.data.id} />
          {target.data.outcome && <Section title="Recorded outcome"><p className="record-note record-outcome">{humanize(target.data.outcome)}</p></Section>}
          <ReportResolution key={target.data.id} report={target.data} onResolved={onReportResolved} />
        </>}
        {target.type === 'event' && <>
          <Section title="Event overview"><dl className="record-fields"><Field label="Event ID">#{target.data.market_event_id}</Field><Field label="Event Manager">{target.managerName}</Field></dl></Section>
          <Section title="Schedule and venue"><dl className="record-fields"><Field label="Starts">{eventDateLabel(target.data.event_date)}{target.data.start_time && ` · ${eventTimeLabel(target.data.start_time)}`}</Field><Field label="Ends">{eventDateLabel(target.data.end_date || target.data.event_date)}{target.data.end_time && ` · ${eventTimeLabel(target.data.end_time)}`}</Field><Field label="Venue">{target.data.venue_name || 'Not recorded'}</Field><Field label="Location">{target.data.location || 'Not recorded'}</Field></dl></Section>
          <Section title="Description"><p className={`record-note${target.data.description ? '' : ' is-empty'}`}>{target.data.description || 'No description was provided.'}</p></Section>
        </>}
        {target.type === 'activity' && <>
          <Section title="Performed by" className="record-activity-actor-section"><div className="record-activity-actor"><AdminUserAvatar name={target.data.actor} role={target.data.actorRole ?? 'system'} photoUrl={target.data.actorPhotoUrl} /><div><strong>{target.data.actor}</strong><span>{target.data.actorRole && target.data.actorRole !== 'system' ? roleLabel(target.data.actorRole) : 'System activity'}</span></div></div></Section>
          <Section title="Activity record"><dl className="record-fields"><Field label="Action">{humanize(target.data.action)}</Field><Field label="Record type">{humanize(target.data.entityType)}</Field><Field label="Record ID">{target.data.entityId == null ? 'Not recorded' : `#${target.data.entityId}`}</Field><Field label="Recorded">{dateLabel(target.data.createdAt)}</Field><Field label="Log ID">#{target.data.id}</Field></dl></Section>
        </>}
      </div>
      <footer className="record-footer"><span>Times shown in Philippine time</span><button type="button" className="record-done" onClick={event => requestClose(event.detail !== 0)}>Done</button></footer>
    </div>
  </dialog>
}
