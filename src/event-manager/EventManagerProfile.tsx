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
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const photoObjectUrl = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const value = await loadManagerProfile(getSupabaseClient())
      setProfile(value); setDraft(value); setEditing(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Profile could not be loaded.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (initialData) return; const timer = setTimeout(() => { void refresh() }, 0); return () => clearTimeout(timer) }, [initialData, refresh])
  useEffect(() => () => { if (photoObjectUrl.current) URL.revokeObjectURL(photoObjectUrl.current) }, [])

  function update<K extends keyof ManagerProfile>(key: K, value: ManagerProfile[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current)
    setError(null); setNotice(null)
  }
  function beginEditing() {
    setEditing(true); setError(null); setNotice(null)
    requestAnimationFrame(() => nameInput.current?.focus())
  }
  function cancelEditing() {
    setDraft(profile); setEditing(false); setError(null)
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
    if (draft.organizationName.trim().length < 3) { setError('Enter an organization name with at least 3 characters.'); return }
    setBusy(true); setError(null); setNotice(null)
    try {
      const updated = await saveManagerProfile(getSupabaseClient(), draft)
      setProfile(updated); setDraft(updated); setEditing(false); setNotice('Profile changes saved.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Profile changes could not be saved.') }
    finally { setBusy(false) }
  }

  const changed = Boolean(profile && draft && JSON.stringify(profile) !== JSON.stringify(draft))
  const photoUrl = photoPreview || (profile?.logoPath ? getSupabaseClient().storage.from('event-manager-media').getPublicUrl(profile.logoPath).data.publicUrl : '')
  const kind = profile?.organizationType === 'lgu' ? 'Local government unit' : 'Organization'

  return <div className="em-shell"><EventManagerSidebar active="profile" organizationName={profile?.organizationName} onSignOut={onSignOut} /><main className="em-main"><EventManagerTopbar current="Profile" /><div className="em-content em-workspace-page">
    <div className="em-workspace-heading"><div><h1>Organization profile</h1><p>Keep your organization and contact details current for event coordination.</p></div><button className="em-button-secondary" type="button" disabled={loading || busy || photoBusy} onClick={() => { if (!changed || window.confirm('Discard unsaved changes and reload the profile?')) void refresh() }}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error && <div className="em-operation-error" role="alert">{error}</div>}{notice && <div className="em-operation-notice" role="status">{notice}</div>}
    {loading && !draft ? <div className="em-workspace-loading" role="status">Loading profile…</div> : !draft || !profile ? <div className="em-workspace-empty"><strong>Profile unavailable</strong><p>Try refreshing to load your organization details.</p></div> : <>
      <section className="em-profile-identity" aria-label="Organization identity">
        <input ref={photoInput} className="em-profile-photo-input" type="file" accept="image/jpeg,image/png" aria-hidden="true" tabIndex={-1} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void changePhoto(file) }} />
        <div className="em-profile-photo-area"><button className="em-profile-photo-button" type="button" aria-label={photoBusy ? 'Updating profile photo' : 'Change profile photo'} title="Change profile photo" disabled={photoBusy || busy} onClick={() => photoInput.current?.click()}>
          {photoUrl ? <img src={photoUrl} alt="" /> : <span className="em-profile-photo-initial" aria-hidden="true">{profile.organizationName.charAt(0) || 'A'}</span>}
          <span className="em-profile-photo-overlay" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span>
        </button><span className="em-profile-photo-hint">{photoBusy ? 'Updating photo…' : 'Click photo to change'}</span><span className="em-profile-photo-format">JPG or PNG · up to 5 MB</span></div>
        <div className="em-profile-identity-content"><div className="em-profile-identity-head"><div><h2>{profile.organizationName || 'Your organization'}</h2><p>{kind}{profile.city ? ' · ' + profile.city : ''}</p></div>{!editing && <button className="em-button-primary" type="button" onClick={beginEditing}>Edit details</button>}</div>
          <div className="em-profile-identity-rule"/><p className="em-profile-identity-note">The information your team uses to coordinate events and connect with farmers.</p>
        </div>
      </section>
      {editing ? <form className="em-profile-form" onSubmit={(event) => void save(event)}>
        <div className="em-profile-form-heading"><div><h2>Edit details</h2><p>Update your organization information below.</p></div><button className="em-button-secondary" type="button" disabled={busy} onClick={cancelEditing}>Cancel</button></div>
        <section className="em-profile-section"><h3>Organization</h3><div className="em-workspace-grid">
          <label>Organization name<input ref={nameInput} required minLength={3} value={draft.organizationName} onChange={(event) => update('organizationName', event.target.value)} /></label>
          <label>Organization type<select value={draft.organizationType} onChange={(event) => update('organizationType', event.target.value as ManagerProfile['organizationType'])}><option value="organization">Organization</option><option value="lgu">Local government unit</option></select></label>
          <label>Municipality key<input value={draft.municipalityKey} onChange={(event) => update('municipalityKey', event.target.value)} /><small>Connects your organization with its service area.</small></label>
        </div></section>
        <section className="em-profile-section"><h3>Contact information</h3><div className="em-workspace-grid">
          <label>Point of contact<input value={draft.contactName} onChange={(event) => update('contactName', event.target.value)} /></label>
          <label>Official email<input type="email" value={draft.officialEmail} onChange={(event) => update('officialEmail', event.target.value)} /></label>
          <label>Office contact number<input type="tel" value={draft.officePhone} onChange={(event) => update('officePhone', event.target.value)} /></label>
        </div></section>
        <section className="em-profile-section"><h3>Office address</h3><div className="em-workspace-grid">
          <label className="em-workspace-wide">Street address<input value={draft.street} onChange={(event) => update('street', event.target.value)} /></label>
          <label>Barangay<input value={draft.barangay} onChange={(event) => update('barangay', event.target.value)} /></label>
          <label>City / municipality<input value={draft.city} onChange={(event) => update('city', event.target.value)} /></label>
          <label>ZIP code<input value={draft.zipCode} onChange={(event) => update('zipCode', event.target.value)} /></label>
        </div></section>
        <div className="em-profile-save"><span role="status">{changed ? 'Unsaved changes' : 'No changes yet'}</span><div><button className="em-button-secondary" type="button" disabled={busy} onClick={cancelEditing}>Cancel</button><button className="em-button-primary" type="submit" disabled={!changed || busy || photoBusy}>{busy ? 'Saving…' : 'Save changes'}</button></div></div>
      </form> : <div className="em-profile-readout"><section className="em-profile-readout-section"><h3>Organization</h3><dl><Detail label="Organization name" value={profile.organizationName} /><Detail label="Organization type" value={kind} /><Detail label="Municipality key" value={profile.municipalityKey} /></dl></section><section className="em-profile-readout-section"><h3>Contact information</h3><dl><Detail label="Point of contact" value={profile.contactName} /><Detail label="Official email" value={profile.officialEmail} /><Detail label="Office contact number" value={profile.officePhone} /></dl></section><section className="em-profile-readout-section"><h3>Office address</h3><dl><Detail label="Street address" value={profile.street} /><Detail label="Barangay" value={profile.barangay} /><Detail label="City / municipality" value={profile.city} /><Detail label="ZIP code" value={profile.zipCode} /></dl></section></div>}
      <section className="em-profile-account"><div><h3>Account</h3><p>Sign-in information for this workspace.</p></div><dl><Detail label="Signed in as" value={profile.accountName} /><Detail label="Login email" value={profile.accountEmail} /></dl></section>
    </>}
  </div></main></div>
}
