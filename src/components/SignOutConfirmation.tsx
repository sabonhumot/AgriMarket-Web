import { useEffect, useRef } from 'react'
import './SignOutConfirmation.css'

type Props = {
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

export default function SignOutConfirmation({ busy, error, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('.signout-confirm-cancel')?.focus({ preventScroll: true })
    return () => {
      dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  return <dialog
    ref={dialogRef}
    className="signout-confirm-dialog"
    aria-labelledby="signout-confirm-title"
    aria-describedby="signout-confirm-description"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onCancel() }}
  >
    <div className="signout-confirm-content">
      <span className="signout-confirm-eyebrow">Account</span>
      <h2 id="signout-confirm-title">Sign out of AgriMarket?</h2>
      <p id="signout-confirm-description">You’ll need to sign in again to access your workspace.</p>
      {error && <p className="signout-confirm-error" role="alert">{error}</p>}
      <div className="signout-confirm-actions">
        <button className="signout-confirm-cancel" type="button" disabled={busy} onClick={onCancel}>Stay signed in</button>
        <button className="signout-confirm-submit" type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Signing out…' : 'Sign out'}</button>
      </div>
    </div>
  </dialog>
}
