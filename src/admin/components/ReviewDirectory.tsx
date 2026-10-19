import { useState } from 'react'
import type { AdminReport } from '../admin-data'
import './UsersDirectory.css'
import './ReviewDirectory.css'

type RecordRow = { id: string; title: string; description: string | null; person: string; otherPerson?: string; kind?: string; status: string; date: string; warningCount?: number; onOpen: () => void }
type StatusTab = { value: string; label: string; matches: (row: RecordRow) => boolean }
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const dateLabel = (value: string) => Number.isNaN(Date.parse(value)) ? 'Not recorded' : new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
const closed = new Set(['resolved', 'closed', 'dismissed'])
function Arrow() { return <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4" /></svg> }
function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const tone = ['approved', 'resolved', 'closed', 'verified'].includes(normalized) ? 'success' : ['rejected', 'dismissed', 'cancelled'].includes(normalized) ? 'neutral' : 'pending'
  return <span className={`users-status review-status-${tone}`}><i aria-hidden="true" />{humanize(value)}</span>
}

function ReviewDirectory({ mode, rows }: { mode: 'applications' | 'reports'; rows: RecordRow[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [kind, setKind] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)
  const isReports = mode === 'reports'
  const tabs: StatusTab[] = [{ value: 'all', label: isReports ? 'All reports' : 'All applications', matches: () => true }]
  if (isReports) tabs.push({ value: 'needs-action', label: 'Needs review', matches: row => !closed.has(row.status.toLowerCase()) })
  if (isReports) tabs.push({ value: 'suspension-review', label: 'Suspension review', matches: row => (row.warningCount ?? 0) >= 4 })
  const tabValues = isReports ? ['resolved', 'dismissed', ...(rows.some(row => row.status.toLowerCase() === 'closed') ? ['closed'] : [])] : Array.from(new Set(['pending', 'approved', 'rejected', ...rows.map(row => row.status.toLowerCase())]))
  tabValues.forEach(value => tabs.push({ value, label: humanize(value), matches: row => row.status.toLowerCase() === value }))
  const selectedTab = tabs.find(tab => tab.value === status) ?? tabs[0]
  const search = query.trim().toLowerCase()
  const filtered = rows.filter(row => selectedTab.matches(row) && (kind === 'all' || row.kind === kind) && (!search || [row.id, row.title, row.description, row.person, row.otherPerson, row.kind, row.status].some(value => value?.toLowerCase().includes(search))))
    .sort((a, b) => sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))
  const pages = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, pages - 1)
  const visible = filtered.slice(currentPage * 20, (currentPage + 1) * 20)
  const hasFilters = Boolean(query || status !== 'all' || kind !== 'all')
  function clear() { setQuery(''); setStatus('all'); setKind('all'); setPage(0) }
  return <section className="users-directory review-directory" aria-label={isReports ? 'Reservation report directory' : 'Application directory'}>
    <div className="users-role-tabs" aria-label={`Filter ${mode} by status`}>{tabs.map(tab => <button key={tab.value} type="button" aria-pressed={selectedTab.value === tab.value} onClick={() => { setStatus(tab.value); setPage(0) }}>{tab.label}<span>{rows.filter(tab.matches).length.toLocaleString('en-PH')}</span></button>)}</div>
    <div className="users-directory-tools"><div className="users-search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" aria-label={`Search ${mode}`} placeholder={isReports ? 'Search reports, people, or case ID…' : 'Search applications, applicants, or ID…'} value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} /></div>
      {!isReports && <label className="users-select"><span>Type</span><select value={kind} onChange={event => { setKind(event.target.value); setPage(0) }}><option value="all">All types</option><option value="Farmer verification">Farmer verification</option><option value="Event application">Event application</option></select></label>}
      <label className="users-select"><span>Sort</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(0) }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
    </div>
    <div className="users-results"><p role="status"><strong>{filtered.length.toLocaleString('en-PH')}</strong> {filtered.length === 1 ? (isReports ? 'report' : 'application') : mode}{hasFilters ? ' matching your filters' : ' in this directory'}</p>{hasFilters && <button type="button" onClick={clear}>Clear filters</button>}</div>
    {visible.length ? <div className="users-table-scroll" role="region" aria-label={isReports ? 'Reservation reports' : 'Applications'} tabIndex={0}><table className="users-table review-table"><thead><tr><th scope="col">{isReports ? 'Report' : 'Application'}</th><th scope="col">{isReports ? 'People involved' : 'Applicant'}</th><th scope="col">Status</th><th scope="col">{isReports ? 'Filed' : 'Submitted'}</th><th scope="col"><span className="admin-sr-only">Details</span></th></tr></thead><tbody>{visible.map(row => <tr key={row.id}>
      <td><div className="review-record-title"><span className={`review-record-icon${isReports ? ' is-report' : ''}`} aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6">{isReports ? <><path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z" /><path d="M12 8v5m0 3v.1" /></> : <><path d="M7 3h8l4 4v14H5V3zm7 0v5h5M8 12h8m-8 4h6" /></>}</svg></span><div><button type="button" className="users-name" onClick={row.onOpen}>{row.title}</button><span className="review-record-subtitle">{isReports ? `Case #${row.id}` : row.kind}</span>{isReports && (row.warningCount ?? 0) >= 4 && <span className="review-warning-flag">Suspension review needed</span>}{isReports && row.description && <p className="review-description">{row.description}</p>}</div></div></td>
      <td>{isReports ? <div className="review-participants"><div><span>Reporter</span><strong>{row.person}</strong></div><div><span>Reported</span><strong>{row.otherPerson}</strong></div></div> : <span className="review-applicant">{row.person}</span>}</td>
      <td><Status value={row.status} /></td><td><time dateTime={row.date || undefined}>{dateLabel(row.date)}</time>{!isReports && <span className="users-account-id">{row.id}</span>}</td><td><button className="users-view" type="button" aria-label={`${isReports ? 'View report' : 'View application'} ${row.id}: ${row.title}`} onClick={row.onOpen}>View<Arrow /></button></td>
    </tr>)}</tbody></table></div> : <div className="users-empty"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 3h8l4 4v14H5V3zm7 0v5h5M8 12h8m-8 4h6" /></svg><h2>{hasFilters ? `No ${mode} match your filters` : `No ${mode} yet`}</h2><p>{hasFilters ? 'Try another search or status, or clear your filters.' : isReports ? 'Reservation reports will appear here when submitted.' : 'Submitted applications will appear here automatically.'}</p>{hasFilters && <button type="button" onClick={clear}>Clear filters</button>}</div>}
    <footer className="users-pagination"><span>{filtered.length ? `${currentPage * 20 + 1}–${Math.min((currentPage + 1) * 20, filtered.length)} of ${filtered.length} ${mode}` : `0 ${mode}`}</span><div><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">Previous</button><span aria-live="polite">Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)} aria-label="Next page">Next</button></div></footer>
  </section>
}

export function ReportsDirectory({ reports, onOpen }: { reports: AdminReport[]; onOpen: (item: AdminReport) => void }) {
  return <ReviewDirectory mode="reports" rows={reports.map(item => ({ id: String(item.id), title: item.reason, description: item.description, person: item.reporter, otherPerson: item.subject, status: item.status, date: item.createdAt, warningCount: item.buyerWarningCount, onOpen: () => onOpen(item) }))} />
}
