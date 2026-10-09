import { useState, type FormEvent } from 'react'
import brandLogo from '../assets/AgriMarket-admin.svg'
import './AdminLogin.css'

type Props = {
  onSignIn: (email: string, password: string) => Promise<void>
  initialError?: string | null
}

export default function AdminLogin({ onSignIn, initialError }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await onSignIn(email.trim().toLowerCase(), password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-login-page">
      <div className="admin-login-shell">
        <div className="admin-login-brand">
          <a href="/" aria-label="AgriMarket public site"><img src={brandLogo} alt="AgriMarket" /></a>
          <p>Marketplace administration</p>
        </div>
        <section className="admin-login-panel" aria-labelledby="admin-login-title">
          <h1 id="admin-login-title">Administrator sign in</h1>
          <p className="admin-login-intro">Use your AgriMarket administrator account to open the workspace.</p>
          <form onSubmit={submit}>
            <label htmlFor="admin-email">Email address</label>
            <input id="admin-email" name="email" type="email" autoComplete="username" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} />
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} />
            {(error || initialError) && <p className="admin-login-error" role="alert">{error || initialError}</p>}
            <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        </section>
        <a className="admin-login-public" href="/">Return to public site</a>
      </div>
    </main>
  )
}
