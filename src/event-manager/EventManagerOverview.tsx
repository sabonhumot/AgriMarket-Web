import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import CreateEventLink from './CreateEventLink'
import { navigateWeb } from '../auth/web-navigation'
import { loadEventManagerDashboard, type EventManagerDashboard, type OverviewEvent } from './dashboard-data'
import './EventManagerOverview.css'
import './EventManagerDashboard.css'

type IconName = 'grid' | 'calendar' | 'people' | 'check' | 'inbox' | 'bell' | 'refresh' | 'arrow' | 'pin' | 'clock'
const paths: Record<IconName, string> = {
  grid: 'M3 3h8v8H3z M13 3h8v8h-8z M3 13h8v8H3z M13 13h8v8h-8z',
  calendar: 'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h3 M8 18h6',
  people: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-2a7 7 0 0 1 14 0v2z M17 5a4 4 0 0 1 0 7 M18 15a6 6 0 0 1 4 6',
  check: 'M4 12l5 5L20 6',
  inbox: 'M4 4h16v12l-3 4H7l-3-4z M4 14h5l2 3h2l2-3h5',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9z M10 21h4',
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
  const coverUrl = prominent && event.coverPhotoPath ? getSupabaseClient().storage.from('event-manager-media').getPublicUrl(event.coverPhotoPath).data.publicUrl : null
  return <article className={`em-dashboard-event${prominent ? ' is-featured' : ''}${coverUrl ? ' has-cover' : ''}`}>
    {coverUrl && <img className="em-dashboard-event-cover" src={coverUrl} alt="" aria-hidden="true" onError={(error) => { error.currentTarget.style.visibility = 'hidden' }} />}
    <div className="em-dashboard-event-date"><strong>{day}</strong><span>{month}</span></div>
    <div className="em-dashboard-event-body">
      <div className="em-dashboard-event-meta"><span>{event.status === 'ongoing' || event.status === 'happening_now' ? 'Happening now' : 'Upcoming'}</span><span>Event #{event.id}</span></div>
      <h3>{event.name}</h3>
      <div className="em-dashboard-event-facts"><span><Icon name="calendar" size={16} />{dateLabel(event.date)}{event.endDate && event.endDate !== event.date ? ` - ${dateLabel(event.endDate)}` : ''}</span><span><Icon name="clock" size={16} />{event.time || 'Time to be announced'}</span><span><Icon name="pin" size={16} />{event.location}</span></div>
      <div className="em-dashboard-event-footer"><span><strong>{event.approvedFarmers}</strong> of {event.farmerCount} farmer slots approved</span>{event.pendingApplications > 0 && <span>{event.pendingApplications} awaiting review</span>}<a href={`/event-manager/events/${event.id}`} onClick={(click) => navigateWeb(click, `/event-manager/events/${event.id}`)}>View event <Icon name="arrow" size={16} /></a></div>
    </div>
  </article>
}

function OverviewMetric({ label, value, href }: { label: string; value: number; href: string }) {
  return <a className="em-dashboard-metric" href={href} onClick={(event) => navigateWeb(event, href)}>
    <strong>{value.toLocaleString('en-PH')}</strong><span>{label}</span><Icon name="arrow" size={16} />
  </a>
}

export default function EventManagerOverview({ onSignOut, initialData }: { onSignOut?: () => void | Promise<void>; initialData?: EventManagerDashboard }) {
  const [data, setData] = useState<EventManagerDashboard | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const refresh = useCallback(async (notify = false) => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadEventManagerDashboard(getSupabaseClient())
      setData(next)
      setUpdatedAt(new Date())
      if (notify) toast.success('Dashboard refreshed.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Your dashboard could not be loaded.'
      setError(message)
      toast.error('Dashboard could not be loaded.', { description: message })
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

    <main className="em-main em-dashboard">
      <EventManagerTopbar current="Dashboard" />
      <div className="em-content em-dashboard-content">
        <header className="em-dashboard-heading"><div><h1>Dashboard</h1><p>Upcoming markets, farmer participation, and what needs your attention.</p></div><div className="em-dashboard-actions"><CreateEventLink /><button type="button" onClick={() => void refresh(true)} disabled={loading} aria-label="Refresh dashboard" title={updatedAt ? `Updated ${updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}` : 'Refresh dashboard'}><Icon name="refresh" size={17} /></button></div></header>

        {error && <section className="em-dashboard-error" role="alert"><div><strong>Dashboard unavailable</strong><p>{error}</p></div><button type="button" onClick={() => void refresh(true)}>Try again</button></section>}
        {loading && !data && <div className="em-dashboard-loading" role="status"><div className="em-dashboard-loading-metrics">{[0, 1, 2, 3].map(n => <span key={n} />)}</div><div className="em-dashboard-loading-lead"><span /><span /></div><span className="em-sr-only">Loading dashboard</span></div>}

        {data && <>
          <section className="em-dashboard-stats" aria-label="Event statistics"><OverviewMetric label="Active and upcoming" value={data.activeCount} href="/event-manager/events" /><OverviewMetric label="Open farmer slots" value={openFarmerSlots} href="/event-manager/events" /><OverviewMetric label="Approved farmers" value={data.expectedFarmers} href="/event-manager/events" /><OverviewMetric label="Completed events" value={data.completedCount} href="/event-manager/events?view=past" /></section>

          <div className="em-dashboard-lead">
            <section className="em-dashboard-feature" aria-labelledby="em-next-title"><div className="em-dashboard-section-head"><h2 id="em-next-title">Next market day</h2><span>{upcomingEvents.length} scheduled</span></div>{nextEvent ? <EventCard event={nextEvent} prominent /> : <div className="em-dashboard-empty"><h3>No upcoming events</h3><p>New market days will appear here after you schedule an event.</p><a href="/event-manager/events" onClick={(event) => navigateWeb(event, '/event-manager/events')}>Browse events <Icon name="arrow" size={16} /></a></div>}</section>
            <section className="em-dashboard-attention" aria-labelledby="em-attention-title"><h2 id="em-attention-title">Needs your attention</h2><a href="/event-manager/events" onClick={(event) => navigateWeb(event, '/event-manager/events')}><span><Icon name="inbox" size={19} /></span><span><strong>Farmer applications</strong><small>{data.pendingApplications ? 'Waiting for review' : 'All caught up'}</small></span><b>{data.pendingApplications}</b></a><a href="/event-manager/notifications" onClick={(event) => navigateWeb(event, '/event-manager/notifications')}><span><Icon name="bell" size={19} /></span><span><strong>Notifications</strong><small>{data.unreadNotifications ? 'Unread updates' : 'No unread updates'}</small></span><b>{data.unreadNotifications}</b></a><p>{data.pendingApplications || data.unreadNotifications ? 'Review these updates to keep your market plans moving.' : 'You are up to date with applications and notifications.'}</p></section>
          </div>

          {upcomingEvents.length > 1 && <section className="em-dashboard-schedule" aria-labelledby="em-schedule-title"><div className="em-dashboard-section-head"><h2 id="em-schedule-title">Coming up after that</h2><a href="/event-manager/events" onClick={(event) => navigateWeb(event, '/event-manager/events')}>View all events <Icon name="arrow" size={16} /></a></div><div className="em-dashboard-schedule-list">{upcomingEvents.slice(1, 4).map(event => <EventCard key={event.id} event={event} />)}</div></section>}
        </>}
      </div>
    </main>
  </div>
}
