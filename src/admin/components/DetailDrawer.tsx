import { useEffect, useRef, type ReactNode } from 'react'
import type { AdminActivity, AdminApplication, AdminReport, AdminUser } from '../admin-data'
import './DetailDrawer.css'

export type DetailModalTarget =
  | { type: 'user'; data: AdminUser }
  | { type: 'application'; data: AdminApplication }
  | { type: 'report'; data: AdminReport }
  | { type: 'activity'; data: AdminActivity }

const humanize = (value: string) => value.replace(/[._]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const roleLabel = (value: string) => value.toLowerCase() === 'coordinator' ? 'Event Manager' : humanize(value)
const dateLabel = (value: string) => !value || Number.isNaN(Date.parse(value)) ? 'Not recorded' : new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="record-field"><dt>{label}</dt><dd>{children}</dd></div> }
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="record-section"><h3>{title}</h3>{children}</section> }
function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const tone = ['active', 'approved', 'resolved', 'verified', 'success', 'completed', 'closed'].includes(normalized) ? 'success' : ['rejected', 'suspended', 'failed', 'banned'].includes(normalized) ? 'danger' : ['pending', 'pending_verification', 'open', 'waiting', 'investigating', 'submitted', 'under_review'].includes(normalized) ? 'attention' : 'neutral'
  return <span className={`record-status record-status-${tone}`}><i aria-hidden="true" />{humanize(value)}</span>
}
function RecordIcon({ type }: { type: DetailModalTarget['type'] }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type === 'application' ? <path d="M7 3h8l4 4v14H5V3zm7 0v5h5M8 12h8m-8 4h6" /> : type === 'report' ? <><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z" /><path d="M12 8v5m0 3v.1" /></> : <><path d="M4 4v5h5M4.5 9a8 8 0 1 1-.2 6M12 8v4l3 2" /></>}</svg>
}

export default function DetailDrawer({ target, onClose }: { target: DetailModalTarget; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
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
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  const heading = { user: 'User details', application: 'Application details', report: 'Report details', activity: 'Activity details' }[target.type]
  const title = target.type === 'user' ? target.data.name : target.type === 'application' ? target.data.title : target.type === 'report' ? target.data.reason : humanize(target.data.action)
  const reference = target.type === 'application' ? target.data.id : `${target.type === 'report' ? 'Case' : target.type === 'user' ? 'User' : 'Log'} #${target.data.id}`
  return <dialog ref={dialogRef} className="record-dialog" aria-labelledby="record-dialog-heading" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="record-dialog-layout">
      <header className="record-header"><div><h2 id="record-dialog-heading">{heading}</h2><p>{reference}</p></div><button type="button" className="record-close" onClick={onClose} aria-label="Close details"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
      <div className="record-body">
        <div className="record-summary"><span className={`record-symbol${target.type === 'user' ? ' is-person' : ''}`} aria-hidden="true">{target.type === 'user' ? target.data.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?' : <RecordIcon type={target.type} />}</span><div className="record-summary-content"><h3>{title}</h3>{target.type === 'user' && <p>{target.data.email || 'No email recorded'}</p>}<div className="record-summary-meta">{target.type === 'user' && <span className="record-type">{roleLabel(target.data.role)}</span>}{target.type === 'application' && <span className="record-type">{target.data.kind}</span>}{target.type !== 'activity' && <Status value={target.data.status} />}{target.type === 'activity' && <span className="record-type">{humanize(target.data.entityType)}</span>}</div></div></div>
        {target.type === 'user' && <>
          <Section title="Account information"><dl className="record-fields"><Field label="User ID">#{target.data.id}</Field><Field label="Role">{roleLabel(target.data.role)}</Field><Field label="Account status"><Status value={target.data.status} /></Field><Field label="Registered">{dateLabel(target.data.createdAt)}</Field></dl></Section>
          <Section title="Contact details"><dl className="record-fields"><Field label="Full name">{target.data.name}</Field><Field label="Email address">{target.data.email || 'Not recorded'}</Field></dl></Section>
        </>}
        {target.type === 'application' && <>
          <Section title="Application information"><dl className="record-fields"><Field label="Applicant">{target.data.applicant}</Field><Field label="Type">{target.data.kind}</Field><Field label="Application ID">{target.data.id}</Field><Field label="Submitted">{dateLabel(target.data.submittedAt)}</Field></dl></Section>
          <Section title="Review notes"><p className={`record-note${target.data.detail ? '' : ' is-empty'}`}>{target.data.detail || 'No review notes have been recorded.'}</p></Section>
        </>}
        {target.type === 'report' && <>
          <Section title="People involved"><dl className="record-fields"><Field label="Reporter">{target.data.reporter}</Field><Field label="Reported user">{target.data.subject}</Field></dl></Section>
          <Section title="Report information"><dl className="record-fields"><Field label="Case ID">#{target.data.id}</Field><Field label="Filed">{dateLabel(target.data.createdAt)}</Field></dl><h4 className="record-note-label">Description</h4><p className={`record-note${target.data.description ? '' : ' is-empty'}`}>{target.data.description || 'No additional description was provided.'}</p></Section>
          <Section title="Resolution"><p className={`record-note${target.data.outcome ? ' record-outcome' : ' is-empty'}`}>{target.data.outcome ? humanize(target.data.outcome) : 'No resolution outcome has been recorded.'}</p></Section>
        </>}
        {target.type === 'activity' && <>
          <Section title="Activity information"><dl className="record-fields"><Field label="Actor">{target.data.actor}</Field><Field label="Recorded">{dateLabel(target.data.createdAt)}</Field><Field label="Log ID">#{target.data.id}</Field></dl></Section>
          <Section title="Recorded action"><dl className="record-fields"><Field label="Action"><code className="record-action-code">{target.data.action}</code></Field><Field label="Record type">{humanize(target.data.entityType)}</Field><Field label="Record ID">{target.data.entityId == null ? 'Not recorded' : `#${target.data.entityId}`}</Field></dl></Section>
        </>}
      </div>
      <footer className="record-footer"><span>Times shown in Philippine time</span><button type="button" className="record-done" onClick={onClose}>Done</button></footer>
    </div>
  </dialog>
}
