import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { InviteHandoff as Handoff } from '../event-manager-invites'
import './CreateManagerDialog.css'

export default function InviteHandoff({ invite }: { invite: Handoff }) {
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const expiry = new Date(invite.expiresAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
  async function copy() {
    try { await navigator.clipboard.writeText(invite.url); setCopied(true) }
    catch { setCopied(false) }
  }
  return <div className="manager-invite-handoff">
    <p>Share this link with the intended Event Manager. Anyone with it can claim the account before it expires.</p>
    <label htmlFor="manager-invite-url">Invitation link</label>
    <input id="manager-invite-url" readOnly value={invite.url} onFocus={event => event.currentTarget.select()} />
    <p className="manager-invite-expiry">Expires {expiry} (Philippine time). The link will not be shown again after this panel closes.</p>
    <div className="manager-invite-actions"><button type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</button><button type="button" onClick={() => setShowQr(value => !value)}>{showQr ? 'Hide QR code' : 'Show QR code'}</button></div>
    {showQr && <div className="manager-invite-qr"><QRCodeSVG value={invite.url} size={220} marginSize={2} aria-label="QR code for the invitation link" /><span>Scan with a phone camera to open setup in a browser.</span></div>}
  </div>
}
