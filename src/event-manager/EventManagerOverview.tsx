import { useCallback, useEffect, useState } from 'react'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import { navigateWeb } from '../auth/web-navigation'
import { loadEventManagerDashboard, type EventManagerDashboard, type OverviewEvent } from './dashboard-data'
import './EventManagerOverview.css'

type IconName = 'grid' | 'calendar' | 'people' | 'check' | 'inbox' | 'refresh' | 'arrow' | 'pin' | 'clock'
const paths: Record<IconName, string> = {
  grid: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h3 M8 18h6',
  people: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-2a7 7 0 0 1 14 0v2z M17 5a4 4 0 0 1 0 7 M18 15a6 6 0 0 1 4 6',
  check: 'M4 12l5 5L20 6',
  inbox: 'M4 4h16v12l-3 4H7l-3-4z M4 14h5l2 3h2l2-3h5',
  refresh: 'M20 11a8 8 0 1 0-2 6 M20 4v7h-7',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  pin: 'M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z M12 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const date = new Date(`${value}T12:00:00+08:00`)
  return Number.isNaN(date.getTime()) ? 'Date to be announced' : date.toLocaleDateString('en-PH', { ...options, timeZone: 'Asia/Manila' })
}

function todayInManila() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function isCurrentOrUpcoming(event: OverviewEvent, today: string) {
  if (['draft', 'completed', 'cancelled'].includes(event.status.toLowerCase())) return false
  const lastDay = event.endDate || event.date
  return /^\d{4}-\d{2}-\d{2}$/.test(lastDay) && lastDay >= today
}

function EventCard({ event, prominent = false }: { event: OverviewEvent; prominent?: boolean }) {
  const date = new Date(`${event.date}T12:00:00+08:00`)
  const day = Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { day: '2-digit', timeZone: 'Asia/Manila' })
  const month = Number.isNaN(date.getTime()) ? 'DATE' : date.toLocaleDateString('en-PH', { month: 'short', timeZone: 'Asia/Manila' }).toUpperCase()
  return <article className={`em-event${prominent ? ' em-event-prominent' : ''}`}>
    <div className="em-date-block"><strong>{day}</strong><span>{month}</span></div>
    <div className="em-event-body">
      <div className="em-event-top"><span className="em-status">{event.status === 'ongoing' || event.status === 'happening_now' ? 'Happening now' : 'Upcoming'}</span><span className="em-event-id">Event #{event.id}</span></div>
      <h3>{event.name}</h3>
      <div className="em-event-facts"><span><Icon name="calendar" size={16} />{dateLabel(event.date)}{event.endDate && event.endDate !== event.date ? ` – ${dateLabel(event.endDate)}` : ''}</span><span><Icon name="clock" size={16} />{event.time || 'Time to be announced'}</span><span><Icon name="pin" size={16} />{event.location}</span></div>
      <div className="em-event-bottom"><span><Icon name="people" size={17} /> <strong>{event.approvedFarmers}</strong> of {event.farmerCount} farmer slots approved</span>{event.pendingApplications > 0 && <span className="em-pending-pill">{event.pendingApplications} awaiting review</span>}</div>
      <a className="em-overview-event-link" href={`/event-manager/events/${event.id}`} onClick={(click) => navigateWeb(click, `/event-manager/events/${event.id}`)}>Open event <Icon name="arrow" size={15} /></a>
    </div>
  </article>
}

function OverviewMetric({ label, value, hint, href }: { label: string; value: number; hint: string; href: string }) {
  return <a className="em-metric em-metric-link" href={href} onClick={(event) => navigateWeb(event, href)}>
    <span className="em-metric-label">{label} <Icon name="arrow" size={15} /></span>
    <strong>{value.toLocaleString('en-PH')}</strong><small>{hint}</small>
  </a>
}

export default function EventManagerOverview({ onSignOut, initialData }: { onSignOut?: () => void | Promise<void>; initialData?: EventManagerDashboard }) {
  const [data, setData] = useState<EventManagerDashboard | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadEventManagerDashboard(getSupabaseClient())
      setData(next)
      setUpdatedAt(new Date())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your event overview could not be loaded.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialData) return
    const timer = setTimeout(() => { void refresh() }, 0)
    return () => clearTimeout(timer)
  }, [initialData, refresh])

  const today = todayInManila()
  const upcomingEvents = (data?.events ?? []).filter((event) => isCurrentOrUpcoming(event, today)).sort((a, b) => a.date.localeCompare(b.date))
  const nextEvent = upcomingEvents[0]
  const openFarmerSlots = upcomingEvents.reduce((total, event) => total + Math.max(0, event.farmerCount - event.approvedFarmers), 0)
  return <div className="em-shell">
    <EventManagerSidebar active="overview" organizationName={data?.organizationName} onSignOut={onSignOut} />

    <main className="em-main">
      <EventManagerTopbar current="Overview" />
      <div className="em-content">
        <section className="em-heading" aria-labelledby="em-title"><div><h1 id="em-title">Overview</h1><p className="em-intro">Market activity and the next items that need your attention.</p></div><div className="em-heading-actions">{updatedAt && <span>Updated {updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}</span>}<button type="button" onClick={() => void refresh()} disabled={loading}><Icon name="refresh" size={17} />{loading ? 'Refreshing…' : 'Refresh overview'}</button></div></section>

        {error && <section className="em-error" role="alert"><div><strong>Overview unavailable</strong><p>{error}</p></div><button type="button" onClick={() => void refresh()}>Try again <Icon name="arrow" size={16} /></button></section>}
        {loading && !data && <div className="em-loading" role="status"><div className="em-loading-metrics">{[0, 1, 2, 3].map(n => <span key={n} />)}</div><div className="em-loading-panel" /><span className="em-sr-only">Loading event overview</span></div>}

        {data && <>
          <section className="em-metrics" aria-label="Event statistics">
            <OverviewMetric label="Active & upcoming" value={data.activeCount} hint="Browse managed events" href="/event-manager/events" />
            <OverviewMetric label="Open farmer slots" value={openFarmerSlots} hint="Across upcoming events" href="/event-manager/events" />
            <OverviewMetric label="Unread notifications" value={data.unreadNotifications} hint="View recent updates" href="/event-manager/notifications" />
            <OverviewMetric label="Completed events" value={data.completedCount} hint="Browse event history" href="/event-manager/events?view=past" />
          </section>

          <div className="em-overview-grid"><section className="em-panel em-next" aria-labelledby="em-next-title"><div className="em-panel-head"><h2 id="em-next-title">Your next market day</h2>{nextEvent && <span className="em-count">{upcomingEvents.length} scheduled</span>}</div>{nextEvent ? <EventCard event={nextEvent} prominent /> : <div className="em-empty"><span className="em-empty-icon"><Icon name="calendar" size={26} /></span><h3>No active events yet</h3><p>Upcoming market events will appear here when they are scheduled.</p></div>}</section><section className="em-panel em-activity" aria-labelledby="em-activity-title"><div className="em-panel-head"><h2 id="em-activity-title">What needs attention</h2></div><div className="em-attention-row"><span className="em-attention-icon"><Icon name="inbox" size={20} /></span><div><strong>Farmer applications</strong><p>{data.pendingApplications ? `${data.pendingApplications} awaiting your review` : 'All caught up for now'}</p></div><strong className="em-attention-value">{data.pendingApplications}</strong></div><div className="em-attention-row"><span className="em-attention-icon em-attention-green"><Icon name="people" size={20} /></span><div><strong>Approved farmers</strong><p>Across your active market events</p></div><strong className="em-attention-value">{data.expectedFarmers}</strong></div></section></div>

          {upcomingEvents.length > 1 && <section className="em-panel em-schedule" aria-labelledby="em-schedule-title"><div className="em-panel-head"><h2 id="em-schedule-title">More upcoming events</h2><span className="em-count">{upcomingEvents.length - 1} more</span></div><div className="em-schedule-list">{upcomingEvents.slice(1, 4).map(event => <EventCard key={event.id} event={event} />)}</div></section>}
        </>}
      </div>
    </main>
  </div>
}
