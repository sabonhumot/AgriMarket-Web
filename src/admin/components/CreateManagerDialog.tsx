import { useEffect, useRef, useState, type FormEvent } from 'react'
import AppSelect from '../../components/AppSelect'
import { createManagerInvite, type CreateManagerInput, type InviteHandoff as Handoff } from '../event-manager-invites'
import { getSupabaseClient } from '../supabase'
import InviteHandoff from './InviteHandoff'
import './CreateManagerDialog.css'

const empty: CreateManagerInput = {
  firstName: '',
  lastName: '',
  email: '',
  organizationName: '',
  organizationType: 'organization',
  pointOfContact: '',
  officialEmail: '',
  officeContact: '',
  municipality: '',
}

export default function CreateManagerDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState<CreateManagerInput>(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState<Handoff | null>(null)

  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  function update<K extends keyof CreateManagerInput>(key: K, value: CreateManagerInput[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await createManagerInvite(getSupabaseClient(), form)
      setInvite(result)
      void onCreated().catch(() => undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Event Manager could not be created.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="manager-create-dialog"
      aria-labelledby="manager-create-title"
      onCancel={event => {
        if (busy) event.preventDefault()
        else onClose()
      }}
    >
      <div className="manager-create-header">
        <div className="manager-create-header-main">
          <div className="manager-create-badge-row">
            <span className="manager-create-icon-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M19 8v6m3-3h-6" />
              </svg>
            </span>
            <span className="manager-create-tag">Account Provisioning</span>
          </div>
          <h2 id="manager-create-title">
            {invite ? 'Event Manager Invited' : 'Create Event Manager'}
          </h2>
          <p>
            {invite
              ? invite.emailSent
                ? 'The onboarding invitation was emailed directly to the manager.'
                : 'The account was provisioned. Share the setup link or QR code with the manager.'
              : 'Provision an event manager account and generate a secure one-time onboarding link.'}
          </p>
        </div>
        <button
          type="button"
          className="manager-create-close-btn"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>

      {invite ? (
        <div className="manager-create-body manager-create-handoff-body">
          <InviteHandoff invite={invite} />
          <div className="manager-create-footer">
            <button className="manager-create-primary" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form className="manager-create-form" onSubmit={event => void submit(event)}>
          <div className="manager-create-body">
            <div className="manager-create-sections">
              {/* Section 1: Account & Credentials */}
              <section className="manager-create-section" aria-labelledby="mgr-sec-identity">
                <div className="manager-create-section-header">
                  <div className="manager-create-section-num" aria-hidden="true">1</div>
                  <div>
                    <h3 id="mgr-sec-identity" className="manager-create-section-title">Manager Identity &amp; Sign-in</h3>
                    <p className="manager-create-section-desc">Personal details for the account holder.</p>
                  </div>
                </div>
                <div className="manager-create-fields">
                  <div className="manager-create-grid">
                    <div className="manager-create-field">
                      <label htmlFor="mgr-first-name">
                        <span>First name</span>
                        <span className="manager-create-req" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="mgr-first-name"
                        value={form.firstName}
                        onChange={event => update('firstName', event.target.value)}
                        maxLength={80}
                        placeholder="e.g. Maria"
                        required
                        disabled={busy}
                      />
                    </div>
                    <div className="manager-create-field">
                      <label htmlFor="mgr-last-name">
                        <span>Last name</span>
                        <span className="manager-create-req" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="mgr-last-name"
                        value={form.lastName}
                        onChange={event => update('lastName', event.target.value)}
                        maxLength={80}
                        placeholder="e.g. Santos"
                        required
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <div className="manager-create-field">
                    <label htmlFor="mgr-email">
                      <span>Sign-in email address</span>
                      <span className="manager-create-req" aria-hidden="true">*</span>
                    </label>
                    <div className="manager-create-input-with-icon">
                      <svg className="manager-create-field-icon" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <rect x="2" y="4" width="16" height="12" rx="2" />
                        <path d="M2 6l8 6 8-6" />
                      </svg>
                      <input
                        id="mgr-email"
                        type="email"
                        value={form.email}
                        onChange={event => update('email', event.target.value)}
                        placeholder="maria.santos@organization.gov.ph"
                        required
                        autoCapitalize="none"
                        disabled={busy}
                      />
                    </div>
                    <span className="manager-create-field-hint">The manager will use this email address to sign in and receive onboarding instructions.</span>
                  </div>
                </div>
              </section>

              {/* Section 2: Organization & Operations */}
              <section className="manager-create-section" aria-labelledby="mgr-sec-org">
                <div className="manager-create-section-header">
                  <div className="manager-create-section-num" aria-hidden="true">2</div>
                  <div>
                    <h3 id="mgr-sec-org" className="manager-create-section-title">Organization &amp; Representation</h3>
                    <p className="manager-create-section-desc">Details of the partnering agency, cooperative, or local government unit.</p>
                  </div>
                </div>
                <div className="manager-create-fields">
                  <div className="manager-create-grid">
                    <div className="manager-create-field">
                      <label htmlFor="mgr-org-name">
                        <span>Organization name</span>
                        <span className="manager-create-req" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="mgr-org-name"
                        value={form.organizationName}
                        onChange={event => update('organizationName', event.target.value)}
                        maxLength={160}
                        placeholder="e.g. Municipal Agriculture Office"
                        required
                        disabled={busy}
                      />
                    </div>
                    <div className="manager-create-field manager-create-select-field">
                      <span className="manager-create-label-text">
                        <span>Organization type</span>
                        <span className="manager-create-req" aria-hidden="true">*</span>
                      </span>
                      <AppSelect
                        label="Organization type"
                        value={form.organizationType}
                        onChange={value => update('organizationType', value as CreateManagerInput['organizationType'])}
                        options={[
                          { value: 'organization', label: 'Organization (Cooperative / NGO)' },
                          { value: 'lgu', label: 'LGU (Local Government Unit)' }
                        ]}
                      />
                    </div>
                  </div>

                  <div className="manager-create-grid">
                    <div className="manager-create-field">
                      <label htmlFor="mgr-poc">
                        <span>Point of contact</span>
                        <span className="manager-create-opt">Optional</span>
                      </label>
                      <input
                        id="mgr-poc"
                        value={form.pointOfContact}
                        onChange={event => update('pointOfContact', event.target.value)}
                        placeholder="e.g. Engr. Juan Dela Cruz"
                        disabled={busy}
                      />
                    </div>
                    <div className="manager-create-field">
                      <label htmlFor="mgr-municipality">
                        <span>Municipality</span>
                        <span className="manager-create-opt">Optional</span>
                      </label>
                      <input
                        id="mgr-municipality"
                        value={form.municipality}
                        onChange={event => update('municipality', event.target.value)}
                        placeholder="e.g. Silang, Cavite"
                        disabled={busy}
                      />
                    </div>
                  </div>

                  <div className="manager-create-grid">
                    <div className="manager-create-field">
                      <label htmlFor="mgr-official-email">
                        <span>Official office email</span>
                        <span className="manager-create-opt">Optional</span>
                      </label>
                      <input
                        id="mgr-official-email"
                        type="email"
                        value={form.officialEmail}
                        onChange={event => update('officialEmail', event.target.value)}
                        placeholder="e.g. agriculture@silang.gov.ph"
                        disabled={busy}
                      />
                    </div>
                    <div className="manager-create-field">
                      <label htmlFor="mgr-office-contact">
                        <span>Office contact number</span>
                        <span className="manager-create-opt">Optional</span>
                      </label>
                      <input
                        id="mgr-office-contact"
                        value={form.officeContact}
                        onChange={event => update('officeContact', event.target.value)}
                        placeholder="e.g. (046) 414-1234 / 0917 123 4567"
                        disabled={busy}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Informational notice */}
              <div className="manager-create-info-card">
                <div className="manager-create-info-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="10" cy="10" r="8" />
                    <path d="M10 9v5m0-8h.01" />
                  </svg>
                </div>
                <div>
                  <strong>One-Time Setup Invitation</strong>
                  <p>The manager will configure their secure password upon opening their invitation link. Contact details and municipality can also be completed directly in their account profile.</p>
                </div>
              </div>

              {error && (
                <div className="manager-create-error" role="alert">
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" />
                    <path d="M10 6v5m0 2v1" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="manager-create-footer">
            <button type="button" className="manager-create-cancel-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="manager-create-primary" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <span className="manager-create-spinner" aria-hidden="true" />
                  <span>Creating account…</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                  <span>Create and generate invite</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
