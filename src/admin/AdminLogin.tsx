import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import brandLogo from '../assets/AgriMarket.svg'
import { getSupabaseClient } from './supabase'
import { getWebRole, webRolePath } from '../auth/web-role'
import { checkPasswordCriteria, validateNewPassword } from '../auth/password-validation'
import './AdminLogin.css'

export type AdminLoginMode = 'signin' | 'forgot' | 'verify_code' | 'reset'

type Props = {
  onSignIn: (email: string, password: string) => Promise<void>
  onResetPassword?: (email: string) => Promise<void>
  onVerifyCode?: (email: string, code: string) => Promise<void>
  onUpdatePassword?: (password: string) => Promise<void>
  initialError?: string | null
  initialMode?: AdminLoginMode
}

function detectInitialMode(): AdminLoginMode {
  if (typeof window === 'undefined') return 'signin'
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const search = new URLSearchParams(window.location.search)
  if (hash.get('type') === 'recovery' || search.get('type') === 'recovery' || search.has('code')) {
    return 'reset'
  }
  return 'signin'
}

export default function AdminLogin({
  onSignIn,
  onResetPassword,
  onVerifyCode,
  onUpdatePassword,
  initialError,
  initialMode,
}: Props) {
  const [mode, setMode] = useState<AdminLoginMode>(() => initialMode || detectInitialMode())

  // Sign-in state
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

  // Forgot password & code verification state
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isCodeFocused, setIsCodeFocused] = useState(false)
  const forgotEmailRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  // Set new password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const newPasswordRef = useRef<HTMLInputElement>(null)
  const passwordCriteria = checkPasswordCriteria(newPassword)

  // Listen for recovery tokens/hash in the URL (when user clicks an email link directly)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const search = new URLSearchParams(window.location.search)
    const type = hash.get('type') || search.get('type')
    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const tokenHash = hash.get('token_hash')
    const queryCode = search.get('code')

    if (type === 'recovery' || tokenHash || queryCode) {
      async function handleRecoveryInit() {
        try {
          const client = getSupabaseClient()
          if (accessToken && refreshToken) {
            await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            setMode('reset')
          } else if (tokenHash) {
            const { error: otpError } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
            if (!otpError) setMode('reset')
          } else if (queryCode) {
            const { error: codeError } = await client.auth.exchangeCodeForSession(queryCode)
            if (!codeError) setMode('reset')
          } else if (type === 'recovery') {
            setMode('reset')
          }
        } catch {
          // ignore or fallback
        }
      }
      void handleRecoveryInit()
    }
  }, [])

  async function handleSignInSubmit(event: FormEvent<HTMLFormElement>) {
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

  async function handleForgotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const normalizedEmail = forgotEmail.trim().toLowerCase()
    if (!normalizedEmail) {
      setForgotError('Enter your email address.')
      forgotEmailRef.current?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setForgotError('Enter a valid email address.')
      forgotEmailRef.current?.focus()
      return
    }
    setBusy(true)
    setForgotError(null)
    try {
      if (onResetPassword) {
        await onResetPassword(normalizedEmail)
      } else {
        const client = getSupabaseClient()
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined
        const { error: resetErr } = await client.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo,
        })
        if (resetErr) throw resetErr
      }
      setMode('verify_code')
      toast.success('Verification code sent to ' + normalizedEmail)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to send verification code. Please try again.'
      setForgotError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleResendCode() {
    if (busy) return
    const normalizedEmail = forgotEmail.trim().toLowerCase()
    if (!normalizedEmail) return
    setBusy(true)
    setVerifyError(null)
    try {
      if (onResetPassword) {
        await onResetPassword(normalizedEmail)
      } else {
        const client = getSupabaseClient()
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined
        const { error: resetErr } = await client.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo,
        })
        if (resetErr) throw resetErr
      }
      toast.success('A new verification code has been sent to ' + normalizedEmail)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to resend code. Please try again.'
      setVerifyError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const normalizedEmail = forgotEmail.trim().toLowerCase()
    const cleanCode = code.trim()
    if (!cleanCode) {
      setVerifyError('Enter the verification code from your email.')
      codeRef.current?.focus()
      return
    }
    if (cleanCode.length < 6) {
      setVerifyError('Enter the complete verification code from your email.')
      codeRef.current?.focus()
      return
    }
    setBusy(true)
    setVerifyError(null)
    try {
      if (onVerifyCode) {
        await onVerifyCode(normalizedEmail, cleanCode)
      } else {
        const client = getSupabaseClient()
        const { error: otpError } = await client.auth.verifyOtp({
          email: normalizedEmail,
          token: cleanCode,
          type: 'recovery',
        })
        if (otpError) {
          throw new Error('Invalid or expired verification code. Please check your code or request a new one.')
        }
      }
      toast.success('Code verified!')
      setMode('reset')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to verify code. Please try again.'
      setVerifyError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const validation = validateNewPassword(newPassword)
    if (!validation.isValid) {
      setResetError(validation.primaryError)
      newPasswordRef.current?.focus()
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.')
      return
    }
    setBusy(true)
    setResetError(null)
    try {
      if (onUpdatePassword) {
        await onUpdatePassword(newPassword)
      } else {
        const client = getSupabaseClient()
        const { error: updateError } = await client.auth.updateUser({ password: newPassword })
        if (updateError) throw updateError
        const role = await getWebRole(client)
        toast.success('Password updated successfully!')
        if (role) {
          window.location.assign(webRolePath(role))
          return
        }
      }
      setEmail(forgotEmail)
      setMode('signin')
      toast.success('Password updated! Please sign in with your new password.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to update password. Please try again.'
      setResetError(message)
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
            {mode === 'signin' && (
              <>
                <div className="admin-login-heading">
                  <h1>Welcome back.</h1>
                  <span>Sign in to your AgriMarket workspace.</span>
                </div>
                <form onSubmit={handleSignInSubmit} noValidate aria-busy={busy} aria-describedby={visibleError ? 'admin-login-error' : undefined}>
                  <div className="admin-login-field">
                    <label htmlFor="admin-email">Email address</label>
                    <div className="admin-login-input-wrap">
                      <input
                        ref={emailRef}
                        id="admin-email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value)
                          setFieldErrors((current) => ({ ...current, email: undefined }))
                          setError(null)
                          setShowInitialError(false)
                        }}
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? 'admin-email-error' : undefined}
                        disabled={busy}
                      />
                    </div>
                    {fieldErrors.email && <p id="admin-email-error" className="admin-login-field-error" role="alert">{fieldErrors.email}</p>}
                  </div>
                  <div className="admin-login-field">
                    <div className="admin-login-label-row">
                      <label htmlFor="admin-password">Password</label>
                      <button
                        type="button"
                        className="admin-login-forgot-link"
                        onClick={() => {
                          setForgotEmail(email.trim())
                          setForgotError(null)
                          setMode('forgot')
                        }}
                        disabled={busy}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="admin-login-password">
                      <input
                        ref={passwordRef}
                        id="admin-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value)
                          setFieldErrors((current) => ({ ...current, password: undefined }))
                          setError(null)
                          setShowInitialError(false)
                        }}
                        aria-invalid={!!fieldErrors.password}
                        aria-describedby={fieldErrors.password ? 'admin-password-error' : undefined}
                        disabled={busy}
                      />
                      <button
                        className="admin-login-reveal"
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-controls="admin-password"
                        onClick={() => setShowPassword(value => !value)}
                        disabled={busy}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {fieldErrors.password && <p id="admin-password-error" className="admin-login-field-error" role="alert">{fieldErrors.password}</p>}
                  </div>
                  {visibleError && (
                    <p id="admin-login-error" className="admin-login-error" role="alert">
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <circle cx="10" cy="10" r="7.5" />
                        <path d="M10 6v5m0 2v1" />
                      </svg>
                      <span>{visibleError}</span>
                    </p>
                  )}
                  <button className="admin-login-submit" type="submit" disabled={busy}>
                    {busy && <span className="admin-login-spinner" aria-hidden="true" />}
                    <span>{busy ? 'Signing in…' : 'Sign in'}</span>
                    {!busy && (
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M4 10h12m-5-5 5 5-5 5" />
                      </svg>
                    )}
                  </button>
                </form>
              </>
            )}

            {mode === 'forgot' && (
              <>
                <div className="admin-login-heading">
                  <h1>Reset password</h1>
                  <span>Enter your email to receive a verification code.</span>
                </div>
                <form onSubmit={handleForgotSubmit} noValidate aria-busy={busy} aria-describedby={forgotError ? 'admin-forgot-error' : undefined}>
                  <p className="admin-login-instructions">
                    Enter the email address for your staff or administrator account. We will send you an 8-digit verification code to reset your password.
                  </p>
                  <div className="admin-login-field">
                    <label htmlFor="admin-forgot-email">Email address</label>
                    <div className="admin-login-input-wrap">
                      <input
                        ref={forgotEmailRef}
                        id="admin-forgot-email"
                        name="email"
                        type="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(event) => {
                          setForgotEmail(event.target.value)
                          setForgotError(null)
                        }}
                        aria-invalid={!!forgotError}
                        aria-describedby={forgotError ? 'admin-forgot-error' : undefined}
                        disabled={busy}
                        required
                      />
                    </div>
                  </div>
                  {forgotError && (
                    <p id="admin-forgot-error" className="admin-login-error" role="alert">
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <circle cx="10" cy="10" r="7.5" />
                        <path d="M10 6v5m0 2v1" />
                      </svg>
                      <span>{forgotError}</span>
                    </p>
                  )}
                  <button className="admin-login-submit" type="submit" disabled={busy}>
                    {busy && <span className="admin-login-spinner" aria-hidden="true" />}
                    <span>{busy ? 'Sending code…' : 'Send verification code'}</span>
                    {!busy && (
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M4 10h12m-5-5 5 5-5 5" />
                      </svg>
                    )}
                  </button>
                  <div className="admin-login-footer-actions">
                    <button
                      type="button"
                      className="admin-login-back-btn"
                      onClick={() => {
                        setMode('signin')
                        setForgotError(null)
                      }}
                      disabled={busy}
                    >
                      <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M16 10H4m5-5-5 5 5 5" />
                      </svg>
                      <span>Return to sign in</span>
                    </button>
                    {forgotEmail.trim() && (
                      <button
                        type="button"
                        className="admin-login-switch-link"
                        onClick={() => {
                          setMode('verify_code')
                          setVerifyError(null)
                        }}
                      >
                        Already have a code? Enter code
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}

            {mode === 'verify_code' && (
              <>
                <div className="admin-login-heading">
                  <h1>Enter verification code</h1>
                  <span>
                    We sent an 8-digit code to{' '}
                    <strong>{forgotEmail || 'your email'}</strong>.
                  </span>
                </div>
                <form onSubmit={handleVerifyCodeSubmit} noValidate aria-busy={busy} aria-describedby={verifyError ? 'admin-verify-error' : undefined}>
                  <p className="admin-login-instructions">
                    Enter the 8-digit verification code sent to your email to verify your identity before choosing a new password.
                  </p>
                  <div className="admin-login-field">
                    <div className="admin-login-label-row">
                      <label htmlFor="admin-reset-code">Verification code</label>
                      <button
                        type="button"
                        className="admin-login-resend-btn"
                        onClick={() => void handleResendCode()}
                        disabled={busy}
                      >
                        Resend code
                      </button>
                    </div>
                    <div
                      className={`admin-login-otp-wrap${isCodeFocused ? ' is-focused' : ''}${verifyError ? ' has-error' : ''}`}
                      onClick={() => codeRef.current?.focus()}
                    >
                      <input
                        ref={codeRef}
                        id="admin-reset-code"
                        name="code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        maxLength={8}
                        className="admin-login-otp-hidden-input"
                        value={code}
                        onChange={(event) => {
                          const clean = event.target.value.replace(/\D/g, '').slice(0, 8)
                          setCode(clean)
                          setVerifyError(null)
                        }}
                        onFocus={() => setIsCodeFocused(true)}
                        onBlur={() => setIsCodeFocused(false)}
                        required
                        disabled={busy}
                        autoFocus
                        aria-label="8-digit verification code"
                        aria-invalid={!!verifyError}
                        aria-describedby={verifyError ? 'admin-verify-error' : undefined}
                      />
                      <div className="admin-login-otp-slots" aria-hidden="true">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
                          const char = code[index] || ''
                          const isCurrent = isCodeFocused && (code.length === index || (code.length === 8 && index === 7))
                          return (
                            <span key={index} className="admin-login-otp-slot-item">
                              {index === 4 && <span className="admin-login-otp-divider">—</span>}
                              <span
                                className={`admin-login-otp-slot${char ? ' is-filled' : ''}${isCurrent ? ' is-active' : ''}${verifyError ? ' has-error' : ''}`}
                              >
                                {char}
                                {isCurrent && !char && <span className="admin-login-otp-cursor" />}
                              </span>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  {verifyError && (
                    <p id="admin-verify-error" className="admin-login-error" role="alert">
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <circle cx="10" cy="10" r="7.5" />
                        <path d="M10 6v5m0 2v1" />
                      </svg>
                      <span>{verifyError}</span>
                    </p>
                  )}
                  <button className="admin-login-submit" type="submit" disabled={busy || code.trim().length === 0}>
                    {busy && <span className="admin-login-spinner" aria-hidden="true" />}
                    <span>{busy ? 'Verifying code…' : 'Verify code'}</span>
                    {!busy && (
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M4 10h12m-5-5 5 5-5 5" />
                      </svg>
                    )}
                  </button>
                  <div className="admin-login-footer-actions">
                    <button
                      type="button"
                      className="admin-login-back-btn"
                      onClick={() => {
                        setMode('forgot')
                        setVerifyError(null)
                      }}
                      disabled={busy}
                    >
                      <span>Use a different email</span>
                    </button>
                    <button
                      type="button"
                      className="admin-login-switch-link"
                      onClick={() => {
                        setMode('signin')
                        setVerifyError(null)
                      }}
                    >
                      Return to sign in
                    </button>
                  </div>
                </form>
              </>
            )}

            {mode === 'reset' && (
              <>
                <div className="admin-login-heading">
                  <h1>Set new password</h1>
                  <span>Choose a new password for your account.</span>
                </div>
                <form onSubmit={handleResetPasswordSubmit} noValidate aria-busy={busy} aria-describedby={resetError ? 'admin-reset-error' : undefined}>
                  <div className="admin-login-field">
                    <label htmlFor="admin-new-password">New password</label>
                    <div className="admin-login-password">
                      <input
                        ref={newPasswordRef}
                        id="admin-new-password"
                        name="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Choose a strong password"
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value)
                          setResetError(null)
                        }}
                        required
                        minLength={8}
                        disabled={busy}
                        autoFocus
                      />
                      <button
                        className="admin-login-reveal"
                        type="button"
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        aria-controls="admin-new-password"
                        onClick={() => setShowNewPassword(value => !value)}
                        disabled={busy}
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div className="admin-login-pwd-checklist" aria-label="Password requirements">
                      <span className="admin-login-pwd-checklist-title">Password must contain:</span>
                      <ul className="admin-login-pwd-rules">
                        <li className={`admin-login-pwd-rule${passwordCriteria.hasMinLength ? ' is-met' : ''}`}>
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            {passwordCriteria.hasMinLength ? (
                              <path d="M3.5 8.5l3 3 6-7" />
                            ) : (
                              <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
                            )}
                          </svg>
                          <span>8 characters and above</span>
                        </li>
                        <li className={`admin-login-pwd-rule${passwordCriteria.hasLower && passwordCriteria.hasUpper ? ' is-met' : ''}`}>
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            {passwordCriteria.hasLower && passwordCriteria.hasUpper ? (
                              <path d="M3.5 8.5l3 3 6-7" />
                            ) : (
                              <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
                            )}
                          </svg>
                          <span>Uppercase & lowercase letters</span>
                        </li>
                        <li className={`admin-login-pwd-rule${passwordCriteria.hasNumber ? ' is-met' : ''}`}>
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            {passwordCriteria.hasNumber ? (
                              <path d="M3.5 8.5l3 3 6-7" />
                            ) : (
                              <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
                            )}
                          </svg>
                          <span>At least one number</span>
                        </li>
                        <li className={`admin-login-pwd-rule${passwordCriteria.hasSpecial ? ' is-met' : ''}`}>
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            {passwordCriteria.hasSpecial ? (
                              <path d="M3.5 8.5l3 3 6-7" />
                            ) : (
                              <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />
                            )}
                          </svg>
                          <span>At least one special character</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="admin-login-field">
                    <label htmlFor="admin-confirm-password">Confirm new password</label>
                    <div className="admin-login-password">
                      <input
                        id="admin-confirm-password"
                        name="confirm-password"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value)
                          setResetError(null)
                        }}
                        required
                        disabled={busy}
                      />
                    </div>
                  </div>
                  {resetError && (
                    <p id="admin-reset-error" className="admin-login-error" role="alert">
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <circle cx="10" cy="10" r="7.5" />
                        <path d="M10 6v5m0 2v1" />
                      </svg>
                      <span>{resetError}</span>
                    </p>
                  )}
                  <button className="admin-login-submit" type="submit" disabled={busy}>
                    {busy && <span className="admin-login-spinner" aria-hidden="true" />}
                    <span>{busy ? 'Updating password…' : 'Update password and sign in'}</span>
                    {!busy && (
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M4 10h12m-5-5 5 5-5 5" />
                      </svg>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
        <a className="admin-login-public" href="/">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M16 10H4m5-5-5 5 5 5" />
          </svg>
          Return to public site
        </a>
      </div>
    </main>
  )
}
