import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { getSupabaseClient } from '../admin/supabase'
import { navigateWeb } from '../auth/web-navigation'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import DateTimePicker from './DateTimePicker'
import AppSelect from '../components/AppSelect'
import ImageCropDialog from './ImageCropDialog'
import CoverImagePicker from './CoverImagePicker'
import { createManagedEvent, loadManagedEvent, publishManagedEvent, updateManagedEvent, type ManagerEventInput } from './events-service'
import { invalidateManagedEventsCache } from './managed-events-cache'
import './EventManagerOperations.css'
import './EventManagerEventForm.css'
import { uploadEventManagerMedia } from './upload-media'
import { loadManagerProfileCompletion } from './manager-service'

type Field = keyof ManagerEventInput
type Errors = Partial<Record<Field, string>>
const eventSteps = [
  { label: 'Event details', next: 'schedule', fields: ['name', 'type', 'description'] },
  { label: 'Date & schedule', next: 'venue', fields: ['date', 'endDate', 'startTime', 'endTime'] },
  { label: 'Venue & location', next: 'participation', fields: ['venueName', 'location', 'venueBarangay', 'venueCity', 'mapLatitude', 'mapLongitude'] },
  { label: 'Farmer participation', next: 'cover & review', fields: ['farmerCount', 'applicationDeadline', 'eligibilityScope', 'joinMode', 'farmerInstructions'] },
  { label: 'Cover & review', next: '', fields: [] },
] as const

const manilaDate = (offsetDays = 0) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const date = new Date(parts + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}
const initialForm = (): ManagerEventInput => ({
  name: '', type: 'Regular Market Day', description: '', date: manilaDate(7), endDate: manilaDate(7),
  startTime: '06:00', endTime: '12:00', location: '', venueName: '', venueBarangay: '', venueCity: '',
  municipalityKey: '', farmerCount: 30, applicationDeadline: '', eligibilityScope: 'municipality',
  joinMode: 'applications_and_invites', farmerInstructions: '', mapLatitude: null, mapLongitude: null,
  coverPhotoPath: null, status: 'draft',
})
const manilaInputTime = (value: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
}
const deadlineToIso = (value: string) => value ? new Date(value + ':00+08:00').toISOString() : ''
const prettyDate = (value: string) => {
  if (!value) return 'Date to be set'
  const date = new Date(value + 'T12:00:00+08:00')
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
}
const failureMessage = (cause: unknown): string => {
  if (typeof cause === 'string' && cause.trim()) return cause
  if (cause && typeof cause === 'object') {
    const error = cause as { message?: unknown; details?: unknown; hint?: unknown; error?: unknown }
    const message = typeof error.message === 'string' ? error.message.trim() : typeof error.error === 'string' ? error.error.trim() : ''
    const details = typeof error.details === 'string' ? error.details.trim() : ''
    const hint = typeof error.hint === 'string' ? error.hint.trim() : ''
    if (message) return [message, details !== message ? details : '', hint !== message ? hint : ''].filter(Boolean).join(' ')
  }
  return 'An unexpected error occurred. Please try again.'
}
const validate = (form: ManagerEventInput): Errors => {
  const errors: Errors = {}
  if (form.name.trim().length < 3) errors.name = 'Enter at least 3 characters.'
  if (form.description.trim().length < 10) errors.description = 'Add at least 10 characters so farmers know what to expect.'
  if (!form.date || form.date < manilaDate()) errors.date = 'Choose today or a future date.'
  if (form.type !== 'Regular Market Day' && (!form.endDate || form.endDate < form.date)) errors.endDate = 'Choose an end date on or after the start date.'
  if (!form.startTime) errors.startTime = 'Choose a start time.'
  if (!form.endTime || form.endTime <= form.startTime) errors.endTime = 'End time must be after start time.'
  if (!form.venueName.trim()) errors.venueName = 'Enter the venue name.'
  if (!form.venueBarangay.trim()) errors.venueBarangay = 'Enter the barangay.'
  if (!form.venueCity.trim()) errors.venueCity = 'Enter the Cebu municipality or city.'
  if (!Number.isInteger(form.farmerCount) || form.farmerCount < 1) errors.farmerCount = 'Enter at least one whole-number slot.'
  if (!form.applicationDeadline) errors.applicationDeadline = 'Choose when applications close.'
  else {
    const deadline = new Date(form.applicationDeadline + ':00+08:00').getTime()
    const start = new Date(form.date + 'T' + form.startTime + ':00+08:00').getTime()
    if (!Number.isFinite(deadline) || deadline <= Date.now()) errors.applicationDeadline = 'Choose a future deadline.'
    else if (Number.isFinite(start) && deadline >= start) errors.applicationDeadline = 'Applications must close before the event starts.'
  }
  if (form.farmerInstructions.trim().length < 3) errors.farmerInstructions = 'Add arrival or setup guidance for farmers.'
  if ((form.mapLatitude === null) !== (form.mapLongitude === null)) {
    errors.mapLatitude = 'Add both coordinates or leave both blank.'
    errors.mapLongitude = 'Add both coordinates or leave both blank.'
  } else if (form.mapLatitude !== null && (!Number.isFinite(form.mapLatitude) || !Number.isFinite(form.mapLongitude) || form.mapLatitude < 8 || form.mapLatitude > 12.8 || form.mapLongitude! < 122.8 || form.mapLongitude! > 124.8)) {
    errors.mapLatitude = 'Use coordinates within the Cebu service area.'
    errors.mapLongitude = 'Use coordinates within the Cebu service area.'
  }
  return errors
}

async function uploadCover(id: string, file: File) {
  const client = getSupabaseClient()
  const { data, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!data.user) throw new Error('Sign in again to upload the event cover.')
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  const path = data.user.id + '/events/' + Number(id) + '/cover-' + Date.now() + '.' + extension
  return uploadEventManagerMedia(client, path, file)
}

export default function EventManagerEventForm({ eventId, onSignOut }: { eventId?: string; onSignOut?: () => void | Promise<void> }) {
  const [workingId, setWorkingId] = useState(eventId)
  const [form, setForm] = useState<ManagerEventInput>(initialForm)
  const [existingStatus, setExistingStatus] = useState('draft')
  const [loading, setLoading] = useState(Boolean(eventId))
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverToCrop, setCoverToCrop] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [publishConfirm, setPublishConfirm] = useState(false)
  const [step, setStep] = useState(0)
  const [furthestStep, setFurthestStep] = useState(0)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const coverObjectUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!eventId) return
    let active = true
    void loadManagedEvent(getSupabaseClient(), eventId).then(({ event }) => {
      if (!active) return
      setExistingStatus(event.databaseStatus)
      setForm({
        name: event.name, type: event.type, description: event.description, date: event.date.slice(0, 10),
        endDate: event.endDate.slice(0, 10), startTime: event.startTime.slice(0, 5), endTime: event.endTime.slice(0, 5),
        location: event.location, venueName: event.venueName, venueBarangay: event.venueBarangay,
        venueCity: event.venueCity, municipalityKey: event.municipalityKey, farmerCount: event.farmerCount,
        applicationDeadline: manilaInputTime(event.applicationDeadline), eligibilityScope: event.eligibilityScope,
        joinMode: event.joinMode, farmerInstructions: event.farmerInstructions,
        mapLatitude: event.mapLatitude, mapLongitude: event.mapLongitude, coverPhotoPath: event.coverPhotoPath,
        status: event.databaseStatus === 'draft' ? 'draft' : 'published',
      })
      if (event.coverPhotoPath) setCoverPreview(getSupabaseClient().storage.from('event-manager-media').getPublicUrl(event.coverPhotoPath).data.publicUrl)
      if (!canEdit(event.databaseStatus, event.date, event.startTime)) setBlockedReason('This event can no longer be edited.')
    }).catch((cause) => { if (active) { const message = cause instanceof Error ? cause.message : 'This event could not be loaded for editing.'; setBlockedReason(message); toast.error('Event could not be loaded.', { description: message }) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId])

  useEffect(() => () => { if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current) }, [])

  useEffect(() => {
    let active = true
    void loadManagerProfileCompletion(getSupabaseClient()).then((complete) => {
      if (active) setProfileComplete(complete)
    }).catch(() => { if (active) setProfileComplete(null) })
    return () => { active = false }
  }, [])

  const editable = !blockedReason
  function update<K extends Field>(key: K, value: ManagerEventInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setNotice(null)
  }
  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) { toast.error('Use a JPG or PNG cover image.'); return }
    if (file.size > 8 * 1024 * 1024) { toast.error('Event covers must be 8 MB or smaller.'); return }
    setCoverToCrop(file)
  }
  function useCover(file: File) {
    if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current)
    coverObjectUrl.current = URL.createObjectURL(file)
    setCoverPreview(coverObjectUrl.current)
    setCoverFile(file)
    setCoverToCrop(null)
  }
  function removeSelectedCover() {
    setCoverFile(null)
    if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current)
    coverObjectUrl.current = null
    setCoverPreview(form.coverPhotoPath ? getSupabaseClient().storage.from('event-manager-media').getPublicUrl(form.coverPhotoPath).data.publicUrl : '')
  }
  function checkFields() {
    const next = validate(form)
    setErrors(next)
    const first = Object.keys(next)[0] as Field | undefined
    if (first) {
      toast.error('Review the highlighted fields before saving.')
      const errorStep = eventSteps.findIndex((item) => (item.fields as readonly string[]).includes(first))
      if (errorStep >= 0) setStep(errorStep)
      if (first === 'mapLatitude' || first === 'mapLongitude') {
        requestAnimationFrame(() => { const coordinates = formRef.current?.querySelector<HTMLDetailsElement>('.em-coordinate-group'); if (coordinates) coordinates.open = true })
      }
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[name="' + first + '"]')?.focus())
      return false
    }
    return true
  }
  function showStep(nextStep: number) {
    setStep(nextStep)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: 'start' })
      formRef.current?.querySelector<HTMLElement>('.em-form-section:not([hidden]) h2')?.focus()
    })
  }
  function continueStep() {
    const next = validate(form)
    const first = Object.keys(next).find((key) => (eventSteps[step].fields as readonly string[]).includes(key)) as Field | undefined
    if (first) {
      setErrors(next)
      toast.error('Review this step before continuing.')
      if (first === 'mapLatitude' || first === 'mapLongitude') {
        const coordinates = formRef.current?.querySelector<HTMLDetailsElement>('.em-coordinate-group')
        if (coordinates) coordinates.open = true
      }
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[name="' + first + '"]')?.focus())
      return
    }
    setFurthestStep((current) => Math.max(current, step + 1))
    showStep(step + 1)
  }
  async function save(mode: 'draft' | 'publish' | 'changes') {
    if (mode === 'publish' && profileComplete === false) { setPublishConfirm(false); toast.error('Complete your Event Manager profile before publishing.'); return }
    if (busy || !checkFields()) return
    if (mode === 'publish' && !publishConfirm) { setPublishConfirm(true); return }
    setPublishConfirm(false)
    setBusy(true); setNotice(null)
    const client = getSupabaseClient()
    const status: ManagerEventInput['status'] = mode === 'draft' || existingStatus === 'draft' || !workingId ? 'draft' : 'published'
    let savedId: string | undefined
    try {
      const input = { ...form, endDate: form.type === 'Regular Market Day' ? form.date : form.endDate, applicationDeadline: deadlineToIso(form.applicationDeadline), status }
      let saved = workingId ? await updateManagedEvent(client, workingId, input) : await createManagedEvent(client, input)
      savedId = saved.id
      if (!workingId) {
        setWorkingId(saved.id)
        window.history.replaceState({}, '', '/event-manager/events/' + saved.id + '/edit')
      }
      if (coverFile) {
        const path = await uploadCover(saved.id, coverFile)
        try { saved = await updateManagedEvent(client, saved.id, { ...input, coverPhotoPath: path }) }
        catch (cause) { await client.storage.from('event-manager-media').remove([path]); throw cause }
        setCoverFile(null)
        setForm((current) => ({ ...current, coverPhotoPath: path }))
        setCoverPreview(client.storage.from('event-manager-media').getPublicUrl(path).data.publicUrl)
        if (coverObjectUrl.current) URL.revokeObjectURL(coverObjectUrl.current)
        coverObjectUrl.current = null
      }
      if (mode === 'publish' && saved.databaseStatus === 'draft') saved = await publishManagedEvent(client, saved.id)
      invalidateManagedEventsCache()
      window.dispatchEvent(new CustomEvent('event-manager-events-changed'))
      toast.success(mode === 'draft' ? 'Event draft saved.' : mode === 'changes' ? 'Event changes saved.' : 'Event published.')
      window.history.pushState({}, '', mode === 'draft' ? '/event-manager/events?view=drafts' : '/event-manager/events/' + saved.id)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (cause) {
      const detail = failureMessage(cause)
      const needsProfile = detail.includes('Complete your Event Manager profile')
      toast.error(needsProfile ? 'Complete your Event Manager profile' : savedId ? 'Event only partially saved.' : 'Event could not be saved.', { description: needsProfile ? 'Add your point of contact, official email, office and manager phone numbers, and a complete Cebu office address in Profile, then try again.' : detail })
      if (savedId) {
        invalidateManagedEventsCache()
        window.dispatchEvent(new CustomEvent('event-manager-events-changed'))
        setNotice('You can retry the remaining step from this page.')
      }
    } finally { setBusy(false) }
  }

  const field = (key: Field, label: string, control: React.ReactNode, hint?: string, wide = false) =>
    <label className={'em-field' + (wide ? ' em-field-wide' : '') + (errors[key] ? ' has-error' : '')}>
      <span>{label}</span>{control}{errors[key] ? <small className="em-field-error">{errors[key]}</small> : hint ? <small className="em-field-hint">{hint}</small> : null}
    </label>
  const pickerField = (key: 'date' | 'endDate' | 'startTime' | 'endTime' | 'applicationDeadline', label: string, mode: 'date' | 'time' | 'datetime', minDate?: string, maxDate?: string, hint?: string) =>
    <div className={'em-field' + (errors[key] ? ' has-error' : '')}>
      <span>{label}</span>
      <DateTimePicker name={key} label={label} mode={mode} value={form[key]} minDate={minDate} maxDate={maxDate} invalid={Boolean(errors[key])} onChange={(value) => { update(key, value); if (key === 'date' && form.type === 'Regular Market Day') update('endDate', value) }} />
      {errors[key] ? <small className="em-field-error">{errors[key]}</small> : hint ? <small className="em-field-hint">{hint}</small> : null}
    </div>
  const id = workingId ?? eventId
  const previewDate = /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? new Date(form.date + 'T12:00:00+08:00') : null
  if (loading) return <div className="em-shell"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main"><div className="em-operation-loading" role="status">Loading event details…</div></main></div>
  return <div className="em-shell"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main">
    <EventManagerTopbar current={id ? "Edit event" : "New event"} parent="Events" parentHref="/event-manager/events" />
    <div className="em-content em-create-page">
      <a className="em-back-link" href="/event-manager/events" onClick={(event) => navigateWeb(event, '/event-manager/events')}>← All events</a>
      <div className="em-create-heading"><div><h1>{id ? 'Edit your event' : 'Create a market event'}</h1><p>Add the details farmers need, then save a draft or publish.</p></div><span className="em-create-status">{existingStatus === 'draft' ? 'Draft' : 'Published event'}</span></div>
      {editable && profileComplete === false && existingStatus === 'draft' && <div className="em-profile-publish-notice" role="status"><div><strong>Complete your profile before publishing</strong><p>You can save this event as a draft now. Add your contact details and Cebu office address in Profile before you publish.</p></div><a href="/event-manager/profile" onClick={(event) => navigateWeb(event, '/event-manager/profile')}>Go to Profile <span aria-hidden="true">→</span></a></div>}
      {blockedReason && <div className="em-operation-error" role="alert">{blockedReason}</div>}
      {notice && <div className="em-operation-notice" role="status">{notice}</div>}
      {!editable ? <a className="em-button-secondary" href={'/event-manager/events/' + id} onClick={(event) => navigateWeb(event, '/event-manager/events/' + id)}>View event details</a> :
      <div className="em-create-layout">
        <form ref={formRef} className="em-event-form" noValidate onSubmit={(event: FormEvent) => { event.preventDefault(); if (step < eventSteps.length - 1) continueStep(); else void save(id && existingStatus !== 'draft' ? 'changes' : 'publish') }}>
          <nav className="em-create-steps" aria-label="Event setup steps">{eventSteps.map((item, index) => <button type="button" key={item.label} className={index < furthestStep ? 'is-complete' : undefined} aria-current={step === index ? 'step' : undefined} disabled={busy || index > furthestStep} onClick={() => showStep(index)}><span className="em-create-step-number">{index + 1}</span><span>{item.label}</span></button>)}</nav>
          <div className="em-create-step-count">Step {step + 1} of {eventSteps.length}</div>
          <section className="em-form-section" id="event-basics" hidden={step !== 0}><div className="em-form-section-head"><div><h2 tabIndex={-1}>Event details</h2><p>What farmers and buyers will see.</p></div></div><div className="em-form-grid">
            {field('name', 'Event name', <input name="name" value={form.name} maxLength={100} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Cebu City Weekend Market" />, 'Use a short, recognizable name.', true)}
            {field('type', 'Event type', <AppSelect name="type" label="Event type" value={form.type} onChange={(value) => update('type', value as ManagerEventInput['type'])} options={['Regular Market Day', 'Special Event', 'Pop-Up Market'].map((value) => ({ value, label: value }))} />, 'Regular market days last one day.')}
            {field('description', 'Description', <textarea name="description" value={form.description} maxLength={1200} rows={4} onChange={(event) => update('description', event.target.value)} placeholder="What can visitors expect? Which produce or activities will be featured?" />, 'Describe the event in a way farmers can use to plan.', true)}
          </div></section>
          <section className="em-form-section" id="event-schedule" hidden={step !== 1}><div className="em-form-section-head"><div><h2 tabIndex={-1}>Date & schedule</h2><p>Times are shown in Philippine time.</p></div></div><div className="em-form-grid">
            {pickerField('date', 'Start date', 'date', manilaDate())}
            {form.type !== 'Regular Market Day' && pickerField('endDate', 'End date', 'date', form.date)}
            {pickerField('startTime', 'Starts at', 'time')}
            {pickerField('endTime', 'Ends at', 'time')}
          </div></section>
          <section className="em-form-section" id="event-venue" hidden={step !== 2}><div className="em-form-section-head"><div><h2 tabIndex={-1}>Venue & location</h2><p>Give farmers an address they can find on event day.</p></div></div><div className="em-form-grid">
            {field('venueName', 'Venue name', <input name="venueName" value={form.venueName} onChange={(event) => update('venueName', event.target.value)} placeholder="Market hall, plaza, or host venue" />)}
            {field('location', 'Street or landmark', <input name="location" value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Optional directions" />)}
            {field('venueBarangay', 'Barangay', <input name="venueBarangay" value={form.venueBarangay} onChange={(event) => update('venueBarangay', event.target.value)} placeholder="Barangay" />)}
            {field('venueCity', 'Municipality / city', <input name="venueCity" value={form.venueCity} onChange={(event) => { update('venueCity', event.target.value); update('municipalityKey', event.target.value) }} placeholder="Cebu municipality or city" />)}
            <details className="em-coordinate-group"><summary>Map coordinates <span>Optional · add a precise map point</span></summary><div className="em-form-grid">
              {field('mapLatitude', 'Latitude', <input name="mapLatitude" type="number" step="any" value={form.mapLatitude ?? ''} onChange={(event) => update('mapLatitude', event.target.value === '' ? null : Number(event.target.value))} placeholder="10.3157" />)}
              {field('mapLongitude', 'Longitude', <input name="mapLongitude" type="number" step="any" value={form.mapLongitude ?? ''} onChange={(event) => update('mapLongitude', event.target.value === '' ? null : Number(event.target.value))} placeholder="123.8854" />)}
            </div></details>
          </div></section>
          <section className="em-form-section" id="event-farmers" hidden={step !== 3}><div className="em-form-section-head"><div><h2 tabIndex={-1}>Farmer participation</h2><p>Set available slots and how verified farmers can join.</p></div></div><div className="em-form-grid">
            {field('farmerCount', 'Farmer slots', <input name="farmerCount" type="number" min={1} step={1} value={form.farmerCount} onChange={(event) => update('farmerCount', Number(event.target.value))} />)}
            {pickerField('applicationDeadline', 'Applications close', 'datetime', manilaDate(), form.date, 'Must be before the event starts.')}
            {field('eligibilityScope', 'Eligible farmers', <AppSelect name="eligibilityScope" label="Eligible farmers" value={form.eligibilityScope} onChange={(value) => update('eligibilityScope', value as ManagerEventInput['eligibilityScope'])} options={[{ value: 'municipality', label: 'Event municipality' }, { value: 'cebu', label: 'Verified farmers across Cebu' }]} />)}
            {field('joinMode', 'How farmers join', <AppSelect name="joinMode" label="How farmers join" value={form.joinMode} onChange={(value) => update('joinMode', value as ManagerEventInput['joinMode'])} options={[{ value: 'applications_and_invites', label: 'Applications & invitations' }, { value: 'invite_only', label: 'Invitations only' }]} />)}
            {field('farmerInstructions', 'Instructions for farmers', <textarea name="farmerInstructions" value={form.farmerInstructions} rows={3} onChange={(event) => update('farmerInstructions', event.target.value)} placeholder="Arrival time, setup area, what to bring…" />, 'These appear with the participation details.', true)}
          </div></section>
          <section className="em-form-section" id="event-cover" hidden={step !== 4}>
            <div className="em-form-section-head"><div><h2 tabIndex={-1}>Cover & review</h2><p>Add an optional image, then check the event details.</p></div></div>
            <CoverImagePicker preview={coverPreview} selected={Boolean(coverFile)} existing={Boolean(form.coverPhotoPath)} disabled={busy} onChoose={chooseCover} onRemove={removeSelectedCover} />
            <div className="em-create-review"><h3>Event summary</h3><dl><div><dt>Event</dt><dd>{form.name.trim() || 'Name to be added'}</dd></div><div><dt>When</dt><dd>{prettyDate(form.date)} · {form.startTime}–{form.endTime}</dd></div><div><dt>Where</dt><dd>{[form.venueName, form.venueBarangay, form.venueCity].filter(Boolean).join(', ') || 'Venue to be added'}</dd></div><div><dt>Farmer slots</dt><dd>{form.farmerCount}</dd></div></dl></div>
          </section>
          <div className={'em-form-actions' + (step === 0 ? ' is-first' : step === eventSteps.length - 1 ? ' is-last' : '')}>{step > 0 && <button type="button" className="em-button-secondary em-step-back" disabled={busy} onClick={() => showStep(step - 1)}>Back</button>}<div className="em-step-forward">{step < eventSteps.length - 1 ? <button type="button" className="em-button-primary" disabled={busy} onClick={continueStep}>Continue to {eventSteps[step].next}</button> : <>{(!id || existingStatus === 'draft') && <button type="button" className="em-button-secondary" disabled={busy} onClick={() => void save('draft')}>{busy ? 'Saving…' : 'Save draft'}</button>}<button type="submit" className="em-button-primary" disabled={busy || (existingStatus === 'draft' && profileComplete === false)}>{busy ? 'Saving…' : id && existingStatus !== 'draft' ? 'Save changes' : 'Review & publish'}</button></>}</div></div>
        </form>
        <aside className="em-create-aside"><div className="em-create-aside-card"><h2>Event preview</h2><div className="em-preview-cover">{coverPreview ? <img src={coverPreview} alt="Selected event cover" /> : <span className="em-preview-date" aria-hidden="true"><small>{previewDate ? previewDate.toLocaleDateString('en-PH', { month: 'short', timeZone: 'Asia/Manila' }) : 'DATE'}</small><strong>{previewDate ? previewDate.toLocaleDateString('en-PH', { day: '2-digit', timeZone: 'Asia/Manila' }) : '—'}</strong><small>{previewDate ? previewDate.toLocaleDateString('en-PH', { year: 'numeric', timeZone: 'Asia/Manila' }) : 'TO COME'}</small></span>}</div><div className="em-preview-body"><span className="em-preview-type">{form.type}</span><h3>{form.name.trim() || 'Your event name'}</h3><p>{prettyDate(form.date)}{form.type !== 'Regular Market Day' && form.endDate !== form.date ? ' – ' + prettyDate(form.endDate) : ''} · {form.startTime}–{form.endTime}</p><p>{[form.venueName, form.venueBarangay, form.venueCity].filter(Boolean).join(', ') || 'Venue to be added'}</p><div className="em-preview-slots"><strong>{form.farmerCount || '—'}</strong><span>farmer slots</span></div></div></div></aside>
      </div>}
    </div>
    {publishConfirm && <div className="em-confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPublishConfirm(false) }}><div className="em-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="em-publish-title"><span className="em-create-eyebrow">READY TO GO LIVE?</span><h2 id="em-publish-title">Publish this event?</h2><p>Verified farmers will be able to see the event and join according to your participation settings. You can still edit an upcoming event within the allowed window.</p><div><button className="em-button-secondary" type="button" onClick={() => setPublishConfirm(false)}>Keep editing</button><button className="em-button-primary" type="button" onClick={() => void save('publish')}>Publish event</button></div></div></div>}
    {coverToCrop && <ImageCropDialog file={coverToCrop} kind="cover" onCancel={() => setCoverToCrop(null)} onApply={useCover} />}
  </main></div>
}

function canEdit(status: string, date: string, startTime: string) {
  if (status === 'draft') return true
  if (status !== 'published' && status !== 'upcoming') return false
  return new Date(date + 'T' + startTime + '+08:00').getTime() - Date.now() > 24 * 60 * 60 * 1000
}
