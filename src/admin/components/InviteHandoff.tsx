import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { InviteHandoff as Handoff } from '../event-manager-invites'
import './CreateManagerDialog.css'

export default function InviteHandoff({ invite }: { invite: Handoff }) {
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const expiry = new Date(invite.expiresAt).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.url)
      setCopied(true)
      setCopyFailed(false)
      setTimeout(() => setCopied(false), 2600)
    } catch {
      setCopied(false)
      setCopyFailed(true)
    }
  }

  return (
    <div className="manager-invite-handoff">
      <div
        className={`manager-invite-message${invite.emailSent ? ' is-sent' : ' is-unsent'}`}
        role={invite.emailSent ? 'status' : 'alert'}
      >
        <span className="manager-invite-message-icon" aria-hidden="true">
          {invite.emailSent ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6m0 4h.01" />
            </svg>
          )}
        </span>
        <div>
          <strong>{invite.emailSent ? 'Invitation email dispatched' : 'Invitation email could not be sent'}</strong>
          <p>
            {invite.emailSent ? (
              <>The onboarding link and QR code were sent to <strong>{invite.recipient}</strong>.</>
            ) : (
              <>{invite.emailError || 'Email delivery failed.'} Share the invitation link or QR code below with <strong>{invite.recipient}</strong>.</>
            )}
          </p>
        </div>
      </div>

      <div className="manager-invite-share">
        <div className="manager-invite-share-header">
          <h4>Share onboarding invitation</h4>
          <p>Anyone with this link or QR code can activate this account before it expires.</p>
        </div>

        <div className="manager-invite-link-box">
          <label htmlFor="manager-invite-url">Invitation link</label>
          <div className="manager-invite-link-row">
            <input
              id="manager-invite-url"
              readOnly
              value={invite.url}
              onFocus={event => event.currentTarget.select()}
              aria-label="Invitation URL"
            />
            <button
              className={`manager-invite-copy${copied ? ' is-copied' : ''}`}
              type="button"
              onClick={() => void copy()}
            >
              {copied ? (
                <>
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 10l4 4L16 6" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="7" y="7" width="10" height="10" rx="2" />
                    <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                  </svg>
                  <span>Copy link</span>
                </>
              )}
            </button>
          </div>
          {copyFailed && (
            <p className="manager-invite-copy-error" role="alert">
              Copying failed. Please select and copy the text field manually.
            </p>
          )}
        </div>

        <div className="manager-invite-meta-card">
          <div className="manager-invite-expiry">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 6v4.5l2.5 1.5" />
            </svg>
            <span>Expires {expiry} (Philippine time)</span>
          </div>
          <p className="manager-invite-once">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M10 2a4 4 0 0 0-4 4v3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4zm-2 7V6a2 2 0 1 1 4 0v3H8z" />
            </svg>
            <span>Single-use security token. For safety, this exact link will not be visible again once closed.</span>
          </p>
        </div>

        <button
          className="manager-invite-qr-toggle"
          type="button"
          aria-expanded={showQr}
          onClick={() => setShowQr(value => !value)}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="3" width="5" height="5" rx="1" />
            <rect x="12" y="3" width="5" height="5" rx="1" />
            <rect x="3" y="12" width="5" height="5" rx="1" />
            <path d="M12 12h2v2h-2zM15 15h2v2h-2zM12 15h1v1h-1zM16 12h1v1h-1z" />
          </svg>
          <span>{showQr ? 'Hide QR code' : 'Display QR code for mobile setup'}</span>
          <svg className="manager-invite-chevron" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d={showQr ? 'M5 13l5-5 5 5' : 'M5 7l5 5 5-5'} />
          </svg>
        </button>

        {showQr && (
          <div className="manager-invite-qr">
            <div className="manager-invite-qr-frame">
              <QRCodeSVG value={invite.url} size={180} marginSize={2} aria-label="QR code for the invitation link" />
            </div>
            <span>Scan with a smartphone camera to immediately open the setup page.</span>
          </div>
        )}
      </div>
    </div>
  )
}
