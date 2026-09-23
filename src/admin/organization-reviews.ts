import type { ActivityEntry, OrganizationDecision, OrganizationRecord } from './types'

export type OrganizationReviewState = {
  organizations: OrganizationRecord[]
  decisions: OrganizationDecision[]
}

type DecisionInput = Pick<OrganizationDecision, 'organizationId' | 'decision' | 'reason' | 'decidedAt'>
type ReviewStorage = Pick<Storage, 'getItem' | 'setItem'>

const storageKey = 'agrimarket-admin-organization-reviews-v1'
const statuses: Record<OrganizationDecision['decision'], OrganizationRecord['status']> = {
  approve: 'Approved',
  'request-details': 'Needs details',
  reject: 'Rejected',
}

export function applyOrganizationDecision(state: OrganizationReviewState, input: DecisionInput): OrganizationReviewState {
  const organization = state.organizations.find((item) => item.id === input.organizationId)
  if (!organization) throw new Error('Application not found.')
  if (!(input.decision in statuses)) throw new Error('Choose a valid decision.')

  const reason = input.reason.trim()
  if (!reason) throw new Error('Enter a reason for this decision.')

  const decision: OrganizationDecision = {
    id: `${input.organizationId}-${input.decidedAt}`,
    organizationId: input.organizationId,
    organizationName: organization.name,
    decision: input.decision,
    reason,
    decidedAt: input.decidedAt,
  }

  return {
    organizations: state.organizations.map((item) =>
      item.id === input.organizationId ? { ...item, status: statuses[input.decision] } : item,
    ),
    decisions: [decision, ...state.decisions],
  }
}

export function loadOrganizationReviews(storage: ReviewStorage | null, defaults: OrganizationRecord[]): OrganizationReviewState {
  const fallback = { organizations: defaults, decisions: [] }
  if (!storage) return fallback

  try {
    const raw = storage.getItem(storageKey)
    if (!raw) return fallback
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return fallback
    const saved = value as Partial<OrganizationReviewState>
    if (!Array.isArray(saved.organizations) || !Array.isArray(saved.decisions)) return fallback
    if (saved.organizations.length !== defaults.length) return fallback
    const validOrganizations = saved.organizations.every((item) =>
      item && typeof item.id === 'string' &&
      defaults.some((original) => original.id === item.id && original.name === item.name) &&
      Object.values(statuses).concat('Pending review').includes(item.status),
    )
    const validDecisions = saved.decisions.every((item) =>
      item && typeof item.id === 'string' && typeof item.organizationId === 'string' &&
      typeof item.organizationName === 'string' && typeof item.reason === 'string' &&
      typeof item.decidedAt === 'string' && item.decision in statuses &&
      defaults.some((original) => original.id === item.organizationId),
    )
    if (!validOrganizations || !validDecisions) return fallback
    return saved as OrganizationReviewState
  } catch {
    return fallback
  }
}

export function saveOrganizationReviews(storage: ReviewStorage | null, state: OrganizationReviewState): boolean {
  if (!storage) return false
  try {
    storage.setItem(storageKey, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function decisionActivityEntries(decisions: OrganizationDecision[]): ActivityEntry[] {
  const titles: Record<OrganizationDecision['decision'], string> = {
    approve: 'Organization approved',
    'request-details': 'More details requested',
    reject: 'Organization rejected',
  }

  return [...decisions]
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))
    .map((decision) => ({
      id: decision.id,
      title: titles[decision.decision],
      subject: decision.organizationName,
      type: 'Organization',
      createdLabel: new Date(decision.decidedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
      dateTime: decision.decidedAt,
      details: decision.reason,
    }))
}
