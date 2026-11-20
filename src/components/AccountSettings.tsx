import { useEffect, useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../admin/supabase'
import { getWebAccount, type WebAccount, type WebRole } from '../auth/web-role'
import { validateNewPassword } from '../auth/password-validation'
import './AccountSettings.css'

export default function AccountSettings({ role }: { role: WebRole }) {
  const [account, setAccount] = useState<WebAccount | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEffect(() => {
    let active = true
    void getWebAccount(getSupabaseClient()).then((value) => {
      if (!active) return
      if (!value || value.role !== role) throw new Error('This account does not have access to these settings.')
      setAccount(value)
      setAccountError(null)
    }).catch((cause) => {
      if (active) setAccountError(cause instanceof Error ? cause.message : 'Account details could not be loaded.')
    }).finally(() => { if (active) setAccountLoading(false) })
    return () => { active = false }
  }, [role, retry])

  function reloadAccount() {
    setAccountLoading(true)
    setAccountError(null)
    setRetry((value) => value + 1)
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !account) return
    setPasswordError(null)
    setPasswordSuccess(false)
    if (!currentPassword) { setPasswordError('Enter your current password.'); return }
    const validation = validateNewPassword(newPassword)
    if (!validation.isValid) { setPasswordError(validation.primaryError); return }
    if (newPassword === currentPassword) { setPasswordError('Choose a password different from your current one.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('The new passwords do not match.'); return }

    setSaving(true)
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ current_password: currentPassword, password: newPassword })
      if (error) throw error
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(true)
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Password could not be changed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="account-settings">
    <div className="account-settings-panel">
      <section className="account-settings-details" aria-labelledby="settings-account-title">
        <h2 id="settings-account-title">Account</h2>
        <p>Your sign-in details for this workspace.</p>
        {accountLoading ? <p className="account-settings-state" role="status">Loading account details…</p> : accountError ? <div className="account-settings-state" role="alert"><p>{accountError}</p><button type="button" onClick={reloadAccount}>Try again</button></div> : account && <dl>
          <div><dt>Name</dt><dd>{account.name}</dd></div>
          <div><dt>Email address</dt><dd>{account.email}</dd></div>
          <div><dt>Access</dt><dd>{role === 'admin' ? 'Administrator' : 'Event Manager'}</dd></div>
        </dl>}
      </section>

      <section className="account-settings-security" aria-labelledby="settings-password-title">
        <h2 id="settings-password-title">Change password</h2>
        <p>Enter your current password, then choose a new one for this account.</p>
        <form onSubmit={(event) => void changePassword(event)} noValidate aria-busy={saving}>
          <label htmlFor="settings-current-password">Current password</label>
          <input id="settings-current-password" name="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setPasswordError(null); setPasswordSuccess(false) }} disabled={saving || !account} required />
          <label htmlFor="settings-new-password">New password</label>
          <input id="settings-new-password" name="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordError(null); setPasswordSuccess(false) }} disabled={saving || !account} required minLength={8} aria-describedby="settings-password-hint" />
          <span id="settings-password-hint" className="account-settings-hint">At least 8 characters with uppercase, lowercase, numbers, and special characters.</span>
          <label htmlFor="settings-confirm-password">Confirm new password</label>
          <input id="settings-confirm-password" name="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setPasswordError(null); setPasswordSuccess(false) }} disabled={saving || !account} required />
          {passwordError && <p className="account-settings-error" role="alert">{passwordError}</p>}
          {passwordSuccess && <p className="account-settings-success" role="status">Password changed. Use the new password next time you sign in.</p>}
          <button className="account-settings-submit" type="submit" disabled={saving || !account}>{saving ? 'Updating password…' : 'Update password'}</button>
        </form>
      </section>
    </div>
  </div>
}
