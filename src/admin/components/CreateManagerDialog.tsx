import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createManagerInvite, type CreateManagerInput, type InviteHandoff as Handoff } from '../event-manager-invites'
import { getSupabaseClient } from '../supabase'
import InviteHandoff from './InviteHandoff'
import './CreateManagerDialog.css'

const empty: CreateManagerInput = { firstName: '', lastName: '', email: '', organizationName: '', organizationType: 'organization', pointOfContact: '', officialEmail: '', officeContact: '', municipality: '' }

export default function CreateManagerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<CreateManagerInput>(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState<Handoff | null>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  function update<K extends keyof CreateManagerInput>(key: K, value: CreateManagerInput[K]) { setForm(current => ({ ...current, [key]: value })) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await createManagerInvite(getSupabaseClient(), form)
      setInvite(result)
      void onCreated().catch(() => undefined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The Event Manager could not be created.') }
    finally { setBusy(false) }
  }
  return <dialog ref={ref} className="manager-create-dialog" aria-labelledby="manager-create-title" onCancel={event => { if (busy) event.preventDefault(); else onClose() }}>
    <div className="manager-create-header"><div><h2 id="manager-create-title">{invite ? 'Event Manager invited' : 'Create Event Manager'}</h2><p>{invite ? 'Share this invitation with the account owner.' : 'Create an account and a one-time setup invitation.'}</p></div><button type="button" aria-label="Close" onClick={onClose} disabled={busy}>×</button></div>
    {invite ? <div className="manager-create-body"><InviteHandoff invite={invite} /><button className="manager-create-primary" type="button" onClick={onClose}>Done</button></div> : <form className="manager-create-body" onSubmit={event => void submit(event)}>
      <div className="manager-create-grid"><label>First name<input value={form.firstName} onChange={event => update('firstName', event.target.value)} maxLength={80} required /></label><label>Last name<input value={form.lastName} onChange={event => update('lastName', event.target.value)} maxLength={80} required /></label></div>
      <label>Sign-in email<input type="email" value={form.email} onChange={event => update('email', event.target.value)} required autoCapitalize="none" /></label>
      <label>Organization name<input value={form.organizationName} onChange={event => update('organizationName', event.target.value)} maxLength={160} required /></label>
      <label>Organization type<select value={form.organizationType} onChange={event => update('organizationType', event.target.value as CreateManagerInput['organizationType'])}><option value="organization">Organization</option><option value="lgu">LGU</option></select></label>
      <div className="manager-create-grid"><label>Point of contact <span>(optional)</span><input value={form.pointOfContact} onChange={event => update('pointOfContact', event.target.value)} /></label><label>Municipality <span>(optional)</span><input value={form.municipality} onChange={event => update('municipality', event.target.value)} /></label></div>
      <label>Official email <span>(optional)</span><input type="email" value={form.officialEmail} onChange={event => update('officialEmail', event.target.value)} /></label>
      <label>Office contact number <span>(optional)</span><input value={form.officeContact} onChange={event => update('officeContact', event.target.value)} /></label>
      <p className="manager-create-note">The manager will choose a password after opening the invitation. Municipality can be completed in their profile before publishing an event.</p>
      {error && <p className="manager-create-error" role="alert">{error}</p>}
      <div className="manager-create-footer"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="manager-create-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create and generate invite'}</button></div>
    </form>}
  </dialog>
}
