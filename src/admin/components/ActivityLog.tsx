import { useState } from 'react'
import AppSelect from '../../components/AppSelect'
import type { AdminActivity } from '../admin-data'
import AdminUserAvatar from './AdminUserAvatar'
import './ActivityLog.css'

const dayKey = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'unknown' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
const humanize = (value: string) => value.replace(/[._]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const stamp = (value: string) => Number.isNaN(Date.parse(value)) ? 'Time not recorded' : new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })

export default function ActivityLog({ entries, onOpen }: { entries: AdminActivity[]; onOpen: (entry: AdminActivity) => void }) {
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const types = Array.from(new Set(entries.map(entry => entry.entityType))).sort((a, b) => humanize(a).localeCompare(humanize(b)))
  const selectedType = typeFilter === 'all' || types.includes(typeFilter) ? typeFilter : 'all'
  const search = query.trim().toLocaleLowerCase()
  const filtered = entries.filter(entry => (selectedType === 'all' || entry.entityType === selectedType) && (!search || [entry.action, entry.actor, entry.entityType, String(entry.id), entry.entityId == null ? '' : String(entry.entityId)].some(value => value.toLocaleLowerCase().includes(search))))
  const hasFilters = Boolean(search || selectedType !== 'all')
  const size = 25
  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * size, (current + 1) * size)
  const latest = entries[0]?.createdAt
  const clearFilters = () => { setQuery(''); setTypeFilter('all'); setPage(0) }
  const [{ today, yesterday }] = useState(() => {
    const now = new Date()
    return { today: dayKey(now.toISOString()), yesterday: dayKey(new Date(now.getTime() - 86400000).toISOString()) }
  })
  const groups = visible.reduce<Array<{ key: string; label: string; entries: AdminActivity[] }>>((result, entry) => {
    const key = dayKey(entry.createdAt)
    let group = result.find(item => item.key === key)
    if (!group) {
      const label = key === today ? 'Today' : key === yesterday ? 'Yesterday' : key === 'unknown' ? 'Unknown date' : new Date(`${key}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
      group = { key, label, entries: [] }
      result.push(group)
    }
    group.entries.push(entry)
    return result
  }, [])
  return <section className="activity-log" aria-label="System activity log">
    <div className="activity-log-tools">
      <div className="activity-log-context">
        <div><strong>{filtered.length.toLocaleString('en-PH')} {filtered.length === 1 ? 'entry' : 'entries'}</strong><span>{hasFilters ? ` matching your filters, ${entries.length.toLocaleString('en-PH')} total` : ' recorded across the workspace'}</span></div>
        <p>{latest ? <>Latest recorded <time dateTime={latest}>{stamp(latest)}</time></> : 'New actions will appear as they are recorded.'}</p>
      </div>
      <div className="activity-log-controls">
        <div className="activity-log-search-field"><label htmlFor="activity-log-search">Search activity</label><div className="activity-log-search"><svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg><input id="activity-log-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Action, actor, or ID" />{query && <button type="button" onClick={() => { setQuery(''); setPage(0) }} aria-label="Clear activity search">Clear</button>}</div></div>
        <div className="activity-log-type-field"><label htmlFor="activity-log-type">Record type</label><AppSelect id="activity-log-type" label="Record type" value={selectedType} options={[{ value: 'all', label: 'All record types' }, ...types.map(type => ({ value: type, label: humanize(type) }))]} onChange={value => { setTypeFilter(value); setPage(0) }} /></div>
      </div>
    </div>
    {groups.length ? <div className="activity-log-groups">{groups.map(group => <section className="activity-day" key={group.key} aria-labelledby={`activity-day-${group.key}`}><h3 id={`activity-day-${group.key}`}>{group.label}<span>{group.entries.length}</span></h3><ol>{group.entries.map(entry => <li key={entry.id}><div className="activity-entry"><AdminUserAvatar name={entry.actor} role={entry.actorRole ?? 'system'} photoUrl={entry.actorPhotoUrl} className="activity-actor-avatar" /><div className="activity-entry-content"><p className="activity-action"><strong>{humanize(entry.action)}</strong><span>by {entry.actor}</span></p><div className="activity-entry-meta"><span className="activity-target">{humanize(entry.entityType)}{entry.entityId == null ? '' : ` · #${entry.entityId}`}</span><time dateTime={entry.createdAt}>{stamp(entry.createdAt)}</time></div></div><button type="button" className="activity-inspect" aria-label={`Inspect ${humanize(entry.action)} by ${entry.actor}`} onClick={() => onOpen(entry)}><span>Details</span><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 10h12m-4-4 4 4-4 4" /></svg></button></div></li>)}</ol></section>)}</div> : <div className="activity-empty"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4v5h5M4.5 9a8 8 0 1 1-.2 6M12 8v4l3 2" /></svg></span><h3>{hasFilters ? 'No matching activity' : 'No activity recorded yet'}</h3><p>{hasFilters ? 'Try another action, actor, ID, or record type.' : 'Admin and system actions will appear here as they are recorded.'}</p>{hasFilters && <button type="button" className="activity-clear-filters" onClick={clearFilters}>Clear filters</button>}</div>}
    <footer className="activity-pagination" aria-label="Activity log pagination">
      <span>{filtered.length ? `${current * size + 1}–${Math.min((current + 1) * size, filtered.length)} of ${filtered.length} entries` : '0 entries'}</span>
      <div>
        <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
        <span className="activity-page-number" aria-live="polite">Page {current + 1} of {pages}</span>
        <button type="button" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</button>
      </div>
    </footer>
  </section>
}
