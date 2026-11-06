import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient } from '../admin/supabase'
import { navigateWeb } from '../auth/web-navigation'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import {
  cancelEvent, checkInFarmer, createInviteLink, inviteFarmers, loadAttendance, loadEligibleFarmers,
  loadManagedEvent, loadSalesSummary, markNoShow, promoteEvent, recordsToCsv, reviewApplication, sendBroadcast,
  type ManagerEvent,
} from './events-service'
import { invalidateManagedEventsCache } from './EventManagerEvents'
import { loadManagerFarmers, type ManagerFarmer } from './manager-service'
import './EventManagerOperations.css'
import './EventManagerEventDetail.css'

type DetailData = Awaited<ReturnType<typeof loadManagedEvent>>
type Row = Record<string, unknown>
type CameraState = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error'
type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type DetectorClass = new (options: { formats: string[] }) => Detector
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
  const [selectedFarmers, setSelectedFarmers] = useState<number[]>([])
  const [invitedDirectory, setInvitedDirectory] = useState<Record<string, Pick<ManagerFarmer, 'name' | 'farmName'>>>({})
  const [inviteLink, setInviteLink] = useState('')
  const [qrPayload, setQrPayload] = useState('')
  const [checkInResult, setCheckInResult] = useState<Row | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>('idle')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelNotes, setCancelNotes] = useState('')
  const [now, setNow] = useState(Date.now)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const detectingRef = useRef(false)
  const farmerSearchRequest = useRef(0)
  const invitedDirectoryRef = useRef<Record<string, Pick<ManagerFarmer, 'name' | 'farmName'>>>({})

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await loadManagedEvent(getSupabaseClient(), eventId)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Event details could not be loaded.') }
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
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    detectingRef.current = false
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
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.'); setBusy(false); return null }
    invalidateManagedEventsCache()
    window.dispatchEvent(new CustomEvent('event-manager-events-changed'))
    setNotice(success(result))
    try { setData(await loadManagedEvent(getSupabaseClient(), eventId)) }
    catch { setError('The action succeeded, but the latest event details could not be loaded. Use Refresh to try again.') }
    setBusy(false)
    return result
  }
  async function review(row: Row, decision: 'approved' | 'rejected') {
    const id = num(row.application_id)
    if (decision === 'rejected') {
      if (rejectionReason.trim().length < 3) { setError('Add a short reason before rejecting this application.'); return }
      if (!window.confirm('Reject ' + str(row.farmer_name) + "'s application?")) return
    }
    const result = await runAction(() => reviewApplication(getSupabaseClient(), id, decision, decision === 'approved' ? undefined : rejectionReason.trim()), () => decision === 'approved' ? 'Application approved.' : 'Application rejected.')
    if (result !== null) { setRejectingId(null); setRejectionReason('') }
  }
  const searchFarmers = useCallback(async (query: string) => {
    const currentRequest = ++farmerSearchRequest.current
    setFarmerSearchLoading(true)
    try {
      const results = await loadEligibleFarmers(getSupabaseClient(), eventId, query)
      if (currentRequest === farmerSearchRequest.current) { setFarmers(results); setSearchedFarmers(true) }
    } catch (cause) {
      if (currentRequest === farmerSearchRequest.current) setError(cause instanceof Error ? cause.message : 'Eligible farmers could not be loaded.')
    } finally {
      if (currentRequest === farmerSearchRequest.current) setFarmerSearchLoading(false)
    }
  }, [eventId])
  useEffect(() => {
    if (!data || !isPublished(data.event) || Date.now() >= eventStart(data.event)) return
    farmerSearchRequest.current += 1
    setFarmerSearchLoading(true)
    setSearchedFarmers(false)
    setFarmers([])
    setSelectedFarmers([])
    const timer = setTimeout(() => { void searchFarmers(farmerQuery.trim()) }, farmerQuery.trim() ? 250 : 0)
    return () => { clearTimeout(timer); farmerSearchRequest.current += 1 }
  }, [data, farmerQuery, searchFarmers])
  async function sendInvitations() {
    if (!selectedFarmers.length) { setError('Select at least one eligible farmer.'); return }
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
    if (!payload.trim()) { setError('Paste the complete farmer Virtual ID QR payload.'); return }
    if (streamRef.current) { stopCamera(); setCameraState('idle') }
    const result = await runAction(() => checkInFarmer(getSupabaseClient(), eventId, payload.trim()), (value) => str(value.farmer_name || 'Farmer') + ' checked in successfully.')
    if (result) { setCheckInResult(result); setQrPayload('') }
  }
  async function startCamera() {
    if (cameraState === 'starting' || cameraState === 'scanning') return
    const DetectorType = (window as Window & { BarcodeDetector?: DetectorClass }).BarcodeDetector
    if (!DetectorType || !navigator.mediaDevices?.getUserMedia) { setCameraState('unsupported'); return }
    setCameraState('starting'); setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      if (!videoRef.current) { stopCamera(); setCameraState('error'); return }
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      const detector = new DetectorType({ formats: ['qr_code'] })
      setCameraState('scanning')
      const scan = async () => {
        if (!streamRef.current || !videoRef.current) return
        if (!detectingRef.current && videoRef.current.readyState >= 2) {
          detectingRef.current = true
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes[0]?.rawValue) { stopCamera(); setCameraState('idle'); await checkIn(codes[0].rawValue); return }
          } catch { stopCamera(); setCameraState('error'); return }
          finally { detectingRef.current = false }
        }
        if (streamRef.current) frameRef.current = requestAnimationFrame(() => { void scan() })
      }
      frameRef.current = requestAnimationFrame(() => { void scan() })
    } catch (cause) {
      stopCamera()
      setCameraState(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'denied' : 'error')
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
    if (!cancelReason) { setError('Choose a cancellation reason.'); return }
    if (cancelReason === 'Other' && cancelNotes.trim().length < 3) { setError('Add a short explanation for Other.'); return }
    if (!window.confirm('Cancel this event? Farmers and buyers will be notified.')) return
    await runAction(() => cancelEvent(getSupabaseClient(), eventId, cancelReason, cancelNotes.trim()), () => 'Event cancelled. Participants were notified.')
  }
  async function exportRows(kind: 'attendance' | 'sales') {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const rows = kind === 'attendance' ? await loadAttendance(getSupabaseClient(), eventId) : await loadSalesSummary(getSupabaseClient(), eventId)
      downloadCsv('event-' + eventId + '-' + kind + '.csv', rows)
      setNotice((kind === 'attendance' ? 'Attendance' : 'Sales summary') + ' CSV downloaded.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The report could not be exported.') }
    finally { setBusy(false) }
  }

  if (loading && !data) return <div className="em-shell"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main"><div className="em-content"><BackLink /><div className="em-operation-loading" role="status">Loading event details…</div></div></main></div>
  if (!data) return <div className="em-shell"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main"><div className="em-content"><BackLink /><div className="em-detail-load-error" role="alert"><h1>Event details unavailable</h1><p>{error || 'This event could not be loaded.'}</p><button className="em-button-secondary" onClick={() => void refresh()}>Try again</button></div></div></main></div>

  const event = data.event
  const cancelled = event.databaseStatus === 'cancelled'
  const completed = event.databaseStatus === 'completed'
  const draft = event.databaseStatus === 'draft'
  const joinOpen = isPublished(event) && now < eventStart(event) && (!event.applicationDeadline || new Date(event.applicationDeadline).getTime() > now)
  const checkInOpen = isPublished(event) && now >= eventStart(event) && now < eventEnd(event)
  const coverUrl = event.coverPhotoPath ? getSupabaseClient().storage.from('event-manager-media').getPublicUrl(event.coverPhotoPath).data.publicUrl : ''
  const approvedCount = num(data.summary.approved_farmers ?? event.approvedFarmers)
  const invitations = array(data.invitations).filter((row) => str(row.source || 'direct_invitation') === 'direct_invitation')
  const awaitingReply = invitations.filter((row) => str(row.status) === 'pending' && new Date(str(row.expires_at)).getTime() > now).length
  return <div className="em-shell em-detail-page"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main">
    <EventManagerTopbar current="Event details" parent="Events" parentHref="/event-manager/events" />
    <div className="em-content">
      <div className="em-detail-toolbar"><BackLink /><div className="em-operation-buttons"><button className="em-button-secondary" type="button" disabled={busy || loading} onClick={() => void refresh()}>{loading ? 'Refreshing…' : 'Refresh'}</button>{canEdit(event, now) && <a className="em-button-primary" href={'/event-manager/events/' + eventId + '/edit'} onClick={(click) => navigateWeb(click, '/event-manager/events/' + eventId + '/edit')}>Edit event</a>}</div></div>
      <section className={'em-detail-hero-card' + (coverUrl ? ' has-cover' : '')} style={coverUrl ? { backgroundImage: 'linear-gradient(90deg,rgba(15,54,30,.93),rgba(15,54,30,.58)),url("' + coverUrl + '")' } : undefined} aria-labelledby="em-detail-title">
        <div className="em-detail-hero-top"><span className="em-detail-hero-id">Event #{event.id}</span><span className={'em-detail-status em-detail-status-' + (cancelled ? 'cancelled' : completed ? 'completed' : draft ? 'draft' : 'active')}>{statusLabel(event.status)}</span></div>
        <h1 id="em-detail-title">{event.name}</h1><p className="em-detail-hero-type">{event.type}</p>
        <div className="em-detail-hero-facts"><div><span>DATE & TIME</span><strong>{formatDate(event.date)}{event.endDate && event.endDate !== event.date ? ' – ' + formatDate(event.endDate) : ''}</strong><small>{formatTime(event.startTime)} – {formatTime(event.endTime)} · Philippine time</small></div><div><span>VENUE</span><strong>{event.venueName || 'Venue to be announced'}</strong><small>{[event.venueBarangay, event.venueCity].filter(Boolean).join(', ') || event.location || 'Location to be added'}</small></div><div><span>FARMER SLOTS</span><strong>{event.farmerCount} available</strong><small>{event.joinMode === 'invite_only' ? 'Invitation only' : 'Applications & invitations'}</small></div></div>
      </section>
      {error && <div className="em-operation-error" role="alert">{error}</div>}{notice && <div className="em-operation-notice" role="status">{notice}</div>}
      <div className="em-detail-intro"><div>{event.description && <p>{event.description}</p>}{event.farmerInstructions && <details><summary>Instructions for farmers</summary><p>{event.farmerInstructions}</p></details>}</div></div>
      <nav className="em-detail-section-nav" aria-label="Event sections"><a href="#event-applications">Applications{pending.length > 0 && <span>{pending.length}</span>}</a><a href="#event-invited-farmers">Invited farmers{awaitingReply > 0 && <span>{awaitingReply}</span>}</a><a href="#event-checkin">Check-in</a><a href="#event-reports">Reports</a></nav>
      {(pending.length > 0 || checkInOpen) && <div className="em-detail-priority" role="status"><div><strong>{checkInOpen ? 'Event day check-in is open' : pending.length + ' application' + (pending.length === 1 ? '' : 's') + ' waiting for review'}</strong><span>{checkInOpen ? 'Scan a farmer’s Virtual ID or enter the QR payload to record attendance.' : 'Review farmers before the application window closes.'}</span></div><a href={checkInOpen ? '#event-checkin' : '#event-applications'}>{checkInOpen ? 'Go to check-in' : 'Review applications'} <span aria-hidden="true">→</span></a></div>}
      <section className="em-detail-stats" aria-label="Event participation"><div><span>Applications</span><strong>{num(data.summary.applications ?? applications.length)}</strong></div><div><span>Approved farmers</span><strong>{approvedCount}</strong></div><div><span>Checked in</span><strong>{num(data.summary.checked_in_farmers ?? event.checkedInFarmers)}</strong></div><div><span>Open slots</span><strong>{Math.max(0, event.farmerCount - approvedCount)}</strong></div></section>

      <div className="em-detail-grid">
        <section className="em-operation-card em-detail-applications" id="event-applications"><div className="em-operation-card-head"><div><span className="em-detail-section-label">PARTICIPATION</span><h2>Farmer applications <span>{pending.length} pending</span></h2></div></div>
          <div className="em-detail-list-heading"><h3>Waiting for review</h3><span>{pending.length}</span></div>
          {pending.length === 0 ? <div className="em-detail-empty"><strong>Nothing to review right now</strong><p>New farmer applications will appear here.</p></div> : pending.map((row) => <article className="em-detail-person" key={num(row.application_id)}><div className="em-person-avatar">{str(row.farmer_name || 'F').charAt(0)}</div><div className="em-detail-person-main"><strong>{str(row.farmer_name || 'Farmer')}</strong><span>{str(row.farm_name || 'Farm details not provided')}{[row.farm_barangay, row.farm_municipality].filter(Boolean).length ? ' · ' + [row.farm_barangay, row.farm_municipality].filter(Boolean).join(', ') : ''}</span>{array(row.intended_listings).map((listing, index) => <small key={str(listing.listing_id || index)}>{str(listing.product_name)} · {str(listing.requested_quantity)} {str(listing.unit)}</small>)}<div className="em-detail-person-actions"><button type="button" disabled={busy || !joinOpen} onClick={() => void review(row, 'approved')}>Approve</button><button type="button" className="is-danger" disabled={busy} onClick={() => { setRejectingId(num(row.application_id)); setRejectionReason('') }}>Reject</button></div>{rejectingId === num(row.application_id) && <div className="em-detail-reject"><label>Reason for rejection<textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Explain the decision to the farmer" /></label><div><button className="em-button-secondary" type="button" onClick={() => setRejectingId(null)}>Keep application</button><button className="em-button-danger" type="button" disabled={busy} onClick={() => void review(row, 'rejected')}>Confirm rejection</button></div></div>}</div></article>)}
          <div className="em-detail-list-heading em-detail-approved-heading"><h3>Approved farmers</h3><span>{approved.length}</span></div>
          {approved.length === 0 ? <div className="em-detail-empty"><strong>No approved farmers yet</strong><p>Approved applicants will appear here for check-in.</p></div> : approved.map((row) => <article className="em-detail-person" key={num(row.application_id)}><div className="em-person-avatar">{str(row.farmer_name || 'F').charAt(0)}</div><div className="em-detail-person-main"><strong>{str(row.farmer_name || 'Farmer')}</strong><span>{str(row.farm_name || 'Approved farmer')}</span></div><span className={'em-detail-person-status ' + (row.status === 'checked_in' ? 'is-checked' : '')}>{statusLabel(str(row.status))}</span>{completed && row.status === 'approved' && <button className="em-button-secondary" type="button" disabled={busy} onClick={() => { if (window.confirm('Mark ' + str(row.farmer_name) + ' as a no-show?')) void runAction(() => markNoShow(getSupabaseClient(), num(row.application_id)), () => 'Farmer marked as a no-show.') }}>Mark no-show</button>}</article>)}
          <div className="em-invite-tracking" id="event-invited-farmers">
            <div className="em-invite-tracking-head"><div><h3>Invited farmers</h3><p>{awaitingReply > 0 ? `${awaitingReply} awaiting a response` : invitations.length > 0 ? 'Invitation responses are up to date' : 'Sent invitations will appear here.'}</p></div><button className="em-invite-refresh" type="button" disabled={loading || busy} onClick={() => void refresh()}>{loading ? 'Refreshing…' : 'Refresh status'}</button><span>{invitations.length}</span></div>
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
        <section className="em-operation-card em-detail-invitations" id="event-invitations">
          <div className="em-invite-header">
            <div><h2>Invite farmers</h2><p>{event.eligibilityScope === 'cebu' ? 'Find verified farmers across Cebu.' : 'Find verified farmers in ' + (event.venueCity || 'the event municipality') + '.'}</p></div>
            {joinOpen && <span className="em-invite-selected-count" aria-live="polite">{selectedFarmers.length} selected</span>}
          </div>
          {joinOpen ? <>
            <label className="em-invite-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.75" /><path d="m16 16 4 4" /></svg>
              <span className="em-sr-only">Search eligible farmers</span>
              <input type="search" value={farmerQuery} onChange={(change) => { farmerSearchRequest.current += 1; setFarmerQuery(change.target.value) }} placeholder="Search by name or farm" />
            </label>
            <div className="em-invite-results-head"><span>Eligible farmers</span><span aria-live="polite">{farmerSearchLoading ? 'Searching…' : `${farmers.length} found`}</span></div>
            {searchedFarmers && farmers.length === 0 && <div className="em-invite-empty">{farmerQuery.trim() ? 'No eligible farmers matched your search.' : 'No eligible farmers are available for this event.'}</div>}
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
            {event.joinMode !== 'invite_only' && <div className="em-invite-share"><span>Or share an application link</span><button className="em-button-secondary" type="button" disabled={busy} onClick={() => void makeLink()}>Create application link</button>{inviteLink && <div className="em-created-link"><strong>Application link</strong><code>{inviteLink}</code><button type="button" onClick={() => { void navigator.clipboard.writeText(inviteLink).then(() => setNotice('Link copied.')).catch(() => setError('Clipboard access is unavailable. Select and copy the link above.')) }}>Copy link</button></div>}</div>}
          </> : <div className="em-detail-empty"><strong>Invitations are closed</strong><p>{draft ? 'Publish this draft to invite farmers.' : 'The application window has ended for this event.'}</p></div>}
        </section>
        <section className="em-operation-card em-detail-attendance" id="event-checkin"><div className="em-operation-card-head"><div><span className="em-detail-section-label">EVENT DAY</span><h2>Farmer check-in</h2></div></div>{checkInOpen ? <><p className="em-operation-copy">Scan a farmer Virtual ID QR code or paste its complete payload.</p><div className="em-detail-camera-actions"><button className="em-button-secondary" type="button" disabled={busy || cameraState === 'starting'} onClick={() => cameraState === 'scanning' ? (stopCamera(), setCameraState('idle')) : void startCamera()}>{cameraState === 'scanning' ? 'Stop camera' : cameraState === 'starting' ? 'Starting camera…' : 'Scan QR with camera'}</button></div><video ref={videoRef} className="em-detail-video" hidden={cameraState !== 'starting' && cameraState !== 'scanning'} playsInline muted aria-label="Camera preview for QR scanning" />{cameraState === 'scanning' && <p className="em-detail-camera-note" role="status">Point the camera at the farmer’s Virtual ID QR code.</p>}{cameraState === 'denied' && <p className="em-detail-camera-note" role="alert">Camera access was denied. Allow access in your browser or use manual entry below.</p>}{cameraState === 'unsupported' && <p className="em-detail-camera-note" role="status">Camera QR scanning is unavailable in this browser. Use manual entry below.</p>}{cameraState === 'error' && <p className="em-detail-camera-note" role="alert">The camera could not scan a QR code. Try again or use manual entry.</p>}<div className="em-inline-form"><input aria-label="Farmer Virtual ID QR code data" value={qrPayload} onChange={(change) => setQrPayload(change.target.value)} placeholder="Paste complete Virtual ID QR payload" /><button className="em-button-primary" type="button" disabled={busy || !qrPayload.trim()} onClick={() => void checkIn(qrPayload)}>Check in</button></div>{checkInResult && <div className="em-detail-checkin-result" role="status"><strong>{str(checkInResult.farmer_name || 'Farmer')} checked in</strong><span>Application #{str(checkInResult.application_id)} · Attendance recorded</span></div>}</> : <div className="em-detail-empty"><strong>Check-in is unavailable</strong><p>{draft ? 'Publish the event first.' : cancelled ? 'This event was cancelled.' : completed ? 'This event has ended.' : 'Check-in opens when the event starts.'}</p></div>}</section>
        <section className="em-operation-card em-detail-communication"><div className="em-operation-card-head"><div><span className="em-detail-section-label">COMMUNICATION</span><h2>Reach your audience</h2></div></div><p className="em-operation-copy">Share an update with approved farmers or promote the event to nearby buyers.</p><label className="em-field">Message<textarea value={message} onChange={(change) => setMessage(change.target.value)} placeholder="Add an optional message" rows={3} /></label><div className="em-operation-buttons"><button className="em-button-secondary" type="button" disabled={busy || !isPublished(event)} onClick={() => void sendMessage('broadcast')}>Notify farmers</button><button className="em-button-secondary" type="button" disabled={busy || !isPublished(event)} onClick={() => void sendMessage('promotion')}>Promote to buyers</button></div></section>
        <section className="em-operation-card em-detail-reports" id="event-reports"><div className="em-operation-card-head"><div><span className="em-detail-section-label">RESULTS</span><h2>Performance & reports</h2></div></div><div className="em-detail-report-stats"><div><span>Completed reservations</span><strong>{num(data.performance.completed_reservations)}</strong></div><div><span>Unique buyers</span><strong>{num(data.performance.unique_buyers)}</strong></div><div><span>Sales value</span><strong>₱{num(data.performance.completed_sales_value ?? event.completedSalesValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></div></div><div className="em-operation-buttons"><button className="em-button-secondary" type="button" disabled={busy} onClick={() => void exportRows('attendance')}>Download attendance CSV</button><button className="em-button-secondary" type="button" disabled={busy} onClick={() => void exportRows('sales')}>Download sales CSV</button></div></section>
        {!cancelled && !completed && <section className="em-danger-zone"><div><span className="em-detail-section-label">EVENT CONTROL</span><h2>Cancel this event</h2><p>Cancellation notifies affected farmers and buyers. Choose the reason before continuing.</p></div><div className="em-detail-cancel-form"><label>Reason<select value={cancelReason} onChange={(change) => setCancelReason(change.target.value)}><option value="">Choose a reason</option><option>Severe Weather / Calamity</option><option>Venue Permit Revoked</option><option>Insufficient Vendor Participation</option><option>Other</option></select></label>{cancelReason === 'Other' && <label>Explanation<textarea value={cancelNotes} onChange={(change) => setCancelNotes(change.target.value)} placeholder="Explain the reason" rows={2} /></label>}<button className="em-button-danger" type="button" disabled={busy || !cancelReason} onClick={() => void cancel()}>Cancel event</button></div></section>}
      </div>
    </div>
  </main></div>
}
