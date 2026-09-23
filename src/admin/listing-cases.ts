import type { ActivityEntry, ListingCase, ListingCaseAction, ListingCaseEvent, ReviewStatus } from './types'

type CaseStorage = Pick<Storage, 'getItem' | 'setItem'>
const storageKey = 'agrimarket-admin-listing-cases-v1'

const titles: Record<ListingCaseAction, string> = {
  'start-review': 'Listing review started',
  note: 'Listing case note added',
  'request-correction': 'Listing correction requested',
  keep: 'Listing kept visible',
  hide: 'Listing hidden',
  remove: 'Listing removed',
  reopen: 'Listing case reopened',
}

export function applyListingCaseAction(
  cases: ListingCase[],
  reportId: string,
  action: ListingCaseAction,
  reason: string,
  at: string,
): ListingCase[] {
  const selected = cases.find((item) => item.reportId === reportId)
  if (!selected) throw new Error('Listing case not found.')
  if (!(action in titles)) throw new Error('Choose a valid case action.')

  const normalizedReason = reason.trim()
  if (action !== 'start-review' && !normalizedReason) throw new Error('Enter a reason for this action.')
  if (action === 'start-review' && selected.status !== 'needs-review') throw new Error('This case has already been started.')
  if (action === 'reopen' && selected.status !== 'resolved' && selected.status !== 'waiting-for-info') {
    throw new Error('Only a closed or waiting case can be reopened.')
  }
  if (['request-correction', 'keep', 'hide', 'remove'].includes(action) &&
      selected.status !== 'investigating' && selected.status !== 'waiting-for-info') {
    throw new Error('Start the review before taking action.')
  }

  const status: ReviewStatus = action === 'start-review' || action === 'reopen'
    ? 'investigating'
    : action === 'request-correction'
      ? 'waiting-for-info'
      : action === 'keep' || action === 'hide' || action === 'remove'
        ? 'resolved'
        : selected.status
  const outcome = action === 'keep' || action === 'hide' || action === 'remove'
    ? action
    : action === 'reopen' ? null : selected.outcome
  const visibility = action === 'hide' ? 'Hidden' : action === 'remove' ? 'Removed' : action === 'keep' ? 'Visible' : selected.visibility
  const event: ListingCaseEvent = {
    id: `${reportId}-${at}-${selected.events.length}`,
    action,
    reason: normalizedReason || 'Review started.',
    at,
  }

  return cases.map((item) => item.reportId === reportId
    ? { ...item, status, outcome, visibility, events: [event, ...item.events] }
    : item)
}

export function loadListingCases(storage: CaseStorage | null, defaults: ListingCase[]): ListingCase[] {
  if (!storage) return defaults
  try {
    const raw = storage.getItem(storageKey)
    if (!raw) return defaults
    const saved: unknown = JSON.parse(raw)
    if (!Array.isArray(saved) || saved.length !== defaults.length) return defaults
    const valid = saved.every((item) => item &&
      defaults.some((original) => original.reportId === item.reportId) &&
      ['needs-review', 'investigating', 'waiting-for-info', 'resolved'].includes(item.status) &&
      [null, 'keep', 'hide', 'remove'].includes(item.outcome) &&
      ['Visible', 'Hidden', 'Removed'].includes(item.visibility) &&
      Array.isArray(item.events) && item.events.every((event: ListingCaseEvent) =>
        event && typeof event.id === 'string' && event.action in titles &&
        typeof event.reason === 'string' && typeof event.at === 'string'),
    )
    return valid ? saved as ListingCase[] : defaults
  } catch {
    return defaults
  }
}

export function saveListingCases(storage: CaseStorage | null, cases: ListingCase[]): boolean {
  if (!storage) return false
  try {
    storage.setItem(storageKey, JSON.stringify(cases))
    return true
  } catch {
    return false
  }
}

export function listingCaseActivityEntries(cases: ListingCase[]): ActivityEntry[] {
  return cases.flatMap((item) => item.events.map((event) => ({
    id: event.id,
    title: titles[event.action],
    subject: item.listingTitle || item.reportId,
    type: 'Moderation',
    createdLabel: new Date(event.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
    dateTime: event.at,
    details: event.reason,
  }))).sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''))
}
