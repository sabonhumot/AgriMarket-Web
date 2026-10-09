import { useEffect, useMemo, useRef, useState } from 'react'
import type { AdminMarketplaceReview } from '../admin-data'
import './UsersDirectory.css'
import './FarmerMarketplaceReviewQueue.css'

type Filter = 'pending_review' | 'approved' | 'changes_requested' | 'all'
type Decision = 'approved' | 'changes_requested'

const label: Record<AdminMarketplaceReview['status'], string> = {
  not_submitted: 'Not submitted',
  pending_review: 'Pending review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
}
const dateLabel = (value: string) => !value || Number.isNaN(Date.parse(value))
  ? 'Not recorded'
  : new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })

function FarmerAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const [imageFailed, setImageFailed] = useState(false)
  const initials = name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'F'

  return <span className="users-avatar farmer-approval-avatar" aria-hidden="true">
    {photoUrl && !imageFailed ? <img src={photoUrl} alt="" onError={() => setImageFailed(true)} /> : initials}
  </span>
}

type Props = {
  reviews: AdminMarketplaceReview[]
  onFaceCapture: (profileId: number) => Promise<string | null>
  onDecision: (review: AdminMarketplaceReview, decision: Decision, notes: string) => Promise<void>
  onRefresh: () => Promise<void>
  loading: boolean
}

export default function FarmerMarketplaceReviewQueue({ reviews, onFaceCapture, onDecision, onRefresh, loading }: Props) {
  const [filter, setFilter] = useState<Filter>('pending_review')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [active, setActive] = useState<AdminMarketplaceReview | null>(null)
  const [faceUrl, setFaceUrl] = useState<string | null>(null)
  const [faceState, setFaceState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [refreshFace, setRefreshFace] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pendingCount = reviews.filter((item) => item.status === 'pending_review').length
  const approvedCount = reviews.filter((item) => item.status === 'approved').length
  const changesCount = reviews.filter((item) => item.status === 'changes_requested').length
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return reviews.filter((item) => (filter === 'all' || item.status === filter)
      && (!q || [item.farmerName, item.farmName, item.municipality, item.barangay, String(item.profileId), String(item.userId)].some((value) => value.toLocaleLowerCase().includes(q))))
  }, [filter, query, reviews])
  const pages = Math.max(1, Math.ceil(filtered.length / 12))
  const currentPage = Math.min(page, pages - 1)
  const visible = filtered.slice(currentPage * 12, (currentPage + 1) * 12)

  useEffect(() => {
    if (!active) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    dialog.querySelector<HTMLButtonElement>('.farmer-review-close')?.focus({ preventScroll: true })
    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [Boolean(active)])

  useEffect(() => {
    if (!active) return
    let mounted = true
    setFaceUrl(null)
    setFaceState('loading')
    void onFaceCapture(active.profileId).then((url) => {
      if (!mounted) return
      setFaceUrl(url)
      setFaceState(url ? 'ready' : 'missing')
    }).catch(() => { if (mounted) setFaceState('error') })
    return () => { mounted = false }
  }, [active?.profileId, onFaceCapture, refreshFace])

  function openReview(review: AdminMarketplaceReview) {
    setActive(review)
    setNotes('')
    setError('')
    setMessage('')
  }

  async function decide(decision: Decision) {
    if (!active || saving || (decision === 'changes_requested' && !notes.trim())) return
    setSaving(true)
    setError('')
    try {
      await onDecision(active, decision, notes)
      await onRefresh()
      setMessage(decision === 'approved' ? `${active.farmName || active.farmerName} approved.` : `Changes requested from ${active.farmerName}.`)
      setActive(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The review could not be saved. Refresh the queue and try again.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="farmer-review-queue" aria-label="Farmer marketplace approvals">
    <div className="users-directory farmer-approvals-directory">
      <div className="users-role-tabs" aria-label="Filter farmer approvals">
        {([
          ['pending_review', 'Needs review', pendingCount],
          ['approved', 'Approved', approvedCount],
          ['changes_requested', 'Changes requested', changesCount],
          ['all', 'All profiles', reviews.length],
        ] as const).map(([value, title, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0) }}>{title}<span>{count.toLocaleString('en-PH')}</span></button>)}
      </div>
      <div className="users-directory-tools"><label className="users-search"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} placeholder="Search farmer, farm, or ID" aria-label="Search farmer approvals" /></label></div>
    <div className="users-results"><p role="status"><strong>{filtered.length.toLocaleString('en-PH')}</strong> {filtered.length === 1 ? 'profile' : 'profiles'} in this view</p>{query && <button type="button" onClick={() => { setQuery(''); setPage(0) }}>Clear search</button>}</div>
    <div className="users-table-scroll" role="region" aria-label="Farmer approvals" tabIndex={0} aria-busy={loading}>
      {visible.length ? <table className="users-table farmer-approvals-table"><thead><tr><th scope="col" className="users-id-column">ID</th><th scope="col">Farmer / farm</th><th scope="col">Location</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col"><span className="admin-sr-only">Review</span></th></tr></thead><tbody>
        {visible.map((review) => <tr key={review.profileId}>
          <td className="users-id-column">#{review.profileId}</td><td><div className="users-identity"><FarmerAvatar name={review.farmerName} photoUrl={review.profilePhotoUrl} /><div><button type="button" className="users-name" onClick={() => openReview(review)}>{review.farmerName}</button><span className="users-email">{review.farmName || 'Farm name not provided'}</span></div></div></td>
          <td><span className="farmer-review-location">{[review.barangay, review.municipality].filter(Boolean).join(', ') || 'Location not provided'}</span></td>
          <td><time dateTime={review.submittedAt || undefined}>{dateLabel(review.submittedAt)}</time></td>
          <td><span className={`users-status ${review.status === 'approved' ? 'users-status-active' : review.status === 'pending_review' ? 'users-status-pending_verification' : review.status === 'changes_requested' ? 'users-status-suspended' : ''}`}><i aria-hidden="true" />{label[review.status]}</span></td>
          <td><button type="button" className="users-view" aria-label={`Review farmer profile for ${review.farmerName}`} onClick={() => openReview(review)}>{review.status === 'pending_review' ? 'Review' : 'View'}<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 10h12m-4-4 4 4-4 4" /></svg></button></td>
        </tr>)}
      </tbody></table> : <div className="farmer-review-empty"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 5h14v14H5zM8 9h8m-8 4h5" /></svg></span><h3>{query ? 'No matching farmers' : filter === 'pending_review' ? 'No profiles waiting for review' : 'No profiles in this view'}</h3><p>{query ? 'Try a name, farm, location, or profile ID.' : 'Newly completed and verified farm profiles will appear here.'}</p></div>}
    </div>
    <footer className="users-pagination" aria-label="Farmer approvals pagination"><span>{filtered.length ? `${currentPage * 12 + 1}–${Math.min((currentPage + 1) * 12, filtered.length)} of ${filtered.length} profiles` : '0 profiles'}</span><div><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span aria-live="polite">Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>
    </div>
    {message && <p className="farmer-review-feedback is-success" role="status">{message}</p>}

    <dialog ref={dialogRef} className="farmer-review-dialog" aria-labelledby="farmer-review-dialog-title" onCancel={(event) => { event.preventDefault(); setActive(null) }} onClick={(event) => { if (event.target === event.currentTarget) setActive(null) }}>
      {active && <div className="farmer-review-dialog-layout">
        <header className="farmer-review-dialog-header"><div><p>Farmer profile · #{active.profileId}</p><h2 id="farmer-review-dialog-title">{active.farmName || active.farmerName}</h2></div><button type="button" className="farmer-review-close" aria-label="Close review" onClick={() => setActive(null)}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
        <div className="farmer-review-dialog-body">
          <div className="farmer-review-capture"><div className="farmer-review-capture-header"><div><h3>Onboarding face capture</h3><p>Private identity evidence · loaded for this review</p></div><button type="button" onClick={() => setRefreshFace((value) => value + 1)} disabled={faceState === 'loading'}>Reload preview</button></div>
            {faceState === 'loading' ? <div className="farmer-review-capture-state" role="status">Loading secure preview…</div>
              : faceState === 'ready' && faceUrl ? <img src={faceUrl} alt={`Onboarding face capture for ${active.farmerName}`} onError={() => { setFaceUrl(null); setFaceState('error') }} />
                : <div className="farmer-review-capture-state"><strong>{faceState === 'missing' ? 'Capture unavailable' : 'Preview could not load'}</strong><span>{faceState === 'missing' ? 'No approved onboarding image is available for this profile.' : 'The signed preview may have expired or the image is temporarily unavailable. Reload the preview to try again.'}</span></div>}
          </div>
          <section className="farmer-review-detail-section"><h3>Farmer details</h3><dl><div><dt>Farmer</dt><dd>{active.farmerName}</dd></div><div><dt>Email</dt><dd>{active.email || 'Not recorded'}</dd></div><div><dt>Mobile</dt><dd>{active.mobile || 'Not recorded'}</dd></div><div><dt>Submitted</dt><dd>{dateLabel(active.submittedAt)}</dd></div></dl></section>
          <section className="farmer-review-detail-section"><h3>Farm profile</h3><dl><div><dt>Farm</dt><dd>{active.farmName || 'Not provided'}</dd></div><div className="is-wide"><dt>Description</dt><dd>{active.farmDescription || 'Not provided'}</dd></div><div><dt>Municipality</dt><dd>{active.municipality || 'Not provided'}</dd></div><div><dt>Barangay</dt><dd>{active.barangay || 'Not provided'}</dd></div><div className="is-wide"><dt>Landmark</dt><dd>{active.landmark || 'Not provided'}</dd></div></dl></section>
          {active.status !== 'pending_review' && <section className="farmer-review-detail-section"><h3>Latest decision</h3><dl><div><dt>Status</dt><dd><span className={`farmer-review-status is-${active.status}`}><i aria-hidden="true" />{label[active.status]}</span></dd></div><div><dt>Reviewed by</dt><dd>{active.reviewedBy || 'Not recorded'}</dd></div><div><dt>Reviewed</dt><dd>{dateLabel(active.reviewedAt ?? '')}</dd></div><div className="is-wide"><dt>Note</dt><dd>{active.notes || 'No note recorded.'}</dd></div></dl></section>}
          {active.history.length > 0 && <section className="farmer-review-detail-section"><h3>Decision history</h3><ol className="farmer-review-history">{active.history.map((event, index) => <li key={`${event.createdAt}-${index}`}><strong>{label[event.decision as AdminMarketplaceReview['status']] ?? event.decision}</strong><span>{event.actor} · {dateLabel(event.createdAt)}</span>{event.notes && <p>{event.notes}</p>}</li>)}</ol></section>}
          {active.status === 'pending_review' && <section className="farmer-review-decision"><label htmlFor="farmer-review-notes">Review note <span>Optional for approval · required to request changes</span></label><textarea id="farmer-review-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="Tell the farmer what needs to change…" />{error && <p className="farmer-review-feedback is-error" role="alert">{error}</p>}<div className="farmer-review-decision-actions"><button type="button" className="farmer-review-request" onClick={() => void decide('changes_requested')} disabled={saving || !notes.trim()}>{saving ? 'Saving…' : 'Request changes'}</button><button type="button" className="farmer-review-approve" onClick={() => void decide('approved')} disabled={saving}>{saving ? 'Saving…' : 'Approve farm profile'}</button></div></section>}
          {active.status !== 'pending_review' && error && <p className="farmer-review-feedback is-error" role="alert">{error}</p>}
        </div>
        <footer className="farmer-review-dialog-footer"><span>Times shown in Philippine time</span><button type="button" onClick={() => setActive(null)}>Close</button></footer>
      </div>}
    </dialog>
  </section>
}
