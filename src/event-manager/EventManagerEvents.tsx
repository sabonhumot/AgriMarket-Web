import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import './EventManagerOperations.css'
import { navigateWeb } from '../auth/web-navigation'
import './EventManagerOverview.css'

type View = 'upcoming' | 'past' | 'drafts'
type EventRow = { id: string; name: string; type: string; date: string; endDate: string | null; time: string; location: string; description: string; status: string; approvedFarmers: number; farmerCount: number; pendingApplications: number; completedSalesValue: number }
type Props = { onSignOut?: () => void | Promise<void> }
let cachedEvents: EventRow[] | null = null
export function invalidateManagedEventsCache() { cachedEvents = null }
const views: { id: View; label: string }[] = [{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' }, { id: 'drafts', label: 'Drafts' }]
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
function mapEvent(value: unknown): EventRow {
  const row = record(value)
  return { id: String(row.id ?? row.market_event_id ?? ''), name: String(row.name ?? row.event_name ?? 'Market event'), type: String(row.type ?? row.event_type ?? row.category ?? 'Market event'), date: String(row.date ?? row.event_date ?? ''), endDate: row.end_date == null ? null : String(row.end_date), time: String(row.time ?? ''), location: String(row.location ?? row.venue_name ?? 'Venue to be announced'), description: String(row.description ?? ''), status: String(row.status ?? row.database_status ?? 'upcoming').toLowerCase(), approvedFarmers: count(row.approved_farmers), farmerCount: count(row.farmer_count ?? row.farmer_slots ?? row.expected_farmer_count ?? row.max_farmer_slots), pendingApplications: count(row.pending_applications), completedSalesValue: count(row.completed_sales_value) }
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
  return <article className="em-list-card"><div className="em-date-block"><strong>{formatDate(event.date, { day: '2-digit' })}</strong><span>{formatDate(event.date, { month: 'short' }).toUpperCase()}</span></div><div className="em-list-card-content"><div className="em-list-card-meta"><span className={`em-list-status em-list-status-${tone}`}>{label}</span><span>{event.type}</span></div><h2><a className="em-event-title-link" href={`/event-manager/events/${event.id}`} onClick={(click) => navigateWeb(click, `/event-manager/events/${event.id}`)}>{event.name}</a></h2><div className="em-list-facts"><span>{formatDate(event.date)}{event.endDate && event.endDate !== event.date ? ` – ${formatDate(event.endDate)}` : ''}</span><span>{event.time || 'Time to be announced'}</span><span>{event.location}</span></div>{event.description && <p className="em-list-description">{event.description}</p>}<div className="em-list-footer"><span><strong>{event.approvedFarmers}</strong> / {event.farmerCount} approved farmer slots</span>{event.pendingApplications > 0 && <span className="em-pending-pill">{event.pendingApplications} awaiting review</span>}{isPast(event) && event.status === 'completed' && <span>Sales value: ₱{event.completedSalesValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>}</div></div></article>
}
export default function EventManagerEvents({ onSignOut }: Props) {
  const [events, setEvents] = useState<EventRow[]>(cachedEvents ?? [])
  const [view, setView] = useState<View>('upcoming')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(cachedEvents === null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data, error: rpcError } = await getSupabaseClient().rpc('get_my_managed_events', { p_filter: 'all' })
      if (rpcError) throw rpcError
      const next = (Array.isArray(data) ? data : []).map(mapEvent).sort((a, b) => a.date.localeCompare(b.date))
      cachedEvents = next
      setEvents(next); setUpdatedAt(new Date())
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your event schedule could not be loaded.'); setEvents([]) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (cachedEvents) return; const timer = setTimeout(() => { void refresh() }, 0); return () => clearTimeout(timer) }, [refresh])
  useEffect(() => { const onChanged = () => { void refresh() }; window.addEventListener('event-manager-events-changed', onChanged); return () => window.removeEventListener('event-manager-events-changed', onChanged) }, [refresh])
  const counts = useMemo(() => ({ upcoming: events.filter((event) => !isDraft(event) && !isPast(event)).length, past: events.filter(isPast).length, drafts: events.filter(isDraft).length }), [events])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return events.filter((event) => {
      const matchesView = view === 'upcoming' ? !isDraft(event) && !isPast(event) : view === 'past' ? isPast(event) : isDraft(event)
      return matchesView && (!query || `${event.name} ${event.type} ${event.location}`.toLowerCase().includes(query))
    })
  }, [events, search, view])
  return <div className="em-shell"><EventManagerSidebar active="events" onSignOut={onSignOut} /><main className="em-main"><EventManagerTopbar current="Events" /><div className="em-content"><section className="em-heading em-events-heading"><div><h1 id="events-title">Market <em>Events</em></h1><p className="em-intro">Plan, promote, and manage every market day in one place.</p></div><div className="em-heading-actions"><a className="em-button-primary" href="/event-manager/events/new" onClick={(event) => navigateWeb(event, '/event-manager/events/new')}>＋ New event</a>{updatedAt && <span>Updated {updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}</span>}<button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh events'}</button></div></section><section className="em-events-toolbar" aria-label="Filter events"><div className="em-event-tabs" role="tablist" aria-label="Event status">{views.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} className={view === item.id ? 'is-active' : ''} onClick={() => setView(item.id)}>{item.label}<span>{counts[item.id]}</span></button>)}</div><label className="em-event-search"><span aria-hidden="true">⌕</span><span className="em-sr-only">Search events</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events or locations" /></label></section><div className="em-events-section-heading"><div><h2>{view === 'upcoming' ? 'Upcoming market days' : view === 'past' ? 'Past events' : 'Draft events'}</h2></div><span className="em-count">{loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`}</span></div>{error && <section className="em-error" role="alert"><div><strong>Events unavailable</strong><p>{error}</p></div><button type="button" onClick={() => void refresh()}>Try again</button></section>}{loading && events.length === 0 && !error && <div className="em-events-loading" role="status"><span /><span /><span /><span /><span className="em-sr-only">Loading your events</span></div>}{!loading && !error && filtered.length > 0 && <div className="em-events-list">{filtered.map((event) => <EventCard key={event.id} event={event} />)}</div>}{!loading && !error && filtered.length === 0 && <section className="em-events-empty"><div className="em-empty-calendar">▦</div><h2>{search ? 'No matching events' : view === 'upcoming' ? 'No upcoming events' : view === 'past' ? 'No event history yet' : 'No draft events'}</h2><p>{search ? 'Try another event name, type, or location.' : view === 'drafts' ? 'Saved drafts will appear here before they are published.' : 'Events in this view will appear here when they are available.'}</p>{search && <button type="button" onClick={() => setSearch('')}>Clear search</button>}</section>}</div></main></div>
}

