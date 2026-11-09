import { useState } from 'react'
import type { AdminUser } from '../admin-data'
import type { DashboardEvent } from '../dashboard-data'
import AppSelect from '../../components/AppSelect'
import './UsersDirectory.css'
import './EventsDirectory.css'

const statuses = ['all', 'published', 'draft', 'completed', 'cancelled']
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const dateLabel = (value: string) => {
  const date = new Date(`${value}T12:00:00+08:00`)
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })
}
const timeLabel = (value: string | null) => {
  if (!value) return null
  const date = new Date(`1970-01-01T${value}+08:00`)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
}

function schedule(event: DashboardEvent) {
  const dates = event.end_date && event.end_date !== event.event_date ? `${dateLabel(event.event_date)} – ${dateLabel(event.end_date)}` : dateLabel(event.event_date)
  const start = timeLabel(event.start_time)
  const end = timeLabel(event.end_time)
  return { dates, times: start && end ? `${start} – ${end}` : start || end || 'Time not recorded' }
}

export default function EventsDirectory({ events, users, onOpen }: { events: DashboardEvent[]; users: AdminUser[]; onOpen: (event: DashboardEvent, managerName: string) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)
  const people = new Map(users.map(user => [user.id, user.name]))
  const tabs = [...statuses, ...Array.from(new Set(events.map(event => event.status))).filter(value => !statuses.includes(value))]
  const search = query.trim().toLowerCase()
  const filtered = events.filter(event => {
    const manager = event.coordinator_user_id == null ? '' : people.get(event.coordinator_user_id) || `User #${event.coordinator_user_id}`
    return (status === 'all' || event.status === status) && (!search || [event.event_name, event.event_type, event.description, event.location, event.venue_name, event.status, manager, String(event.market_event_id)].some(value => value?.toLowerCase().includes(search)))
  }).sort((a, b) => sort === 'oldest' ? a.market_event_id - b.market_event_id : b.market_event_id - a.market_event_id)
  const pages = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, pages - 1)
  const rows = filtered.slice(currentPage * 20, (currentPage + 1) * 20)
  const hasFilters = Boolean(query || status !== 'all')
  function clear() { setQuery(''); setStatus('all'); setPage(0) }

  return <section className="events-directory" aria-label="All market events">
    <div className="users-role-tabs" aria-label="Filter events by status">{tabs.map(value => <button key={value} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0) }}>{value === 'all' ? 'All events' : label(value)}<span>{events.filter(event => value === 'all' || event.status === value).length.toLocaleString('en-PH')}</span></button>)}</div>
    <div className="users-directory-tools">
      <div className="users-search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" aria-label="Search events" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Search events, locations, or managers…" /></div>
      <div className="users-select"><span>Sort</span><AppSelect compact label="Sort" value={sort} onChange={value => { setSort(value); setPage(0) }} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} /></div>
    </div>
    <div className="users-results"><p role="status"><strong>{filtered.length.toLocaleString('en-PH')}</strong> {filtered.length === 1 ? 'event' : 'events'}{hasFilters ? ' matching your filters' : ' in this directory'}</p>{hasFilters && <button type="button" onClick={clear}>Clear filters</button>}</div>
    {rows.length ? <div className="events-table-scroll" role="region" aria-label="Market events" tabIndex={0}><table className="events-table"><thead><tr><th scope="col">Event ID</th><th scope="col">Event</th><th scope="col">Schedule</th><th scope="col">Location</th><th scope="col">Event Manager</th><th scope="col">Status</th><th scope="col"><span className="admin-sr-only">Event details</span></th></tr></thead><tbody>{rows.map(event => {
      const when = schedule(event)
      const managerName = event.coordinator_user_id == null ? 'Not assigned' : people.get(event.coordinator_user_id) || `User #${event.coordinator_user_id}`
      return <tr key={event.market_event_id}><td className="events-id" data-label="Event ID">#{event.market_event_id}</td><td data-label="Event"><strong>{event.event_name}</strong>{event.event_type && <small>{label(event.event_type)}</small>}{event.description && <p>{event.description}</p>}</td><td data-label="Schedule"><time dateTime={event.event_date}>{when.dates}</time><small>{when.times}</small></td><td data-label="Location">{event.venue_name || event.location || 'Not recorded'}{event.venue_name && event.location && event.venue_name !== event.location && <small>{event.location}</small>}</td><td data-label="Event Manager">{managerName}</td><td data-label="Status"><span className={`events-status events-status-${event.status}`}><i aria-hidden="true" />{label(event.status)}</span></td><td className="events-row-action"><button className="users-view" type="button" aria-label={`View ${event.event_name} details`} onClick={() => onOpen(event, managerName)}>View event<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4" /></svg></button></td></tr>
    })}</tbody></table></div> : <div className="events-empty"><h2>{events.length ? 'No events match your filters' : 'No market events yet'}</h2><p>{events.length ? 'Try a different search or status.' : 'Market events will appear here when they are created.'}</p></div>}
    <footer className="events-pagination"><span>{filtered.length ? `${currentPage * 20 + 1}–${Math.min((currentPage + 1) * 20, filtered.length)} of ${filtered.length}` : '0 events'}</span><div><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">Previous</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)} aria-label="Next page">Next</button></div></footer>
  </section>
}
