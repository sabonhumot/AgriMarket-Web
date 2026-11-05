import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import brandLogo from '../assets/AgriMarket.svg'
import './AdminLogin.css'

type Props = {
  onSignIn: (email: string, password: string) => Promise<void>
  initialError?: string | null
}

export default function AdminLogin({ onSignIn, initialError }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [showInitialError, setShowInitialError] = useState(true)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const visibleError = error || (showInitialError ? initialError : null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const normalizedEmail = email.trim().toLowerCase()
    const nextErrors: { email?: string; password?: string } = {}
    if (!normalizedEmail) nextErrors.email = 'Enter your email address.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter your password.'
    setFieldErrors(nextErrors)
    setError(null)
    setShowInitialError(false)
    if (nextErrors.email) {
      emailRef.current?.focus()
      return
    }
    if (nextErrors.password) {
      passwordRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      await onSignIn(normalizedEmail, password)
      toast.success('Signed in to AgriMarket')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-login-page">
      <svg className="admin-login-perspective" viewBox="0 0 1440 900" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path d="M440 300 0 0M1000 300 1440 0M440 780 0 900M1000 780 1440 900M440 420 0 280M440 540 0 500M440 660 0 710M1000 420 1440 280M1000 540 1440 500M1000 660 1440 710M552 300 420 0M664 300 620 0M776 300 820 0M888 300 1020 0M552 780 480 900M664 780 640 900M776 780 800 900M888 780 960 900" />
      </svg>
      <div className="admin-login-shell">
        <section className="admin-login-panel" aria-label="AgriMarket sign in">
          <div className="admin-login-brand">
            <a href="/" aria-label="AgriMarket public site">
              <img src={brandLogo} alt="AgriMarket" width="666" height="375" />
            </a>
          </div>
          <div className="admin-login-content">
            <div className="admin-login-heading"><h1>Welcome back.</h1><span>Sign in to your AgriMarket workspace.</span></div>
            <form onSubmit={submit} noValidate aria-busy={busy} aria-describedby={visibleError ? 'admin-login-error' : undefined}>
              <div className="admin-login-field">
                <label htmlFor="admin-email">Email address</label>
                <div className="admin-login-input-wrap">
                  <input ref={emailRef} id="admin-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); setError(null); setShowInitialError(false) }} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined} disabled={busy} />
                </div>
                {fieldErrors.email && <p id="admin-email-error" className="admin-login-field-error" role="alert">{fieldErrors.email}</p>}
              </div>
              <div className="admin-login-field">
                <label htmlFor="admin-password">Password</label>
                <div className="admin-login-password">
                  <input ref={passwordRef} id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); setError(null); setShowInitialError(false) }} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined} disabled={busy} />
                  <button className="admin-login-reveal" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="admin-password" onClick={() => setShowPassword(value => !value)} disabled={busy}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
                {fieldErrors.password && <p id="admin-password-error" className="admin-login-field-error" role="alert">{fieldErrors.password}</p>}
              </div>
              {visibleError && <p id="admin-login-error" className="admin-login-error" role="alert"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 6v5m0 2v1" /></svg><span>{visibleError}</span></p>}
              <button className="admin-login-submit" type="submit" disabled={busy}>{busy && <span className="admin-login-spinner" aria-hidden="true" />}<span>{busy ? 'Signing in…' : 'Sign in'}</span>{!busy && <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>}</button>
            </form>
          </div>
        </section>
        <a className="admin-login-public" href="/"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M16 10H4m5-5-5 5 5 5" /></svg>Return to public site</a>
      </div>
    </main>
  )
}
