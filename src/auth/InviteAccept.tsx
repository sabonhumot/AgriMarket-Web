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
    try {
      await completeManagerInvite(getSupabaseClient(), setup.generation_id, password)
      setPhase('done')
      window.location.assign('/event-manager')
    } catch (cause) {
      setPhase('password')
      setError(cause instanceof Error ? cause.message : 'Account setup could not finish. Try again.')
    }
  }

  async function switchAccount() {
    await getSupabaseClient().auth.signOut({ scope: 'local' })
    setError('')
    setPhase('ready')
  }

  return <main className="invite-page"><div className="invite-card">
    <a className="invite-brand" href="/">AgriMarket</a>
    <h1>{phase === 'password' || phase === 'saving' ? 'Set up your Event Manager account' : 'Event Manager invitation'}</h1>
    {phase === 'checking' && <p role="status">Checking invitation…</p>}
    {phase === 'ready' && <><p>Accept this invitation to set a password for your AgriMarket Event Manager account.</p><button type="button" onClick={() => void accept()}>Accept invitation</button></>}
    {phase === 'verifying' && <p role="status">Verifying invitation…</p>}
    {(phase === 'password' || phase === 'saving') && setup && <>
      <p><strong>{setup.organization_name}</strong><br />Account: {maskedEmail(setup.email)}</p>
      <form onSubmit={event => void save(event)}>
        <label htmlFor="invite-password">New password</label><input id="invite-password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={phase === 'saving'} required />
        <p className="invite-hint">Use 8–16 characters with uppercase, lowercase, a number, and a symbol.</p>
        <label htmlFor="invite-confirm">Confirm password</label><input id="invite-confirm" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} disabled={phase === 'saving'} required />
        {error && <p className="invite-error" role="alert">{error}</p>}
        <button type="submit" disabled={phase === 'saving' || !passwordValid(password) || password !== confirm}>{phase === 'saving' ? 'Setting up…' : 'Finish setup'}</button>
      </form>
    </>}
    {phase === 'switch' && <><p className="invite-error" role="alert">{error}</p><button type="button" onClick={() => void switchAccount()}>Sign out and continue</button></>}
    {phase === 'error' && <><p className="invite-error" role="alert">{error}</p><a href="/login">Return to sign in</a></>}
    {phase === 'done' && <p role="status">Account ready. Opening your workspace…</p>}
  </div></main>
}
