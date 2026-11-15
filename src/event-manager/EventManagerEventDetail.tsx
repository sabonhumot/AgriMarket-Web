import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import AppSelect from '../components/AppSelect'
import { getSupabaseClient } from '../admin/supabase'
import { navigateWeb } from '../auth/web-navigation'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import {
  cancelEvent, checkInFarmer, createInviteLink, inviteFarmers, loadAttendance, loadEligibleFarmers,
  loadManagedEvent, loadSalesSummary, markNoShow, promoteEvent, recordsToCsv, reviewApplication, sendBroadcast,
  type ManagerEvent,
} from './events-service'
import { invalidateManagedEventsCache } from './managed-events-cache'
import { loadManagerFarmers, type ManagerFarmer } from './manager-service'
import './EventManagerOperations.css'
import './EventManagerEventDetail.css'

type DetailData = Awaited<ReturnType<typeof loadManagedEvent>>
type Row = Record<string, unknown>
type CameraState = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error'
type QrScannerInstance = import('../vendor/qr-scanner.min.js').default
const str = (value: unknown) => String(value ?? '')
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0
const array = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : []
const statusLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const eventStart = (event: ManagerEvent) => new Date(event.date + 'T' + event.startTime + '+08:00').getTime()
const eventEnd = (event: ManagerEvent) => new Date((event.endDate || event.date) + 'T' + event.endTime + '+08:00').getTime()
const isPublished = (event: ManagerEvent) => ['published', 'upcoming', 'ongoing', 'happening_now'].includes(event.databaseStatus)
const canEdit = (event: ManagerEvent, now: number) => event.databaseStatus === 'draft' || (isPublished(event) && eventStart(event) - now > 86400000)
const formatDate = (value: string) => {
  const date = new Date(value + 'T12:00:00+08:00')
  return Number.isNaN(date.getTime()) ? 'Date to be announced' : date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
}
const formatTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return value || 'Time to be announced'
  const hour = Number(match[1])
  return (hour % 12 || 12) + ':' + match[2] + ' ' + (hour >= 12 ? 'PM' : 'AM')
}
function downloadCsv(filename: string, rows: Row[]) {
  const csv = recordsToCsv(rows)
  if (!csv) throw new Error('There are no rows to export yet.')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
function BackLink() {
  return <a className="em-detail-back-link" href="/event-manager/events" onClick={(click) => navigateWeb(click, '/event-manager/events')}>← All events</a>
}

export default function EventManagerEventDetail({ eventId, onSignOut, initialData }: { eventId: string; onSignOut?: () => void | Promise<void>; initialData?: DetailData }) {
  const [data, setData] = useState<DetailData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [farmerQuery, setFarmerQuery] = useState('')
  const [farmers, setFarmers] = useState<Row[]>([])
  const [searchedFarmers, setSearchedFarmers] = useState(false)
  const [farmerSearchLoading, setFarmerSearchLoading] = useState(false)
  const [farmerSearchError, setFarmerSearchError] = useState<string | null>(null)
  const [selectedFarmers, setSelectedFarmers] = useState<number[]>([])
  const [invitedDirectory, setInvitedDirectory] = useState<Record<string, Pick<ManagerFarmer, 'name' | 'farmName'>>>({})
  const [inviteLink, setInviteLink] = useState('')
  const [qrPayload, setQrPayload] = useState('')
  const [checkInResult, setCheckInResult] = useState<Row | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [cameraMessage, setCameraMessage] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelNotes, setCancelNotes] = useState('')
  const [now, setNow] = useState(Date.now)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScannerInstance | null>(null)
  const cameraRun = useRef(0)
  const detectingRef = useRef(false)
  const farmerSearchRequest = useRef(0)
  const invitedDirectoryRef = useRef<Record<string, Pick<ManagerFarmer, 'name' | 'farmName'>>>({})

  const refresh = useCallback(async (notify = false) => {
    setLoading(true); setError(null)
    try { setData(await loadManagedEvent(getSupabaseClient(), eventId)); if (notify) toast.success('Event details refreshed.') }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Event details could not be loaded.'; setError(message); toast.error('Event details could not be loaded.', { description: message }) }
    finally { setLoading(false) }
  }, [eventId])
  useEffect(() => {
    if (initialData) return
    const timer = setTimeout(() => { void refresh() }, 0)
    return () => clearTimeout(timer)
  }, [initialData, refresh])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const stopCamera = useCallback(() => {
    cameraRun.current += 1
    scannerRef.current?.stop()
    scannerRef.current?.destroy()
    scannerRef.current = null
  }, [])
  useEffect(() => () => stopCamera(), [stopCamera])

  const applications = useMemo(() => array(data?.applications), [data])
  const pending = useMemo(() => applications.filter((row) => str(row.status) === 'pending'), [applications])
  const approved = useMemo(() => applications.filter((row) => ['approved', 'checked_in'].includes(str(row.status))), [applications])
  useEffect(() => {
    const unresolved = array(data?.invitations).some((row) => !str(row.farmer_name).trim() && !invitedDirectoryRef.current[str(row.farmer_id)])
    if (!unresolved) return
    let active = true
    void loadManagerFarmers(getSupabaseClient(), '').then((directory) => {
      if (!active) return
      const names = Object.fromEntries(directory.map((farmer) => [farmer.id, farmer]))
      invitedDirectoryRef.current = { ...invitedDirectoryRef.current, ...names }
      setInvitedDirectory(invitedDirectoryRef.current)
    }).catch(() => { /* Invitation statuses remain available if the directory cannot be loaded. */ })
    return () => { active = false }
  }, [data?.invitations])

  async function runAction<T>(action: () => Promise<T>, success: (result: T) => string): Promise<T | null> {
    if (busy) return null
    setBusy(true); setError(null); setNotice(null)
    let result: T
    try { result = await action() }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'The action could not be completed.'; setError(message); toast.error('Action could not be completed.', { description: message }); setBusy(false); return null }
    invalidateManagedEventsCache()
    window.dispatchEvent(new CustomEvent('event-manager-events-changed'))
    const message = success(result)
    setNotice(message)
    toast.success(message)
    try { setData(await loadManagedEvent(getSupabaseClient(), eventId)) }
    catch { const message = 'The action succeeded, but the latest event details could not be loaded. Reopen this event to see the latest details.'; setError(message); toast.error('Event details could not be loaded.', { description: message }) }
    setBusy(false)
    return result
  }
  async function review(row: Row, decision: 'approved' | 'rejected') {
    const id = num(row.application_id)
    if (decision === 'rejected') {
      if (rejectionReason.trim().length < 3) { setError('Add a short reason before rejecting this application.'); toast.error('Add a short reason before rejecting this application.'); return }
      if (!window.confirm('Reject ' + str(row.farmer_name) + "'s application?")) return
    }
    const result = await runAction(() => reviewApplication(getSupabaseClient(), id, decision, decision === 'approved' ? undefined : rejectionReason.trim()), () => decision === 'approved' ? 'Application approved.' : 'Application rejected.')
    if (result !== null) { setRejectingId(null); setRejectionReason('') }
  }
  const searchFarmers = useCallback(async (query: string) => {
    const currentRequest = ++farmerSearchRequest.current
    setFarmerSearchLoading(true)
    setFarmerSearchError(null)
    try {
      const results = await loadEligibleFarmers(getSupabaseClient(), eventId, query)
      if (currentRequest === farmerSearchRequest.current) { setFarmers(results); setSearchedFarmers(true) }
    } catch (cause) {
      if (currentRequest === farmerSearchRequest.current) setFarmerSearchError(cause instanceof Error ? cause.message : 'Eligible farmers could not be loaded.')
    } finally {
      if (currentRequest === farmerSearchRequest.current) setFarmerSearchLoading(false)
    }
  }, [eventId])
  useEffect(() => {
    if (!data || !isPublished(data.event) || Date.now() >= eventStart(data.event)) return
    const timer = setTimeout(() => { void searchFarmers(farmerQuery.trim()) }, farmerQuery.trim() ? 250 : 0)
    return () => { clearTimeout(timer); farmerSearchRequest.current += 1 }
  }, [data, farmerQuery, searchFarmers])
  async function sendInvitations() {
    if (!selectedFarmers.length) { setError('Select at least one eligible farmer.'); toast.error('Select at least one eligible farmer.'); return }
    if (!window.confirm('Send invitations to ' + selectedFarmers.length + ' selected farmer' + (selectedFarmers.length === 1 ? '' : 's') + '?')) return
    const selectedNames = Object.fromEntries(farmers.filter((farmer) => selectedFarmers.includes(num(farmer.id))).map((farmer) => [str(farmer.id), { name: str(farmer.name), farmName: str(farmer.farm_name) }]))
    const result = await runAction(() => inviteFarmers(getSupabaseClient(), eventId, selectedFarmers), (value) => value.sent + ' invitation' + (value.sent === 1 ? '' : 's') + ' sent' + (value.skipped ? '; ' + value.skipped + ' skipped' : '') + '.')
    if (result) {
      invitedDirectoryRef.current = { ...invitedDirectoryRef.current, ...selectedNames }
      setInvitedDirectory(invitedDirectoryRef.current)
      setSelectedFarmers([])
      document.getElementById('event-invited-farmers')?.scrollIntoView({ block: 'start' })
    }
  }
  async function makeLink() {
    const result = await runAction(async () => {
      const link = await createInviteLink(getSupabaseClient(), eventId)
      const url = str(link.url ?? link.token)
      if (!url) throw new Error('The invitation link was created without a shareable URL.')
      let copied = false
      try { await navigator.clipboard.writeText(url); copied = true } catch { /* The link remains visible for manual copying. */ }
      return { url, copied }
    }, (value) => value.copied ? 'Application link created and copied.' : 'Application link created. Copy it below.')
    if (result) setInviteLink(result.url)
  }
  async function checkIn(payload: string) {
    if (!payload.trim()) { setError('Paste the complete farmer Virtual ID QR payload.'); toast.error('Paste the complete farmer Virtual ID QR payload.'); return }
    if (scannerRef.current) { stopCamera(); setCameraState('idle') }
    const result = await runAction(() => checkInFarmer(getSupabaseClient(), eventId, payload.trim()), (value) => str(value.farmer_name || 'Farmer') + ' checked in successfully.')
    if (result) { setCheckInResult(result); setQrPayload('') }
  }
  async function startCamera() {
    if (cameraState === 'starting' || cameraState === 'scanning') return
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraMessage(window.isSecureContext ? 'This browser does not provide camera access. Use another browser or manual entry.' : 'Camera access requires HTTPS or localhost. Open the site over a secure connection or use manual entry.')
      return
    }
    const run = ++cameraRun.current
    setCameraState('starting'); setCameraMessage(''); setError(null)
    try {
      const { default: QrScanner } = await import('../vendor/qr-scanner.min.js')
      if (run !== cameraRun.current) return
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const video = videoRef.current
      if (!video) throw new Error('Camera preview is unavailable.')
      const scanner = new QrScanner(video, (result) => {
        if (detectingRef.current || run !== cameraRun.current) return
        detectingRef.current = true
        stopCamera()
        setCameraState('idle')
        void checkIn(result.data).finally(() => { detectingRef.current = false })
      }, { preferredCamera: 'environment', maxScansPerSecond: 8, returnDetailedScanResult: true })
      scannerRef.current = scanner
      await scanner.start()
      if (run !== cameraRun.current) return
      setCameraState('scanning')
    } catch (cause) {
      if (run !== cameraRun.current) return
      stopCamera()
      const denied = cause instanceof DOMException && cause.name === 'NotAllowedError'
      setCameraState(denied ? 'denied' : 'error')
      const message = denied ? 'Camera access was denied. Allow permission for this site and try again.' : cause instanceof DOMException && cause.name === 'NotFoundError' ? 'No camera was found on this device.' : cause instanceof DOMException && cause.name === 'NotReadableError' ? 'The camera is in use by another app. Close it and try again.' : cause instanceof Error ? cause.message : 'The camera could not be started.'
      setCameraMessage(message)
      toast.error(message)
    }
  }
  async function sendMessage(kind: 'broadcast' | 'promotion') {
    const prompt = kind === 'broadcast' ? 'Send this update to approved farmers?' : 'Promote this event to nearby buyers?'
    if (!window.confirm(prompt)) return
    const text = message.trim() || (kind === 'broadcast' ? 'Please review the latest event details in AgriMarket.' : data?.event.name || 'Market event')
    const action = kind === 'broadcast' ? () => sendBroadcast(getSupabaseClient(), eventId, text) : () => promoteEvent(getSupabaseClient(), eventId, text)
    const result = await runAction(action, () => kind === 'broadcast' ? 'Update sent to approved farmers.' : 'Event promoted to nearby buyers.')
    if (result !== null) setMessage('')
  }
  async function cancel() {
    if (!cancelReason) { setError('Choose a cancellation reason.'); toast.error('Choose a cancellation reason.'); return }
    if (cancelReason === 'Other' && cancelNotes.trim().length < 3) { setError('Add a short explanation for Other.'); toast.error('Add a short explanation for Other.'); return }
    if (!window.confirm('Cancel this event? Farmers and buyers will be notified.')) return
    await runAction(() => cancelEvent(getSupabaseClient(), eventId, cancelReason, cancelNotes.trim()), () => 'Event cancelled. Participants were notified.')
  }
  async function exportRows(kind: 'attendance' | 'sales') {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const rows = kind === 'attendance' ? await loadAttendance(getSupabaseClient(), eventId) : await loadSalesSummary(getSupabaseClient(), eventId)
      downloadCsv('event-' + eventId + '-' + kind + '.csv', rows)
      const message = (kind === 'attendance' ? 'Attendance' : 'Sales summary') + ' CSV downloaded.'
      setNotice(message); toast.success(message)
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'The report could not be exported.'; setError(message); toast.error('Report could not be exported.', { description: message }) }
    finally { setBusy(false) }
  }

  if (loading && !data) return <div className="em-shell"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main"><div className="em-content"><BackLink /><div className="em-operation-loading" role="status">Loading event details…</div></div></main></div>
  if (!data) return <div className="em-shell"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main"><div className="em-content"><BackLink /><div className="em-detail-load-error" role="alert"><h1>Event details unavailable</h1><p>{error || 'This event could not be loaded.'}</p><button className="em-button-secondary" onClick={() => void refresh(true)}>Try again</button></div></div></main></div>

  const event = data.event
  const cancelled = event.databaseStatus === 'cancelled'
  const completed = event.databaseStatus === 'completed'
  const draft = event.databaseStatus === 'draft'
  const joinOpen = isPublished(event) && now < eventStart(event) && (!event.applicationDeadline || new Date(event.applicationDeadline).getTime() > now)
  const invitationsClosedReason = cancelled ? 'This event was cancelled.' : completed ? 'This event has ended.' : !isPublished(event) ? 'Publish this event before inviting farmers.' : now >= eventStart(event) ? 'Invitations closed when the event started.' : 'The application deadline has passed.'
  const checkInOpen = isPublished(event) && now >= eventStart(event) && now < eventEnd(event)
  const coverUrl = event.coverPhotoPath ? getSupabaseClient().storage.from('event-manager-media').getPublicUrl(event.coverPhotoPath).data.publicUrl : ''
  const approvedCount = num(data.summary.approved_farmers ?? event.approvedFarmers)
  const invitations = array(data.invitations).filter((row) => str(row.source || 'direct_invitation') === 'direct_invitation')
  const awaitingReply = invitations.filter((row) => str(row.status) === 'pending' && new Date(str(row.expires_at)).getTime() > now).length
  return <div className="em-shell em-detail-page"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main">
    <EventManagerTopbar current={draft ? 'Event draft' : 'Event details'} parent="Events" parentHref="/event-manager/events" />
    <div className="em-content">
      <div className="em-detail-toolbar"><BackLink /><div className="em-operation-buttons">{canEdit(event, now) && <a className="em-button-primary" href={'/event-manager/events/' + eventId + '/edit'} onClick={(click) => navigateWeb(click, '/event-manager/events/' + eventId + '/edit')}>{draft ? 'Edit draft' : 'Edit event'}</a>}</div></div>
      <section className={'em-detail-hero-card' + (coverUrl ? ' has-cover' : '') + (draft ? ' is-draft' : '')} aria-labelledby="em-detail-title">
        <div className="em-detail-hero-main">
          <div className="em-detail-hero-top"><span className="em-detail-hero-id">Event #{event.id}</span><span className={'em-detail-status em-detail-status-' + (cancelled ? 'cancelled' : completed ? 'completed' : draft ? 'draft' : 'active')}>{draft ? 'Draft' : statusLabel(event.status)}</span></div>
          <div className="em-detail-hero-title"><p className="em-detail-hero-type">{event.type}</p><h1 id="em-detail-title">{event.name}</h1></div>
          <div className="em-detail-hero-facts"><div><span>Date & time</span><strong>{formatDate(event.date)}{event.endDate && event.endDate !== event.date ? ' – ' + formatDate(event.endDate) : ''}</strong><small>{formatTime(event.startTime)} – {formatTime(event.endTime)} · Philippine time</small></div><div><span>Venue</span><strong>{event.venueName || 'Venue to be announced'}</strong><small>{[event.venueBarangay, event.venueCity].filter(Boolean).join(', ') || event.location || 'Location to be added'}</small></div><div><span>Farmer slots</span><strong>{event.farmerCount} available</strong><small>{event.joinMode === 'invite_only' ? 'Invitation only' : 'Applications & invitations'}</small></div></div>
        </div>
        <div className={'em-detail-hero-visual' + (coverUrl ? ' has-photo' : '')} aria-hidden="true">{coverUrl ? <img src={coverUrl} alt="" /> : <div className="em-detail-date-mark"><span>{new Date(event.date + 'T12:00:00+08:00').toLocaleDateString('en-PH', { month: 'short', timeZone: 'Asia/Manila' })}</span><strong>{new Date(event.date + 'T12:00:00+08:00').toLocaleDateString('en-PH', { day: '2-digit', timeZone: 'Asia/Manila' })}</strong><small>{new Date(event.date + 'T12:00:00+08:00').toLocaleDateString('en-PH', { year: 'numeric', timeZone: 'Asia/Manila' })}</small></div>}</div>
      </section>
      {draft && <section className="em-detail-draft-notice" aria-label="Draft status"><div><strong>This event is still a draft</strong><p>Farmers and buyers cannot see or join it yet. Edit the details, then review and publish it when you’re ready. Your Event Manager profile must be complete before publishing.</p></div><a className="em-button-primary" href={'/event-manager/events/' + eventId + '/edit'} onClick={(click) => navigateWeb(click, '/event-manager/events/' + eventId + '/edit')}>Edit and publish <span aria-hidden="true">→</span></a></section>}
      {error && <div className="em-operation-error" role="alert">{error}</div>}{notice && <div className="em-operation-notice" role="status">{notice}</div>}
      <div className="em-detail-intro"><div>{event.description && <p>{event.description}</p>}{event.farmerInstructions && <details><summary>Instructions for farmers</summary><p>{event.farmerInstructions}</p></details>}</div></div>
      {!draft && <>
      <nav className="em-detail-section-nav" aria-label="Event sections"><a href="#event-applications">Applications{pending.length > 0 && <span>{pending.length}</span>}</a><a href="#event-invited-farmers">Invited farmers{awaitingReply > 0 && <span>{awaitingReply}</span>}</a><a href="#event-checkin">Check-in</a><a href="#event-reports">Reports</a></nav>
      {(pending.length > 0 || checkInOpen) && <div className="em-detail-priority" role="status"><div><strong>{checkInOpen ? 'Event day check-in is open' : pending.length + ' application' + (pending.length === 1 ? '' : 's') + ' waiting for review'}</strong><span>{checkInOpen ? 'Scan a farmer’s Virtual ID or enter the QR payload to record attendance.' : 'Review farmers before the application window closes.'}</span></div><a href={checkInOpen ? '#event-checkin' : '#event-applications'}>{checkInOpen ? 'Go to check-in' : 'Review applications'} <span aria-hidden="true">→</span></a></div>}
      <section className="em-detail-stats" aria-label="Event participation"><div><span>Applications</span><strong>{num(data.summary.applications ?? applications.length)}</strong></div><div><span>Approved farmers</span><strong>{approvedCount}</strong></div><div><span>Checked in</span><strong>{num(data.summary.checked_in_farmers ?? event.checkedInFarmers)}</strong></div><div><span>Open slots</span><strong>{Math.max(0, event.farmerCount - approvedCount)}</strong></div></section>

      <div className="em-detail-grid">
        <div className="em-detail-column em-detail-column-primary">
        <section className="em-operation-card em-detail-applications" id="event-applications"><div className="em-operation-card-head"><div><span className="em-detail-section-label">PARTICIPATION</span><h2>Farmer applications <span>{pending.length} pending</span></h2></div></div>
          <div className="em-detail-list-heading"><h3>Waiting for review</h3><span>{pending.length}</span></div>
          {pending.length === 0 ? <div className="em-detail-empty"><strong>Nothing to review right now</strong><p>New farmer applications will appear here.</p></div> : pending.map((row) => <article className="em-detail-person" key={num(row.application_id)}><div className="em-person-avatar">{str(row.farmer_name || 'F').charAt(0)}</div><div className="em-detail-person-main"><strong>{str(row.farmer_name || 'Farmer')}</strong><span>{str(row.farm_name || 'Farm details not provided')}{[row.farm_barangay, row.farm_municipality].filter(Boolean).length ? ' · ' + [row.farm_barangay, row.farm_municipality].filter(Boolean).join(', ') : ''}</span>{array(row.intended_listings).map((listing, index) => <small key={str(listing.listing_id || index)}>{str(listing.product_name)} · {str(listing.requested_quantity)} {str(listing.unit)}</small>)}<div className="em-detail-person-actions"><button type="button" disabled={busy || !joinOpen} onClick={() => void review(row, 'approved')}>Approve</button><button type="button" className="is-danger" disabled={busy} onClick={() => { setRejectingId(num(row.application_id)); setRejectionReason('') }}>Reject</button></div>{rejectingId === num(row.application_id) && <div className="em-detail-reject"><label>Reason for rejection<textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Explain the decision to the farmer" /></label><div><button className="em-button-secondary" type="button" onClick={() => setRejectingId(null)}>Keep application</button><button className="em-button-danger" type="button" disabled={busy} onClick={() => void review(row, 'rejected')}>Confirm rejection</button></div></div>}</div></article>)}
          <div className="em-detail-list-heading em-detail-approved-heading"><h3>Approved farmers</h3><span>{approved.length}</span></div>
          {approved.length === 0 ? <div className="em-detail-empty"><strong>No approved farmers yet</strong><p>Approved applicants will appear here for check-in.</p></div> : approved.map((row) => <article className="em-detail-person" key={num(row.application_id)}><div className="em-person-avatar">{str(row.farmer_name || 'F').charAt(0)}</div><div className="em-detail-person-main"><strong>{str(row.farmer_name || 'Farmer')}</strong><span>{str(row.farm_name || 'Approved farmer')}</span></div><span className={'em-detail-person-status ' + (row.status === 'checked_in' ? 'is-checked' : '')}>{statusLabel(str(row.status))}</span>{completed && row.status === 'approved' && <button className="em-button-secondary" type="button" disabled={busy} onClick={() => { if (window.confirm('Mark ' + str(row.farmer_name) + ' as a no-show?')) void runAction(() => markNoShow(getSupabaseClient(), num(row.application_id)), () => 'Farmer marked as a no-show.') }}>Mark no-show</button>}</article>)}
          <div className="em-invite-tracking" id="event-invited-farmers">
            <div className="em-invite-tracking-head"><div><h3>Invited farmers</h3><p>{awaitingReply > 0 ? `${awaitingReply} awaiting a response` : invitations.length > 0 ? 'Invitation responses are up to date' : 'Sent invitations will appear here.'}</p></div><span>{invitations.length}</span></div>
            {invitations.length > 0 && <div className="em-invite-tracking-list">{invitations.map((invitation) => {
              const status = str(invitation.status)
              const expired = status === 'pending' && new Date(str(invitation.expires_at)).getTime() <= now
              const tone = expired ? 'expired' : status
              const label = status === 'pending' && !expired ? 'Awaiting reply' : statusLabel(tone)
              const directoryFarmer = invitedDirectory[str(invitation.farmer_id)]
              const name = str(invitation.farmer_name).trim() || directoryFarmer?.name || 'Farmer name unavailable'
              const farmName = str(invitation.farm_name).trim() || directoryFarmer?.farmName
              return <div className="em-invite-tracking-row" key={str(invitation.invitation_id)}><span className="em-invite-tracking-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span><div><strong>{name}</strong><small>{farmName || `Invited ${new Date(str(invitation.created_at)).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}`}</small></div><span className={'em-invite-status is-' + tone}>{label}</span></div>
            })}</div>}
          </div>
        </section>
        <section className="em-operation-card em-detail-reports" id="event-reports"><div className="em-operation-card-head"><div><span className="em-detail-section-label">RESULTS</span><h2>Performance & reports</h2></div></div><div className="em-detail-report-stats"><div><span>Completed reservations</span><strong>{num(data.performance.completed_reservations)}</strong></div><div><span>Unique buyers</span><strong>{num(data.performance.unique_buyers)}</strong></div><div><span>Sales value</span><strong>₱{num(data.performance.completed_sales_value ?? event.completedSalesValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div></div><div className="em-operation-buttons"><button className="em-button-secondary" type="button" disabled={busy} onClick={() => void exportRows('attendance')}>Download attendance CSV</button><button className="em-button-secondary" type="button" disabled={busy} onClick={() => void exportRows('sales')}>Download sales CSV</button></div></section>
        {!cancelled && !completed && <section className="em-danger-zone"><div className="em-detail-cancel-copy"><h2>Cancel this event</h2><p>Cancellation notifies affected farmers and buyers. Choose the reason before continuing.</p></div><div className={'em-detail-cancel-form' + (cancelReason === 'Other' ? ' has-notes' : '')}><div className="em-select-field"><span>Reason</span><AppSelect label="Reason" value={cancelReason} onChange={setCancelReason} options={['Choose a reason', 'Severe Weather / Calamity', 'Venue Permit Revoked', 'Insufficient Vendor Participation', 'Other'].map((label, index) => ({ value: index ? label : '', label }))} /></div>{cancelReason === 'Other' && <label>Explanation<textarea value={cancelNotes} onChange={(change) => setCancelNotes(change.target.value)} placeholder="Explain the reason" rows={2} /></label>}<button className="em-button-danger" type="button" disabled={busy || !cancelReason} onClick={() => void cancel()}>Cancel event</button></div></section>}
        </div>
        <div className="em-detail-column em-detail-column-secondary">
        <section className="em-operation-card em-detail-invitations" id="event-invitations">
          <div className="em-invite-header">
            <div><h2>Invite farmers</h2><p>{event.eligibilityScope === 'cebu' ? 'Find verified farmers across Cebu.' : 'Find verified farmers in ' + (event.venueCity || 'the event municipality') + '.'}</p></div>
            {joinOpen && <span className="em-invite-selected-count" aria-live="polite">{selectedFarmers.length} selected</span>}
          </div>
          {joinOpen ? <>
            <label className="em-invite-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.75" /><path d="m16 16 4 4" /></svg>
              <span className="em-sr-only">Search eligible farmers</span>
              <input type="search" value={farmerQuery} onChange={(change) => { farmerSearchRequest.current += 1; setFarmerQuery(change.target.value); setFarmerSearchLoading(true); setFarmerSearchError(null); setSearchedFarmers(false); setFarmers([]) }} placeholder="Search by name or farm" />
            </label>
            <div className="em-invite-results-head"><span>Eligible farmers</span><span aria-live="polite">{farmerSearchLoading ? 'Searching…' : `${farmers.length} found`}</span></div>
            {farmerSearchError && <div className="em-invite-empty" role="alert"><strong>Farmer search unavailable</strong><p>{farmerSearchError}</p><button className="em-button-secondary" type="button" onClick={() => void searchFarmers(farmerQuery.trim())}>Try again</button></div>}
            {!farmerSearchError && !farmerSearchLoading && searchedFarmers && farmers.length === 0 && <div className="em-invite-empty"><strong>No eligible farmers found</strong><p>{farmerQuery.trim() ? 'No farmers matched your search within this event’s eligibility area.' : event.eligibilityScope === 'municipality' ? `No active farmers with complete profiles are available in ${event.venueCity || 'this event’s municipality'}.` : 'No active farmers with complete profiles are available across Cebu yet.'}</p>{event.eligibilityScope === 'municipality' && canEdit(event, now) && <a href={'/event-manager/events/' + eventId + '/edit'} onClick={(click) => navigateWeb(click, '/event-manager/events/' + eventId + '/edit')}>Change farmer eligibility in event settings</a>}</div>}
            {farmers.length > 0 && <div className="em-invite-list">{farmers.map((farmer) => {
              const id = num(farmer.id)
              const selected = selectedFarmers.includes(id)
              const name = str(farmer.name || 'Farmer')
              const location = [farmer.barangay, farmer.municipality].filter(Boolean).join(', ')
              return <label className={'em-invite-farmer' + (selected ? ' is-selected' : '')} key={str(farmer.id)}>
                <input type="checkbox" checked={selected} onChange={(change) => setSelectedFarmers((current) => change.target.checked ? [...current, id] : current.filter((value) => value !== id))} />
                <span className="em-invite-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                <span className="em-invite-person"><strong>{name}</strong><small>{str(farmer.farm_name || 'Farm name not provided')}{location && ` · ${location}`}</small><small className="em-invite-meta">Verified · {num(farmer.active_listings)} active listings · {num(farmer.total_transactions)} transactions</small></span>
                <span className="em-invite-check" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10 4 4 8-8" /></svg></span>
              </label>
            })}</div>}
            <button className="em-button-primary em-invite-submit" type="button" disabled={busy || farmerSearchLoading || selectedFarmers.length === 0} onClick={() => void sendInvitations()}>Send invitations <span>{selectedFarmers.length}</span></button>
            {event.joinMode !== 'invite_only' && <div className="em-invite-share"><span>Or share an application link</span><button className="em-button-secondary" type="button" disabled={busy} onClick={() => void makeLink()}>Create application link</button>{inviteLink && <div className="em-created-link"><strong>Application link</strong><code>{inviteLink}</code><button type="button" onClick={() => { void navigator.clipboard.writeText(inviteLink).then(() => { setNotice('Link copied.'); toast.success('Link copied.') }).catch(() => { const message = 'Clipboard access is unavailable. Select and copy the link above.'; setError(message); toast.error('Link could not be copied.', { description: message }) }) }}>Copy link</button></div>}</div>}
          </> : <div className="em-detail-empty"><strong>Invitations are closed</strong><p>{invitationsClosedReason}</p></div>}
        </section>
        <section className="em-operation-card em-detail-attendance" id="event-checkin"><div className="em-operation-card-head"><div><span className="em-detail-section-label">EVENT DAY</span><h2>Farmer check-in</h2></div></div>{checkInOpen ? <><p className="em-operation-copy">Scan a farmer Virtual ID QR code or paste its complete payload.</p><div className="em-detail-camera-actions"><button className="em-button-secondary" type="button" disabled={busy || cameraState === 'starting'} onClick={() => cameraState === 'scanning' ? (stopCamera(), setCameraState('idle')) : void startCamera()}>{cameraState === 'scanning' ? 'Stop camera' : cameraState === 'starting' ? 'Starting camera…' : 'Scan QR with camera'}</button></div><div className="em-detail-camera-preview" hidden={cameraState !== 'starting' && cameraState !== 'scanning'}><video ref={videoRef} className="em-detail-video" playsInline muted aria-label="Camera preview for QR scanning" /><div className="em-detail-scan-frame" aria-hidden="true"><span className="em-detail-scan-corner" /><span className="em-detail-scan-corner" /><span className="em-detail-scan-corner" /><span className="em-detail-scan-corner" /></div></div>{cameraState === 'scanning' && <p className="em-detail-camera-note" role="status">Align the farmer’s Virtual ID QR code inside the frame to scan.</p>}{(cameraState === 'denied' || cameraState === 'unsupported' || cameraState === 'error') && <p className="em-detail-camera-note" role="alert">{cameraMessage} You can use manual entry below.</p>}<div className="em-inline-form"><input aria-label="Farmer Virtual ID QR code data" value={qrPayload} onChange={(change) => setQrPayload(change.target.value)} placeholder="Paste complete Virtual ID QR payload" /><button className="em-button-primary" type="button" disabled={busy || !qrPayload.trim()} onClick={() => void checkIn(qrPayload)}>Check in</button></div>{checkInResult && <div className="em-detail-checkin-result" role="status"><strong>{str(checkInResult.farmer_name || 'Farmer')} checked in</strong><span>Application #{str(checkInResult.application_id)} · Attendance recorded</span></div>}</> : <div className="em-detail-empty"><strong>Check-in is unavailable</strong><p>{draft ? 'Publish the event first.' : cancelled ? 'This event was cancelled.' : completed ? 'This event has ended.' : 'Check-in opens when the event starts.'}</p></div>}</section>
        <section className="em-operation-card em-detail-communication"><div className="em-operation-card-head"><div><span className="em-detail-section-label">COMMUNICATION</span><h2>Reach your audience</h2></div></div><p className="em-operation-copy">Share an update with approved farmers or promote the event to nearby buyers.</p><label className="em-field">Message<textarea value={message} onChange={(change) => setMessage(change.target.value)} placeholder="Add an optional message" rows={3} /></label><div className="em-operation-buttons"><button className="em-button-secondary" type="button" disabled={busy || !isPublished(event)} onClick={() => void sendMessage('broadcast')}>Notify farmers</button><button className="em-button-secondary" type="button" disabled={busy || !isPublished(event)} onClick={() => void sendMessage('promotion')}>Promote to buyers</button></div></section>
        </div>
      </div>
      </>}
    </div>
  </main></div>
}
