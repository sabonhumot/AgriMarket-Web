import { useState } from 'react'
import type { AdminActivity } from '../admin-data'
import './ActivityLog.css'

const dayKey = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'unknown' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
const humanize = (value: string) => value.replace(/[._]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const stamp = (value: string) => Number.isNaN(Date.parse(value)) ? 'Time not recorded' : new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
const initials = (value: string) => value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'

export default function ActivityLog({ entries, onOpen }: { entries: AdminActivity[]; onOpen: (entry: AdminActivity) => void }) {
  const [page, setPage] = useState(0)
  const size = 25
  const pages = Math.max(1, Math.ceil(entries.length / size))
  const current = Math.min(page, pages - 1)
  const visible = entries.slice(current * size, (current + 1) * size)
  const today = dayKey(new Date().toISOString())
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString())
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
    {groups.length ? <div className="activity-log-groups">{groups.map(group => <section className="activity-day" key={group.key} aria-labelledby={`activity-day-${group.key}`}><h3 id={`activity-day-${group.key}`}>{group.label}<span>{group.entries.length}</span></h3><ol>{group.entries.map(entry => <li key={entry.id}><div className="activity-entry"><span className="activity-actor-avatar" aria-hidden="true">{initials(entry.actor)}</span><div className="activity-entry-content"><p className="activity-action"><strong>{humanize(entry.action)}</strong><span>by {entry.actor}</span></p><div className="activity-entry-meta"><span className="activity-target">{humanize(entry.entityType)}{entry.entityId == null ? '' : ` · #${entry.entityId}`}</span><time dateTime={entry.createdAt}>{stamp(entry.createdAt)}</time></div></div><button type="button" className="activity-inspect" aria-label={`Inspect ${humanize(entry.action)} by ${entry.actor}`} onClick={() => onOpen(entry)}><span>Details</span><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 10h12m-4-4 4 4-4 4" /></svg></button></div></li>)}</ol></section>)}</div> : <div className="activity-empty"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4v5h5M4.5 9a8 8 0 1 1-.2 6M12 8v4l3 2" /></svg></span><h3>No activity found</h3><p>{entries.length ? 'Try a different search term.' : 'Admin and system actions will appear here as they are recorded.'}</p></div>}
    <footer className="activity-pagination" aria-label="Activity log pagination">
      <span>{entries.length ? `${current * size + 1}–${Math.min((current + 1) * size, entries.length)} of ${entries.length} events` : '0 events'}</span>
      <div>
        <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
        <span className="activity-page-number" aria-live="polite">Page {current + 1} of {pages}</span>
        <button type="button" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</button>
      </div>
    </footer>
  </section>
}
