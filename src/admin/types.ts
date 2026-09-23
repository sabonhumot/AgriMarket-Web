export type AdminView = 'overview' | 'users' | 'organizations' | 'moderation' | 'security' | 'activity'

export type ReviewStatus = 'needs-review' | 'investigating' | 'waiting-for-info' | 'resolved'

export type Priority = 'high' | 'medium' | 'low'

export type ReviewItem = {
  id: string
  type: 'Listing report' | 'User verification' | 'Organization approval' | 'Access request' | 'Security alert'
  title: string
  subject: string
  status: ReviewStatus
  priority: Priority
  createdLabel: string
  details: string
}

export type UserRecord = {
  id: string
  name: string
  email: string
  role: 'Buyer' | 'Farmer' | 'Organization manager'
  status: 'Active' | 'Needs verification' | 'Restricted'
  lastActive: string
}

export type OrganizationRecord = {
  id: string
  name: string
  owner: string
  type: 'Farm cooperative' | 'Market association' | 'Community group'
  status: 'Pending review' | 'Approved' | 'Needs details' | 'Rejected'
  submitted: string
  location?: string
  contactEmail?: string
  applicationSummary?: string
  documents?: string[]
}

export type OrganizationDecision = {
  id: string
  organizationId: string
  organizationName: string
  decision: 'approve' | 'request-details' | 'reject'
  reason: string
  decidedAt: string
}

export type ListingCaseAction = 'start-review' | 'note' | 'request-correction' | 'keep' | 'hide' | 'remove' | 'reopen'

export type ListingCaseEvent = {
  id: string
  action: ListingCaseAction
  reason: string
  at: string
}

export type ListingCase = {
  reportId: string
  status: ReviewStatus
  outcome: 'keep' | 'hide' | 'remove' | null
  visibility: 'Visible' | 'Hidden' | 'Removed'
  listingTitle: string
  farmer: string
  location: string
  price: string
  availability: string
  reportedBy: string
  reportReason: string
  evidence: string[]
  relatedHistory: string[]
  events: ListingCaseEvent[]
}

export type SecurityEvent = {
  id: string
  title: string
  subject: string
  type: string
  severity: 'High' | 'Medium' | 'Low'
  createdLabel: string
  details: string
}

export type ActivityEntry = {
  id: string
  title: string
  subject: string
  type: string
  createdLabel: string
  details?: string
  dateTime?: string
}
