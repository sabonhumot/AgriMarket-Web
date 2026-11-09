import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import CreateEventLink from './CreateEventLink'
import './EventManagerOperations.css'
import { navigateWeb } from '../auth/web-navigation'
import './EventManagerOverview.css'
import './EventManagerDashboard.css'
import './EventManagerEventsPage.css'
import { managedEventsCache, type ManagedEventRow } from './managed-events-cache'

type View = 'upcoming' | 'past' | 'drafts'
type EventRow = ManagedEventRow
type Props = { onSignOut?: () => void | Promise<void> }
const views: { id: View; label: string }[] = [{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }, { id: 'drafts', label: 'Drafts' }]
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
function mapEvent(value: unknown): EventRow {
  const row = record(value)
  return { id: String(row.id ?? row.market_event_id ?? ''), name: String(row.name ?? row.event_name ?? 'Market event'), type: String(row.type ?? row.event_type ?? row.category ?? 'Market event'), date: String(row.date ?? row.event_date ?? ''), endDate: row.end_date == null ? null : String(row.end_date), time: String(row.time ?? ''), location: String(row.location ?? row.venue_name ?? 'Venue to be announced'), description: String(row.description ?? ''), status: String(row.database_status ?? row.status ?? 'upcoming').toLowerCase(), approvedFarmers: count(row.approved_farmers), farmerCount: count(row.farmer_count ?? row.farmer_slots ?? row.expected_farmer_count ?? row.max_farmer_slots), pendingApplications: count(row.pending_applications), completedSalesValue: count(row.completed_sales_value) }
}
function isDraft(event: EventRow) { return event.status === 'draft' }
function isPast(event: EventRow) {
  if (event.status === 'completed' || event.status === 'cancelled') return true
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const lastDate = event.endDate || event.date
  return Boolean(lastDate && lastDate < today && event.status !== 'draft')
}
function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const date = new Date(`${value}T12:00:00+08:00`)
  return Number.isNaN(date.getTime()) ? 'Date to be announced' : date.toLocaleDateString('en-PH', { ...options, timeZone: 'Asia/Manila' })
}
function eventStatus(event: EventRow) {
  if (isDraft(event)) return ['Draft', 'draft']
  if (event.status === 'cancelled') return ['Cancelled', 'cancelled']
  if (event.status === 'completed') return ['Completed', 'completed']
  if (event.status === 'ongoing' || event.status === 'happening_now') return ['Happening now', 'happening']
  return ['Upcoming', 'upcoming']
}
function EventCard({ event }: { event: EventRow }) {
  const [label, tone] = eventStatus(event)
  const draft = isDraft(event)
  const href = draft ? `/event-manager/events/${event.id}/edit` : `/event-manager/events/${event.id}`
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(event.date) && !Number.isNaN(Date.parse(`${event.date}T12:00:00+08:00`))
  return <article className={`em-events-card${draft ? ' is-draft' : ''}`}>
    <div className={`em-events-card-date${hasDate ? '' : ' is-undated'}`}><strong>{hasDate ? formatDate(event.date, { day: '2-digit' }) : 'TBD'}</strong><span>{hasDate ? formatDate(event.date, { month: 'short' }).toUpperCase() : 'DATE'}</span></div>
    <div className="em-events-card-body">
      <div className="em-events-card-meta"><span className={`em-list-status em-list-status-${tone}`}>{label}</span><span>{event.type}</span><span>Event #{event.id}</span></div>
      <h3><a href={href} onClick={(click) => navigateWeb(click, href)}>{event.name}</a></h3>
      <div className="em-events-card-facts"><span>{formatDate(event.date)}{event.endDate && event.endDate !== event.date ? ` - ${formatDate(event.endDate)}` : ''}</span><span>{event.time || 'Time to be announced'}</span><span>{event.location}</span></div>
      {event.description && <p className="em-events-card-description">{event.description}</p>}
      <div className="em-events-card-footer">{draft ? <span>Unpublished. Only you can see this draft.</span> : <><span><strong>{event.approvedFarmers}</strong> of {event.farmerCount} farmer slots approved</span>{event.pendingApplications > 0 && <span className="em-events-card-pending">{event.pendingApplications} awaiting review</span>}{isPast(event) && event.status === 'completed' && <span>Sales value: ₱{event.completedSalesValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>}</>}<a href={href} onClick={(click) => navigateWeb(click, href)}>{draft ? 'Edit draft' : 'View event'}</a></div>
    </div>
  </article>
}
export default function EventManagerEvents({ onSignOut }: Props) {
  const [events, setEvents] = useState<EventRow[]>(managedEventsCache.current ?? [])
  const [view, setView] = useState<View>(() => {
    const requested = new URLSearchParams(window.location.search).get('view')
    return requested === 'past' || requested === 'drafts' ? requested : 'upcoming'
  })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(managedEventsCache.current === null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const refresh = useCallback(async (notify = false) => {
    setLoading(true); setError(null)
    try {
      const { data, error: rpcError } = await getSupabaseClient().rpc('get_my_managed_events', { p_filter: 'all' })
      if (rpcError) throw rpcError
      const next = (Array.isArray(data) ? data : []).map(mapEvent).sort((a, b) => a.date.localeCompare(b.date))
      managedEventsCache.current = next
      setEvents(next); setUpdatedAt(new Date())
      if (notify) toast.success('Events refreshed.')
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Your event schedule could not be loaded.'; setError(message); setEvents([]); toast.error('Events could not be loaded.', { description: message }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { const timer = setTimeout(() => { void refresh() }, 0); return () => clearTimeout(timer) }, [refresh])
  useEffect(() => { const onChanged = () => { void refresh() }; window.addEventListener('event-manager-events-changed', onChanged); return () => window.removeEventListener('event-manager-events-changed', onChanged) }, [refresh])
  const counts = useMemo(() => ({ upcoming: events.filter((event) => !isDraft(event) && !isPast(event)).length, past: events.filter(isPast).length, drafts: events.filter(isDraft).length }), [events])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return events.filter((event) => {
      const matchesView = view === 'upcoming' ? !isDraft(event) && !isPast(event) : view === 'past' ? isPast(event) : isDraft(event)
      return matchesView && (!query || `${event.name} ${event.type} ${event.location}`.toLowerCase().includes(query))
    })
  }, [events, search, view])
  return <div className="em-shell"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main em-dashboard em-events-page"><EventManagerTopbar current="Events" /><div className="em-content em-dashboard-content">
    <header className="em-dashboard-heading"><div><h1 id="events-title">Events</h1><p>Plan and manage every market day from one place.</p></div><div className="em-dashboard-actions"><CreateEventLink /><button type="button" onClick={() => void refresh(true)} disabled={loading} aria-label="Refresh events" title={updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}` : 'Refresh events'}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7" /></svg></button></div></header>
    <section className="em-events-controls" aria-label="Filter events"><div className="em-events-filters" role="group" aria-label="Event status">{views.map((item) => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}<span>{counts[item.id]}</span></button>)}</div><label className="em-events-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.75" /><path d="m16 16 4 4" /></svg><span className="em-sr-only">Search events</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events or locations" /></label></section>
    <div className="em-events-list-heading"><h2>{view === 'upcoming' ? 'Upcoming market days' : view === 'past' ? 'Past events' : 'Draft events'}</h2><span>{loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`}</span></div>
    {error && <section className="em-dashboard-error" role="alert"><div><strong>Events unavailable</strong><p>{error}</p></div><button type="button" onClick={() => void refresh(true)}>Try again</button></section>}
    {loading && events.length === 0 && !error && <div className="em-events-page-loading" role="status">{[0, 1, 2].map(n => <span key={n} />)}<span className="em-sr-only">Loading your events</span></div>}
    {!error && filtered.length > 0 && <div className="em-events-page-list" aria-busy={loading}>{filtered.map((event) => <EventCard key={event.id} event={event} />)}</div>}
    {!loading && !error && filtered.length === 0 && <section className="em-events-page-empty"><h3>{search ? 'No matching events' : view === 'upcoming' ? 'No upcoming events' : view === 'past' ? 'No event history yet' : 'No draft events'}</h3><p>{search ? 'Try another event name, type, or location.' : view === 'drafts' ? 'Saved drafts will appear here before they are published.' : 'Events in this view will appear here when they are available.'}</p>{search && <button type="button" onClick={() => setSearch('')}>Clear search</button>}</section>}
  </div></main></div>
}

