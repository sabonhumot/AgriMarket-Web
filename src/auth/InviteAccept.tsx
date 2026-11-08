import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../admin/supabase'
import { completeManagerInvite } from '../admin/event-manager-invites'
import './InviteAccept.css'

type Setup = { email: string; organization_name: string; status: string; generation_id: string }
type Phase = 'checking' | 'ready' | 'verifying' | 'password' | 'saving' | 'done' | 'error' | 'switch'

const passwordValid = (value: string) => value.length >= 8 && value.length <= 16 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)
const maskedEmail = (value: string) => value.replace(/(^.).*(@.*$)/, '$1••••$2')

export default function InviteAccept() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [setup, setSetup] = useState<Setup | null>(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [token] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    return { hash: hash.get('token_hash'), type: hash.get('type'), generation: hash.get('generation_id') }
  })

  useEffect(() => {
    if (token.hash) window.history.replaceState({}, '', '/invite/accept')
  }, [token])

  useEffect(() => {
    let live = true
    async function check() {
      try {
        const client = getSupabaseClient()
        const { data: { user } } = await client.auth.getUser()
        if (!live) return
        if (!user) { setPhase(token.hash ? 'ready' : 'error'); if (!token.hash) setError('This invitation link is missing. Ask the admin for a new link.'); return }
        const { data, error: setupError } = await client.rpc('get_my_event_manager_invite_setup')
        if (!live) return
        if (setupError || !data || data.status !== 'pending_verification') {
          setPhase(token.hash ? 'switch' : 'error')
          setError(token.hash ? 'Another account is signed in. Sign out before accepting this invitation.' : 'This account has no pending Event Manager setup.')
          return
        }
        if (token.hash && data.generation_id !== token.generation) { setPhase('switch'); setError('Another account is signed in. Sign out before accepting this invitation.'); return }
        setSetup(data as Setup)
        setPhase('password')
      } catch { if (live) { setPhase('error'); setError('Could not check this invitation. Try again.') } }
    }
    void check()
    return () => { live = false }
  }, [token])

  async function accept() {
    if (!token.hash || !token.generation || !['invite', 'magiclink'].includes(token.type ?? '')) return
    setPhase('verifying'); setError('')
    const client = getSupabaseClient()
    const { error: verifyError } = await client.auth.verifyOtp({ token_hash: token.hash, type: token.type as 'invite' | 'magiclink' })
    if (verifyError) { setPhase('error'); setError('This link is invalid, expired, or has already been used. Ask the admin for a new one.'); return }
    const { data, error: setupError } = await client.rpc('get_my_event_manager_invite_setup')
    if (setupError || !data || data.status !== 'pending_verification' || data.generation_id !== token.generation) {
      await client.auth.signOut({ scope: 'local' })
      setPhase('error'); setError('This invitation has been replaced or could not be matched to an Event Manager account. Ask the admin for a new one.'); return
    }
    setSetup(data as Setup); setPhase('password')
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!setup || !passwordValid(password) || password !== confirm) return
    setPhase('saving'); setError('')
    const client = getSupabaseClient()
    try {
      await completeManagerInvite(client, setup.generation_id, password)
    } catch (cause) {
      setPhase('password')
      setError(cause instanceof Error ? cause.message : 'Account setup could not finish. Try again.')
      return
    }
    try {
      const { data, error: signInError } = await client.auth.signInWithPassword({ email: setup.email, password })
      if (signInError || !data.session) throw signInError ?? new Error('No session returned')
      setPassword(''); setConfirm('')
      setPhase('done')
      window.location.assign('/event-manager')
    } catch {
      setPassword(''); setConfirm('')
      setPhase('done')
      setError('Your account is ready, but automatic sign-in failed. Sign in with your new password.')
    }
  }

  async function switchAccount() {
    await getSupabaseClient().auth.signOut({ scope: 'local' })
    setError('')
    setPhase('ready')
  }

  const isPasswordStep = phase === 'password' || phase === 'saving'
  const isBusy = phase === 'checking' || phase === 'verifying' || phase === 'saving'
  const retryableError = error === 'Could not check this invitation. Try again.'
  const requirements = [
    { label: '8–16 characters', met: password.length >= 8 && password.length <= 16 },
    { label: 'Uppercase and lowercase letters', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'A number and a symbol', met: /\d/.test(password) && /[^A-Za-z0-9]/.test(password) },
  ]

  return (
    <main className="invite-page">
      <div className="invite-shell">
        <aside className="invite-intro" aria-label="Account setup progress">
          <a className="invite-brand" href="/" aria-label="AgriMarket home"><span className="invite-brand-mark" aria-hidden="true">A</span><span>AgriMarket</span></a>
          <div className="invite-intro-content">
            <span className="invite-eyebrow">EVENT MANAGER ACCESS</span>
            <h1>Your place in the market starts here.</h1>
            <p>Set up your account to plan events and bring your community together through AgriMarket.</p>
            <ol className="invite-steps">
              <li className={isPasswordStep || phase === 'done' ? 'is-complete' : 'is-active'} aria-current={phase === 'ready' || phase === 'verifying' ? 'step' : undefined}>
                <span className="invite-step-number" aria-hidden="true">{isPasswordStep || phase === 'done' ? '✓' : '1'}</span>
                <span><strong>Accept invitation</strong><small>Confirm your Event Manager access</small></span>
              </li>
              <li className={isPasswordStep ? 'is-active' : phase === 'done' ? 'is-complete' : ''} aria-current={isPasswordStep ? 'step' : undefined}>
                <span className="invite-step-number" aria-hidden="true">{phase === 'done' ? '✓' : '2'}</span>
                <span><strong>Create password</strong><small>Secure your new workspace</small></span>
              </li>
            </ol>
          </div>
          <p className="invite-intro-foot">AgriMarket · Connecting farmers, buyers, and cooperatives</p>
        </aside>

        <section className="invite-panel" aria-labelledby="invite-panel-title" aria-busy={isBusy}>
          <div className="invite-panel-top"><span className="invite-panel-kicker">{isPasswordStep ? 'STEP 02 / 02' : phase === 'done' ? 'SETUP COMPLETE' : 'STEP 01 / 02'}</span><span className="invite-panel-status"><span aria-hidden="true" />Secure account setup</span></div>
          {phase === 'checking' && <div className="invite-state" role="status"><span className="invite-loader" aria-hidden="true" /><h2 id="invite-panel-title">Checking your invitation</h2><p>We’re confirming that your link is ready to use.</p></div>}
          {phase === 'ready' && <div className="invite-content">
            <span className="invite-icon" aria-hidden="true">✉</span>
            <h2 id="invite-panel-title">You’re invited.</h2>
            <p className="invite-lead">An AgriMarket admin has invited you to manage market events. Accept the invitation to create your password and activate your account.</p>
            <div className="invite-info"><span>YOUR ACCESS</span><strong>Event Manager</strong><small>Invitation links are for one person and expire shortly.</small></div>
            <button className="invite-primary" type="button" onClick={() => void accept()}>Accept invitation <span aria-hidden="true">→</span></button>
            <p className="invite-support">Didn’t expect this? You can close this page.</p>
          </div>}
          {phase === 'verifying' && <div className="invite-state" role="status"><span className="invite-loader" aria-hidden="true" /><h2 id="invite-panel-title">Verifying your invitation</h2><p>This should only take a moment.</p></div>}
          {isPasswordStep && setup && <div className="invite-content">
            <span className="invite-icon invite-icon-lock" aria-hidden="true">✦</span>
            <h2 id="invite-panel-title">Create your password.</h2>
            <p className="invite-lead">One last step before you can open your Event Manager workspace.</p>
            <div className="invite-account"><span>SETTING UP ACCESS FOR</span><strong>{setup.organization_name}</strong><small>{maskedEmail(setup.email)}</small></div>
            <form onSubmit={event => void save(event)} aria-busy={phase === 'saving'}>
              <div className="invite-field"><label htmlFor="invite-password">New password</label><div className="invite-input-wrap"><input id="invite-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={phase === 'saving'} aria-describedby="invite-requirements" required /><button className="invite-reveal" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="invite-password" disabled={phase === 'saving'}>{showPassword ? 'Hide' : 'Show'}</button></div></div>
              <ul className="invite-requirements" id="invite-requirements">{requirements.map(rule => <li key={rule.label} className={rule.met ? 'is-met' : ''}><span aria-hidden="true">{rule.met ? '✓' : '○'}</span>{rule.label}</li>)}</ul>
              <div className="invite-field"><label htmlFor="invite-confirm">Confirm password</label><input id="invite-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} disabled={phase === 'saving'} aria-invalid={!!confirm && confirm !== password} aria-describedby={confirm && confirm !== password ? 'invite-confirm-error' : undefined} required />{confirm && confirm !== password && <p id="invite-confirm-error" className="invite-field-error">Passwords don’t match yet.</p>}</div>
              {error && <p className="invite-error" role="alert">{error}</p>}
              <button className="invite-primary" type="submit" disabled={phase === 'saving' || !passwordValid(password) || password !== confirm}>{phase === 'saving' ? 'Setting up your account…' : 'Open my workspace'}{phase !== 'saving' && <span aria-hidden="true">→</span>}</button>
            </form>
          </div>}
          {phase === 'switch' && <div className="invite-content"><span className="invite-icon invite-icon-alert" aria-hidden="true">!</span><h2 id="invite-panel-title">A different account is signed in.</h2><p className="invite-lead">{error}</p><button className="invite-primary" type="button" onClick={() => void switchAccount()}>Sign out and continue <span aria-hidden="true">→</span></button></div>}
          {phase === 'error' && <div className="invite-content"><span className="invite-icon invite-icon-alert" aria-hidden="true">!</span><h2 id="invite-panel-title">{retryableError ? 'We couldn’t check the invitation.' : 'This invitation needs attention.'}</h2><p className="invite-lead" role="alert">{error}</p><p className="invite-support">{retryableError ? 'Check your connection and try again.' : 'Ask your AgriMarket admin for help or a new invitation.'}</p>{retryableError && <button className="invite-primary invite-link-button" type="button" onClick={() => window.location.reload()}>Try again <span aria-hidden="true">→</span></button>}<a className="invite-secondary" href="/login">Return to sign in</a></div>}
          {phase === 'done' && <div className="invite-content"><span className="invite-icon invite-icon-done" aria-hidden="true">✓</span><h2 id="invite-panel-title">Your account is ready.</h2>{error ? <><p className="invite-lead" role="alert">{error}</p><a className="invite-primary invite-link-button" href="/login">Go to sign in <span aria-hidden="true">→</span></a></> : <p className="invite-lead" role="status">Opening your Event Manager workspace…</p>}</div>}
          <p className="invite-panel-foot">Need help? Contact the AgriMarket admin who invited you.</p>
        </section>
      </div>
    </main>
  )
}
