import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { InviteHandoff as Handoff } from '../event-manager-invites'
import './CreateManagerDialog.css'

export default function InviteHandoff({ invite }: { invite: Handoff }) {
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const expiry = new Date(invite.expiresAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
  async function copy() {
    try { await navigator.clipboard.writeText(invite.url); setCopied(true); setCopyFailed(false) }
    catch { setCopied(false); setCopyFailed(true) }
  }
  return <div className="manager-invite-handoff">
    <div className={`manager-invite-message${invite.emailSent ? ' is-sent' : ' is-unsent'}`} role={invite.emailSent ? 'status' : 'alert'}>
      <span className="manager-invite-message-icon" aria-hidden="true">{invite.emailSent ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></svg>}</span>
      <div><strong>{invite.emailSent ? 'Invitation email sent' : 'Invitation email not sent'}</strong><p>{invite.emailSent ? <>The link and QR code were emailed to <strong>{invite.recipient}</strong>.</> : <>{invite.emailError || 'The invitation email could not be sent.'} Share the link or QR code with <strong>{invite.recipient}</strong>.</>}</p></div>
    </div>
    <div className="manager-invite-share">
      <h4>Share the invitation</h4>
      <p>Anyone with this link or QR code can claim the account before it expires.</p>
      <label htmlFor="manager-invite-url">Invitation link</label>
      <div className="manager-invite-link-row"><input id="manager-invite-url" readOnly value={invite.url} onFocus={event => event.currentTarget.select()} /><button className="manager-invite-copy" type="button" onClick={() => void copy()}><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></svg>{copied ? 'Copied' : 'Copy link'}</button></div>
      {copyFailed && <p className="manager-invite-copy-error" role="alert">Copy failed. Select and copy the link above.</p>}
      <p className="manager-invite-expiry"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 1.5" /></svg><span>Expires {expiry} (Philippine time)</span></p>
      <p className="manager-invite-once">Save the link now. It will not be shown again after this panel closes.</p>
      <button className="manager-invite-qr-toggle" type="button" aria-expanded={showQr} onClick={() => setShowQr(value => !value)}>{showQr ? 'Hide QR code' : 'Show QR code'}<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d={showQr ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'} /></svg></button>
      {showQr && <div className="manager-invite-qr"><QRCodeSVG value={invite.url} size={200} marginSize={2} aria-label="QR code for the invitation link" /><span>Scan with a phone camera to open account setup.</span></div>}
    </div>
  </div>
}
