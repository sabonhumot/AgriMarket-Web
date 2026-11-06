import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import { loadManagerProfile, saveManagerProfile, uploadManagerLogo, type ManagerProfile } from './manager-service'
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
  const [editing, setEditing] = useState<keyof ManagerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const nameInput = useRef<HTMLInputElement | HTMLSelectElement>(null)
  const photoObjectUrl = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const value = await loadManagerProfile(getSupabaseClient())
      setProfile(value); setDraft(value); setEditing(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Profile could not be loaded.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (initialData) return; const timer = setTimeout(() => { void refresh() }, 0); return () => clearTimeout(timer) }, [initialData, refresh])
  useEffect(() => () => { if (photoObjectUrl.current) URL.revokeObjectURL(photoObjectUrl.current) }, [])

  function update<K extends keyof ManagerProfile>(key: K, value: ManagerProfile[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current)
    setError(null); setNotice(null)
  }
  function beginEditing(field: keyof ManagerProfile) {
    if (editing && draft && profile && JSON.stringify(draft) !== JSON.stringify(profile) && !window.confirm('Discard the unsaved change?')) return
    setDraft(profile)
    setEditing(field); setError(null); setNotice(null)
    requestAnimationFrame(() => nameInput.current?.focus())
  }
  function cancelEditing() {
    setDraft(profile); setEditing(null); setError(null)
  }
  async function changePhoto(file: File | undefined) {
    if (!file || photoBusy || busy) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Choose a JPG or PNG photo.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Choose a photo smaller than 5 MB.'); return }
    const objectUrl = URL.createObjectURL(file)
    photoObjectUrl.current = objectUrl
    setPhotoPreview(objectUrl); setPhotoBusy(true); setError(null); setNotice(null)
    try {
      const path = await uploadManagerLogo(getSupabaseClient(), file)
      setProfile((current) => current ? { ...current, logoPath: path } : current)
      setDraft((current) => current ? { ...current, logoPath: path } : current)
      setNotice('Profile photo updated.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Photo upload failed. Try again.') }
    finally {
      setPhotoPreview(''); setPhotoBusy(false)
      URL.revokeObjectURL(objectUrl)
      if (photoObjectUrl.current === objectUrl) photoObjectUrl.current = null
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || busy || photoBusy) return
    if (editing === 'organizationName' && draft.organizationName.trim().length < 3) { setError('Enter an organization name with at least 3 characters.'); return }
    if (editing && ['barangay', 'city', 'zipCode'].includes(editing) && !profile?.street.trim()) { setError('Add the street address first, then update the rest of the office address.'); return }
    setBusy(true); setError(null); setNotice(null)
    try {
      const updated = await saveManagerProfile(getSupabaseClient(), draft)
      if (editing && editing !== 'municipalityKey' && String(updated[editing] ?? '').trim() !== String(draft[editing] ?? '').trim()) {
        setError('That change was not saved. Check the value and try again.')
        return
      }
      setProfile(updated); setDraft(updated); setEditing(null); setNotice('Profile changes saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Profile changes could not be saved.') }
    finally { setBusy(false) }
  }

  const changed = Boolean(profile && draft && JSON.stringify(profile) !== JSON.stringify(draft))
  const photoUrl = photoPreview || (profile?.logoPath ? getSupabaseClient().storage.from('event-manager-media').getPublicUrl(profile.logoPath).data.publicUrl : '')
  const kind = profile?.organizationType === 'lgu' ? 'Local government unit' : 'Organization'

  return <div className="em-shell em-market-profile"><EventManagerSidebar active="profile" organizationName={profile?.organizationName} onSignOut={onSignOut} /><main className="em-main"><EventManagerTopbar current="Profile" /><div className="em-content em-workspace-page">
    <div className="em-workspace-heading"><div><h1>Organization profile</h1><p>Keep your organization and contact details current for event coordination.</p></div><button className="em-button-secondary" type="button" disabled={loading || busy || photoBusy} onClick={() => { if (!changed || window.confirm('Discard unsaved changes and reload the profile?')) void refresh() }}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <div className="em-operation-error" role="alert">{error}</div>}{notice && <div className="em-operation-notice" role="status">{notice}</div>}
    {loading && !draft ? <div className="em-workspace-loading" role="status">Loading profile…</div> : !draft || !profile ? <div className="em-workspace-empty"><strong>Profile unavailable</strong><p>Try refreshing to load your organization details.</p></div> : <>
      <section className="em-profile-identity" aria-label="Organization identity">
        <input ref={photoInput} className="em-profile-photo-input" type="file" accept="image/jpeg,image/png" aria-hidden="true" tabIndex={-1} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void changePhoto(file) }} />
        <div className="em-profile-photo-area"><button className="em-profile-photo-button" type="button" aria-label={photoBusy ? 'Updating profile photo' : 'Change profile photo'} title="Change profile photo" disabled={photoBusy || busy} onClick={() => photoInput.current?.click()}>
          {photoUrl ? <img src={photoUrl} alt="" /> : <span className="em-profile-photo-initial" aria-hidden="true">{profile.organizationName.charAt(0) || 'A'}</span>}
        </button><span className="em-profile-photo-hint">{photoBusy ? 'Updating photo…' : 'Click photo to change'}</span><span className="em-profile-photo-format">JPG or PNG · up to 5 MB</span></div>
        <div className="em-profile-identity-content"><div className="em-profile-identity-head"><div><h2>{profile.organizationName || 'Your organization'}</h2><p>{kind}{profile.city ? ' · ' + profile.city : ''}</p></div></div>
          <div className="em-profile-identity-rule"/><p className="em-profile-identity-note">The information your team uses to coordinate events and connect with farmers.</p>
        </div>
      </section>
      <div className="em-profile-sections">{([
        { id: 'organization', title: 'Organization', fields: [['organizationName', 'Organization name'], ['organizationType', 'Organization type'], ['municipalityKey', 'Service municipality']] },
        { id: 'contact', title: 'Contact information', fields: [['contactName', 'Point of contact'], ['officialEmail', 'Official email'], ['officePhone', 'Office contact number']] },
        { id: 'address', title: 'Office address', fields: [['street', 'Street address'], ['barangay', 'Barangay'], ['city', 'City / municipality'], ['zipCode', 'ZIP code']] },
      ] as const).map((section) => <section className={'em-profile-section-panel em-profile-panel-' + section.id} key={section.id}>
        <div className="em-profile-panel-heading"><h3>{section.title}</h3></div>
        <dl>{section.fields.map(([key, label]) => <div className="em-profile-detail" key={key}>
          <dt className="em-profile-field-label"><span>{label}</span>{editing !== key && <button type="button" className="em-profile-field-edit" disabled={busy || photoBusy} onClick={() => beginEditing(key)} aria-label={'Edit ' + label.toLowerCase()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5" /></svg>Edit</button>}</dt>
          <dd>{editing === key ? <form className="em-profile-field-form" onSubmit={(event) => void save(event)}><label className="em-sr-only" htmlFor={'profile-' + key}>{label}</label>{key === 'organizationType' ? <select id={'profile-' + key} ref={(node) => { nameInput.current = node }} disabled={busy} value={draft[key]} onChange={(event) => update(key, event.target.value as ManagerProfile['organizationType'])}><option value="organization">Organization</option><option value="lgu">Local government unit</option></select> : <input id={'profile-' + key} ref={(node) => { nameInput.current = node }} type={key === 'officialEmail' ? 'email' : key === 'officePhone' ? 'tel' : 'text'} required={key === 'organizationName'} minLength={key === 'organizationName' ? 3 : undefined} disabled={busy} value={draft[key]} onChange={(event) => update(key, event.target.value)} />}<div className="em-profile-field-actions"><button className="em-button-secondary" type="button" disabled={busy} onClick={cancelEditing}>Cancel</button><button className="em-button-primary" type="submit" disabled={!changed || busy || photoBusy}>{busy ? 'Saving…' : 'Save'}</button></div></form> : (key === 'organizationType' ? kind : profile[key]) || <span className="is-empty">Not provided</span>}</dd>
        </div>)}</dl>
      </section>)}</div>
      <section className="em-profile-account"><div><h3>Account</h3><p>Sign-in information for this workspace.</p></div><dl><Detail label="Signed in as" value={profile.accountName} /><Detail label="Login email" value={profile.accountEmail} /></dl></section>
    </>}
  </div></main></div>
}
