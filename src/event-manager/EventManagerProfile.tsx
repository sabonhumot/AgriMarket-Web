import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import AppSelect from '../components/AppSelect'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import ImageCropDialog from './ImageCropDialog'
import { loadManagerProfile, removeManagerLogo, saveManagerProfile, uploadManagerLogo, type ManagerProfile } from './manager-service'
import './EventManagerOperations.css'
import './EventManagerWorkspace.css'
import './EventManagerProfile.css'

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="em-profile-detail"><dt>{label}</dt><dd className={!value.trim() ? 'is-empty' : undefined}>{value.trim() || 'Not provided'}</dd></div>
}

export default function EventManagerProfile({ onSignOut, initialData }: { onSignOut?: () => void | Promise<void>; initialData?: ManagerProfile }) {
  const [profile, setProfile] = useState<ManagerProfile | null>(initialData ?? null)
  const [draft, setDraft] = useState<ManagerProfile | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false)
  const [editing, setEditing] = useState<keyof ManagerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoToCrop, setPhotoToCrop] = useState<File | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const photoMenu = useRef<HTMLDivElement>(null)
  const photoEditButton = useRef<HTMLButtonElement>(null)
  const nameInput = useRef<HTMLInputElement | HTMLButtonElement>(null)
  const photoObjectUrl = useRef<string | null>(null)

  const refresh = useCallback(async (notify = false) => {
    setLoading(true); setError(null)
    try {
      const value = await loadManagerProfile(getSupabaseClient())
      setProfile(value); setDraft(value); setEditing(null)
      if (notify) toast.success('Profile refreshed.')
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Profile could not be loaded.'; setError(message); toast.error('Profile could not be loaded.', { description: message }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (initialData) return; const timer = setTimeout(() => { void refresh() }, 0); return () => clearTimeout(timer) }, [initialData, refresh])
  useEffect(() => () => { if (photoObjectUrl.current) URL.revokeObjectURL(photoObjectUrl.current) }, [])
  useEffect(() => {
    if (!photoMenuOpen) return
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !photoMenu.current?.contains(event.target) && !photoEditButton.current?.contains(event.target)) setPhotoMenuOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setPhotoMenuOpen(false); photoEditButton.current?.focus() }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [photoMenuOpen])

  function update<K extends keyof ManagerProfile>(key: K, value: ManagerProfile[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current)
    setError(null)
  }
  function beginEditing(field: keyof ManagerProfile) {
    if (editing && draft && profile && JSON.stringify(draft) !== JSON.stringify(profile) && !window.confirm('Discard the unsaved change?')) return
    setDraft(profile)
    setEditing(field); setError(null)
    requestAnimationFrame(() => nameInput.current?.focus())
  }
  function cancelEditing() {
    setDraft(profile); setEditing(null); setError(null)
  }
  async function changePhoto(file: File | undefined) {
    if (!file || photoBusy || busy) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Choose a JPG or PNG photo.'); toast.error('Choose a JPG or PNG photo.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Choose a photo smaller than 5 MB.'); toast.error('Choose a photo smaller than 5 MB.'); return }
    const objectUrl = URL.createObjectURL(file)
    photoObjectUrl.current = objectUrl
    setPhotoPreview(objectUrl); setPhotoBusy(true); setError(null)
    try {
      const path = await uploadManagerLogo(getSupabaseClient(), file)
      setProfile((current) => current ? { ...current, logoPath: path } : current)
      setDraft((current) => current ? { ...current, logoPath: path } : current)
      window.dispatchEvent(new Event('event-manager-profile-changed'))
      toast.success('Profile photo updated.')
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Photo upload failed. Try again.'; setError(message); toast.error('Photo upload failed.', { description: message }) }
    finally {
      setPhotoPreview(''); setPhotoBusy(false)
      URL.revokeObjectURL(objectUrl)
      if (photoObjectUrl.current === objectUrl) photoObjectUrl.current = null
    }
  }
  async function removePhoto() {
    if (!profile?.logoPath || photoBusy || busy) return
    setPhotoMenuOpen(false); setPhotoBusy(true); setError(null)
    try {
      const { profile: updated, storageError } = await removeManagerLogo(getSupabaseClient(), profile)
      setProfile(updated)
      setDraft((current) => current ? { ...current, logoPath: null } : current)
      window.dispatchEvent(new Event('event-manager-profile-changed'))
      if (storageError) toast.warning('Photo removed from the profile, but the saved file could not be deleted.')
      else toast.success('Profile photo removed.')
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Photo could not be removed.'; setError(message); toast.error('Photo could not be removed.', { description: message }) }
    finally { setPhotoBusy(false) }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || busy || photoBusy) return
    if (editing === 'organizationName' && draft.organizationName.trim().length < 3) { setError('Enter an organization name with at least 3 characters.'); toast.error('Enter an organization name with at least 3 characters.'); return }
    if (!draft.firstName.trim() || !draft.lastName.trim()) { setError('Add the Event Manager’s first and last name before saving.'); toast.error('Add the Event Manager’s first and last name.'); return }
    if (editing === 'managerContactNumber' && (!/^[+()0-9 -]+$/.test(draft.managerContactNumber.trim()) || draft.managerContactNumber.replace(/\D/g, '').length < 7 || draft.managerContactNumber.replace(/\D/g, '').length > 15)) { setError('Enter a valid Event Manager contact number before saving.'); toast.error('Enter a valid Event Manager contact number.'); return }
    if (editing === 'street' && ![draft.street, draft.barangay, draft.city, draft.zipCode].every((value) => value.trim())) { setError('Complete the street address, barangay, city, and ZIP code before saving.'); toast.error('Complete all office address fields.'); return }
    setBusy(true); setError(null)
    try {
      const updated = await saveManagerProfile(getSupabaseClient(), draft)
      const fieldsToVerify: (keyof ManagerProfile)[] = editing === 'street' ? ['street', 'barangay', 'city', 'zipCode'] : editing && editing !== 'municipalityKey' ? [editing] : []
      if (fieldsToVerify.some((field) => String(updated[field] ?? '').trim() !== String(draft[field] ?? '').trim())) {
        setError('That change was not saved. Check the value and try again.')
        toast.error('That change was not saved. Check the value and try again.')
        return
      }
      setProfile(updated); setDraft(updated); setEditing(null); window.dispatchEvent(new Event('event-manager-profile-changed')); toast.success('Profile changes saved.')
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Profile changes could not be saved.'; setError(message); toast.error('Profile changes could not be saved.', { description: message }) }
    finally { setBusy(false) }
  }

  const changed = Boolean(profile && draft && JSON.stringify(profile) !== JSON.stringify(draft))
  const photoUrl = photoPreview || (profile?.logoPath ? getSupabaseClient().storage.from('event-manager-media').getPublicUrl(profile.logoPath).data.publicUrl : '')
  const kind = profile?.organizationType === 'lgu' ? 'Local government unit' : 'Organization'

  return <div className="em-shell em-market-profile"><EventManagerSidebar active="profile" profile={profile} onSignOut={onSignOut} /><main className="em-main"><EventManagerTopbar current="Profile" /><div className="em-content em-workspace-page">
    <div className="em-workspace-heading"><div><h1>Organization profile</h1><p>Keep your organization and contact details current for event coordination.</p></div><button className="em-button-secondary" type="button" disabled={loading || busy || photoBusy} onClick={() => { if (!changed || window.confirm('Discard unsaved changes and reload the profile?')) void refresh(true) }}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <div className="em-operation-error" role="alert">{error}</div>}
    {loading && !draft ? <div className="em-workspace-loading" role="status">Loading profile…</div> : !draft || !profile ? <div className="em-workspace-empty"><strong>Profile unavailable</strong><p>Try refreshing to load your organization details.</p></div> : <>
      <section className="em-profile-identity" aria-label="Organization identity">
        <input ref={photoInput} className="em-profile-photo-input" type="file" accept="image/jpeg,image/png" aria-hidden="true" tabIndex={-1} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return; if (!['image/jpeg', 'image/png'].includes(file.type)) { toast.error('Choose a JPG or PNG photo.'); return } if (file.size > 5 * 1024 * 1024) { toast.error('Choose a photo smaller than 5 MB.'); return } setPhotoToCrop(file) }} />
        <div className="em-profile-photo-area"><div className="em-profile-photo-frame">
          <div className="em-profile-photo-button">{photoUrl ? <img src={photoUrl} alt="" /> : <span className="em-profile-photo-initial" aria-hidden="true">{profile.organizationName.charAt(0) || 'A'}</span>}</div>
          <button ref={photoEditButton} className="em-profile-photo-edit" type="button" aria-label="Edit profile photo" aria-expanded={photoMenuOpen} aria-controls="em-profile-photo-menu" title="Edit profile photo" disabled={photoBusy || busy} onClick={() => setPhotoMenuOpen((open) => !open)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5" /></svg></button>
          {photoMenuOpen && <div ref={photoMenu} id="em-profile-photo-menu" className="em-profile-photo-menu"><button type="button" onClick={() => { setPhotoMenuOpen(false); photoInput.current?.click() }}>{profile.logoPath ? 'Change photo' : 'Add photo'}</button>{profile.logoPath && <button type="button" className="em-profile-photo-remove" onClick={() => void removePhoto()}>Remove photo</button>}</div>}
        </div><span className="em-profile-photo-hint" role={photoBusy ? 'status' : undefined}>{photoBusy ? 'Updating photo…' : 'Profile photo'}</span><span className="em-profile-photo-format">JPG or PNG · up to 5 MB</span></div>
        <div className="em-profile-identity-content"><div className="em-profile-identity-head"><div><h2>{profile.organizationName || 'Your organization'}</h2><p>{kind}{profile.city ? ' · ' + profile.city : ''}</p></div></div></div>
      </section>
      <div className="em-profile-sections">{([
        [{ id: 'organization', title: 'Organization', fields: [['organizationName', 'Organization name'], ['organizationType', 'Organization type'], ['municipalityKey', 'Service municipality']] }],
        [{ id: 'contact', title: 'Contact information', fields: [['contactName', 'Point of contact'], ['officialEmail', 'Official email'], ['officePhone', 'Office contact number']] }, { id: 'address', title: 'Office address', fields: [['street', 'Street address'], ['barangay', 'Barangay'], ['city', 'City / municipality'], ['zipCode', 'ZIP code']] }],
        [{ id: 'manager', title: 'Event Manager', fields: [['firstName', 'First name'], ['middleName', 'Middle name'], ['lastName', 'Last name'], ['managerContactNumber', 'Manager contact number']] }],
      ] as const).map((group, groupIndex) => <div className={'em-profile-column' + (groupIndex === 0 ? ' em-profile-column-organization' : '')} key={groupIndex}>{group.map((section) => <section className={'em-profile-section-panel em-profile-panel-' + section.id} key={section.id}>
        <div className="em-profile-panel-heading"><h3>{section.title}</h3></div>
        {section.id === 'address' && editing === 'street' ? <form className="em-profile-address-form" onSubmit={(event) => void save(event)}>
          <p>Enter the complete office address before saving.</p>
          <div className="em-profile-address-fields">{section.fields.map(([key, label]) => <label className="em-profile-field-form" htmlFor={'profile-' + key} key={key}>{label}<input id={'profile-' + key} ref={key === 'street' ? (node) => { nameInput.current = node } : undefined} type="text" required disabled={busy} value={draft[key]} onChange={(event) => update(key, event.target.value)} /></label>)}</div>
          <div className="em-profile-field-actions"><button className="em-button-secondary" type="button" disabled={busy} onClick={cancelEditing}>Cancel</button><button className="em-button-primary" type="submit" disabled={!changed || busy || photoBusy}>{busy ? 'Saving…' : 'Save address'}</button></div>
        </form> : <dl>{section.fields.map(([key, label]) => <div className="em-profile-detail" key={key}>
          <dt className="em-profile-field-label"><span>{label}</span>{editing !== key && <button type="button" className="em-profile-field-edit" disabled={busy || photoBusy} onClick={() => beginEditing(section.id === 'address' ? 'street' : key)} aria-label={'Edit ' + (section.id === 'address' ? 'office address' : label.toLowerCase())}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5" /></svg>Edit</button>}</dt>
          <dd>{editing === key ? <form className="em-profile-field-form" onSubmit={(event) => void save(event)}><label className="em-sr-only" htmlFor={'profile-' + key}>{label}</label>{key === 'organizationType' ? <AppSelect id={'profile-' + key} ref={(node) => { nameInput.current = node }} label={label} disabled={busy} value={draft[key]} onChange={(value) => update(key, value as ManagerProfile['organizationType'])} options={[{ value: 'organization', label: 'Organization' }, { value: 'lgu', label: 'Local government unit' }]} /> : <input id={'profile-' + key} ref={(node) => { nameInput.current = node }} type={key === 'officialEmail' ? 'email' : key === 'officePhone' || key === 'managerContactNumber' ? 'tel' : 'text'} required={['organizationName', 'firstName', 'lastName', 'managerContactNumber'].includes(key)} minLength={key === 'organizationName' ? 3 : undefined} disabled={busy} value={draft[key]} onChange={(event) => update(key, event.target.value)} />}<div className="em-profile-field-actions"><button className="em-button-secondary" type="button" disabled={busy} onClick={cancelEditing}>Cancel</button><button className="em-button-primary" type="submit" disabled={!changed || busy || photoBusy}>{busy ? 'Saving…' : 'Save'}</button></div></form> : (key === 'organizationType' ? kind : profile[key]) || <span className="is-empty">Not provided</span>}</dd>
        </div>)}</dl>}
      </section>)}{groupIndex === 2 && <section className="em-profile-account"><div><h3>Account</h3><p>Sign-in information for this workspace.</p></div><dl><Detail label="Signed in as" value={profile.accountName} /><Detail label="Login email" value={profile.accountEmail} /></dl></section>}</div>)}</div>
    </>}
    {photoToCrop && <ImageCropDialog file={photoToCrop} kind="avatar" onCancel={() => setPhotoToCrop(null)} onApply={(file) => { setPhotoToCrop(null); void changePhoto(file) }} />}
  </div></main></div>
}
