import { useEffect, useState } from 'react'
import { matchesQuery } from '../admin-state'
import { activityEntries as demoActivityEntries, organizations as demoOrganizations, securityEvents, users } from '../demo-data'
import CustomDropdown from './CustomDropdown'
import OrganizationApplication from './OrganizationApplication'
import type { ActivityEntry, AdminView, OrganizationDecision, OrganizationRecord } from '../types'

type ManagementViewProps = {
  view: Exclude<AdminView, 'overview' | 'moderation' | 'farmer-approvals'>
  query: string
  onQueryChange: (query: string) => void
  onReset: () => void
  organizations?: OrganizationRecord[]
  activityEntries?: ActivityEntry[]
  decisions?: OrganizationDecision[]
  onOrganizationDecision?: (organizationId: string, decision: OrganizationDecision['decision'], reason: string) => void
}

const headings = {
  users: {
    title: 'User oversight',
    description: 'Search local demo accounts by name, email, role, or status.',
    filterLabel: 'Filter user status',
    options: ['Active', 'Needs verification', 'Restricted'],
  },
  organizations: {
    title: 'Organization reviews',
    description: 'Track submitted organizations and their review states.',
    filterLabel: 'Filter organization status',
    options: ['Pending review', 'Approved', 'Needs details', 'Rejected'],
  },
  security: {
    title: 'Security & access',
    description: 'Review recent demo access activity and security signals.',
    filterLabel: 'Filter severity',
    options: ['High', 'Medium', 'Low'],
  },
  activity: {
    title: 'Activity log',
    description: 'A chronological record of local demo platform activity.',
    filterLabel: 'Filter activity type',
    options: ['Organization', 'Moderation', 'Users', 'Security'],
  },
} satisfies Record<
  ManagementViewProps['view'],
  { title: string; description: string; filterLabel: string; options: string[] }
>

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="admin-empty-state">
      <div className="admin-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <h3>No demo records match this search.</h3>
      <p>Try another name, role, organization, or activity type.</p>
      <button type="button" onClick={onReset}>
        Reset filters
      </button>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function ManagementView({
  view,
  query,
  onQueryChange,
  onReset,
  organizations = demoOrganizations,
  activityEntries = demoActivityEntries,
  decisions = [],
  onOrganizationDecision = () => {},
}: ManagementViewProps) {
  const [filter, setFilter] = useState('all')
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null)
  const copy = headings[view]
  const selectedOrganization = organizations.find((item) => item.id === selectedOrganizationId)

  useEffect(() => {
    if (view === 'organizations' && selectedOrganizationId) {
      document.getElementById('organization-application-title')?.focus()
    }
  }, [selectedOrganizationId, view])
  const matchesFilter = (value: string) => filter === 'all' || value === filter

  const filteredUsers = users.filter(
    (user) =>
      matchesQuery(
        { title: user.name, subject: user.email, type: `${user.role} ${user.status}` },
        query
      ) && matchesFilter(user.status)
  )

  const filteredOrganizations = organizations.filter(
    (organization) =>
      matchesQuery(
        {
          title: organization.name,
          subject: organization.owner,
          type: `${organization.type} ${organization.status}`,
        },
        query
      ) && matchesFilter(organization.status)
  )

  const filteredSecurity = securityEvents.filter(
    (event) =>
      matchesQuery({ ...event, type: `${event.type} ${event.severity}` }, query) &&
      matchesFilter(event.severity)
  )

  const filteredActivity = activityEntries.filter(
    (entry) => matchesQuery(entry, query) && matchesFilter(entry.type)
  )

  function resetFilters() {
    setFilter('all')
    onReset()
  }

  const dropdownOptions = [
    { value: 'all', label: 'All statuses' },
    ...copy.options.map((opt) => ({ value: opt, label: opt })),
  ]

  const controls = (
    <div className="management-controls">
      <label className="admin-search">
        <span className="sr-only">Search {copy.title.toLocaleLowerCase()}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="4.75" />
          <path d="m12 12 4 4" />
        </svg>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={`Search ${copy.title.toLocaleLowerCase()}`}
        />
      </label>
      <div className="management-filter">
        <span className="sr-only">{copy.filterLabel}</span>
        <CustomDropdown
          variant="filter"
          ariaLabel={copy.filterLabel}
          value={filter}
          options={dropdownOptions}
          onChange={(val) => setFilter(val)}
        />
      </div>
      {(query || filter !== 'all') && (
        <button className="management-clear-btn" type="button" onClick={resetFilters}>
          Clear filters
        </button>
      )}
    </div>
  )

  return (
    <section className="management-panel" aria-label={copy.title}>
      <header className="management-header">
        {controls}
      </header>

      {view === 'users' &&
        (filteredUsers.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Demo users requiring administrator oversight</caption>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last active</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <th scope="row">
                      <div className="table-user-cell">
                        <span className="table-user-avatar" aria-hidden="true">
                          {getInitials(user.name)}
                        </span>
                        <div>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </th>
                    <td>
                      <span className={`user-role-badge role-${user.role.toLowerCase().replace(/\s+/g, '-')}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`record-status status-${user.status
                          .toLowerCase()
                          .replace(/\s+/g, '-')}`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="table-muted-date">{user.lastActive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyResults onReset={resetFilters} />
        ))}

      {view === 'organizations' &&
        (filteredOrganizations.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Demo organizations requiring administrator review</caption>
              <thead>
                <tr>
                  <th scope="col">Organization</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Type</th>
                  <th scope="col">Review state</th>
                  <th scope="col">Application</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrganizations.map((organization) => (
                  <tr key={organization.id}>
                    <th scope="row">
                      <div className="table-org-cell">
                        <span className="table-org-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M3 21h18M3 7v14M21 7v14M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3M9 21v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
                          </svg>
                        </span>
                        <div>
                          <strong>{organization.name}</strong>
                          <span>Submitted {organization.submitted}</span>
                        </div>
                      </div>
                    </th>
                    <td>
                      <span className="org-owner-name">{organization.owner}</span>
                    </td>
                    <td>
                      <span className="org-type-tag">{organization.type}</span>
                    </td>
                    <td>
                      <span
                        className={`record-status status-${organization.status
                          .toLowerCase()
                          .replace(/\s+/g, '-')}`}
                      >
                        {organization.status}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="organization-open" onClick={() => setSelectedOrganizationId(organization.id)}>
                        Review application
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyResults onReset={resetFilters} />
        ))}

      {view === 'organizations' && selectedOrganization && (
        <OrganizationApplication
          organization={selectedOrganization}
          decisions={decisions}
          onDecision={(decision, reason) => onOrganizationDecision(selectedOrganization.id, decision, reason)}
          onClose={() => setSelectedOrganizationId(null)}
        />
      )}

      {view === 'security' &&
        (filteredSecurity.length ? (
          <ul className="admin-event-list admin-security-list">
            {filteredSecurity.map((event) => (
              <li key={event.id} className="security-event-item">
                <span className={`severity severity-${event.severity.toLocaleLowerCase()}`}>
                  {event.severity}
                </span>
                <div className="admin-security-content">
                  <div className="admin-security-titleline">
                    <h3>{event.title}</h3>
                    <span className="security-time-tag">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 4.5V8l2.5 1.5" />
                      </svg>
                      {event.createdLabel}
                    </span>
                  </div>
                  <p className="admin-security-context">
                    <span className="security-subject">{event.subject}</span>
                    <span className="security-divider">·</span>
                    <span className="security-type-chip">{event.type}</span>
                  </p>
                  <p className="admin-security-description">{event.details}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyResults onReset={resetFilters} />
        ))}

      {view === 'activity' &&
        (filteredActivity.length ? (
          <div className="admin-table-wrap activity-table-wrap">
            <table className="admin-table activity-table">
              <caption className="sr-only">Recent administrative activity</caption>
              <thead>
                <tr>
                  <th scope="col">Activity</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Type</th>
                  <th scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivity.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row">
                      <span className="activity-table-title">{entry.title}</span>
                      {entry.details && <span className="activity-table-detail">Reason: {entry.details}</span>}
                    </th>
                    <td className="activity-table-subject">{entry.subject}</td>
                    <td><span className="activity-type" data-type={entry.type}>{entry.type}</span></td>
                    <td><time dateTime={entry.dateTime}>{entry.createdLabel}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyResults onReset={resetFilters} />
        ))}
    </section>
  )
}
