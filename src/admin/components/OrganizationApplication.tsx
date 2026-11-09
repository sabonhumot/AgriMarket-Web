import { useState, type FormEvent } from 'react'
import AppSelect from '../../components/AppSelect'
import type { OrganizationDecision, OrganizationRecord } from '../types'

type Props = {
  organization: OrganizationRecord
  decisions: OrganizationDecision[]
  onDecision: (decision: OrganizationDecision['decision'], reason: string) => void
  onClose: () => void
}

export default function OrganizationApplication({ organization, decisions, onDecision, onClose }: Props) {
  const [decision, setDecision] = useState<OrganizationDecision['decision']>('approve')
  const [reason, setReason] = useState('')
  const history = decisions.filter((item) => item.organizationId === organization.id)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reason.trim()) return
    onDecision(decision, reason)
    setReason('')
  }

  return (
    <section className="organization-application" aria-labelledby="organization-application-title">
      <div className="organization-application-heading">
        <div>
          <p className="organization-application-label">Application details</p>
          <h3 id="organization-application-title" tabIndex={-1}>{organization.name}</h3>
          <p>Submitted {organization.submitted} · Current status: <strong>{organization.status}</strong></p>
        </div>
        <button type="button" className="organization-close" onClick={onClose} aria-label="Close application details">×</button>
      </div>

      <dl className="organization-facts">
        <div><dt>Applicant</dt><dd>{organization.owner}</dd></div>
        <div><dt>Group type</dt><dd>{organization.type}</dd></div>
        <div><dt>Location</dt><dd>{organization.location || 'Not supplied'}</dd></div>
        <div><dt>Contact</dt><dd>{organization.contactEmail || 'Not supplied'}</dd></div>
        <div className="organization-fact-wide"><dt>Application summary</dt><dd>{organization.applicationSummary || 'Not supplied'}</dd></div>
        <div className="organization-fact-wide">
          <dt>Submitted documents</dt>
          <dd>{organization.documents?.length ? organization.documents.join(', ') : 'None listed in this demo'}</dd>
        </div>
      </dl>

      <form className="organization-decision-form" onSubmit={submit}>
        <h4>Record a decision</h4>
        <p>This local demo records the decision here and in the activity log.</p>
        <label htmlFor="organization-decision">Decision</label>
        <AppSelect id="organization-decision" label="Decision" value={decision} onChange={(value) => setDecision(value as OrganizationDecision['decision'])} options={[{ value: 'approve', label: 'Approve' }, { value: 'request-details', label: 'Request more details' }, { value: 'reject', label: 'Reject' }]} />
        <label htmlFor="organization-decision-reason">Reason for decision</label>
        <textarea
          id="organization-decision-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          rows={3}
          placeholder="Record what you checked or what is missing"
        />
        <button type="submit" className="organization-save-decision" disabled={!reason.trim()}>Save decision</button>
      </form>

      {history.length > 0 && (
        <div className="organization-decision-history">
          <h4>Decision history</h4>
          <ol>
            {history.map((item) => (
              <li key={item.id}>
                <strong>{item.decision === 'approve' ? 'Approved' : item.decision === 'reject' ? 'Rejected' : 'More details requested'}</strong>
                <time dateTime={item.decidedAt}>{new Date(item.decidedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                <p>{item.reason}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
