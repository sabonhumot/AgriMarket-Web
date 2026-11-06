import { useState } from 'react'
import type { AdminActivity, AdminReport } from '../admin-data'
import { activeEvents, registrationDays, type DashboardData } from '../dashboard-data'
import './DashboardOverview.css'

type Props = {
  data: DashboardData
  reports: AdminReport[]
  activity: AdminActivity[]
  onUsers: (role?: string) => void
  onEvents: () => void
  onReports: () => void
  onActivity: () => void
  onReport: (report: AdminReport) => void
}
const number = (value: number) => value.toLocaleString('en-PH')
const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
const roles = [{ key: 'buyer', label: 'Buyers' }, { key: 'farmer', label: 'Farmers' }, { key: 'coordinator', label: 'Event Managers' }, { key: 'admin', label: 'Admins' }, { key: 'cooperative', label: 'Cooperatives' }]
function Arrow() { return <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10h12m-5-5 5 5-5 5" /></svg> }
function activityLabel(action: string) {
  return action.replace(/[._]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function EmptyState({ title, children, ghost = false }: { title: string; children: string; ghost?: boolean }) {
  return <div className={`dashboard-empty-state${ghost ? ' is-ghost' : ''}`}>
    {ghost ? <svg className="dashboard-empty-ghost" viewBox="0 0 80 80" aria-hidden="true"><path d="M40 9c-15.5 0-27 11.8-27 27v28.5c0 3.2 3.7 4.8 6 2.4l6.3-6.2 8.1 6.4a4 4 0 0 0 5.1 0l8.1-6.4 8.1 6.4a4 4 0 0 0 5.1 0l8.1-6.4 6.3 6.2c2.3 2.4 6 .8 6-2.4V36C67 20.8 55.5 9 40 9Z" /><ellipse cx="31" cy="38" rx="3" ry="4" /><ellipse cx="49" cy="38" rx="3" ry="4" /><path d="M36 49c2.4 2.7 5.6 2.7 8 0" /></svg> : <span className="dashboard-empty-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16M7 8h10M9 16h6" /><circle cx="12" cy="12" r="9" /></svg></span>}
    <div><strong>{title}</strong><p>{children}</p></div>
  </div>
}

export default function DashboardOverview({ data, reports, activity, onUsers, onEvents, onReports, onActivity, onReport }: Props) {
  const [period, setPeriod] = useState(30)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const now = new Date(data.refreshedAt).getTime()
  const events = activeEvents(data.events, now).sort((a, b) => a.event_date.localeCompare(b.event_date))
  const days = registrationDays(data.users, period, now)
  const registrations = days.reduce((sum, day) => sum + day.count, 0)
  const ceiling = Math.max(4, Math.ceil(Math.max(...days.map(day => day.count)) / 4) * 4)
  const selected = days.find(day => day.date === selectedDay)
  const active = data.users.filter(user => user.user_status === 'active').length
  const openReports = reports.filter(report => !['resolved', 'closed', 'dismissed'].includes(report.status.toLowerCase()))

  return <div className="dashboard-overview">
    <div className="dashboard-metrics" aria-label="Platform statistics">
      <button className="dashboard-metric" onClick={() => onUsers()}><span>Total users <Arrow /></span><strong>{number(data.totalUsers)}</strong><small>{number(active)} active accounts</small></button>
      <button className="dashboard-metric" onClick={onEvents}><span>Active events <Arrow /></span><strong>{number(events.length)}</strong><small>Published · upcoming or ongoing</small></button>
      <button className="dashboard-metric" onClick={onReports}><span>Reports awaiting review <Arrow /></span><strong>{number(data.openReports)}</strong><small>Open and unresolved cases</small></button>
    </div>

    <div className="dashboard-statistics">
      <section className="dashboard-panel dashboard-growth" aria-labelledby="growth-title">
        <div className="dashboard-panel-heading"><div><h2 id="growth-title">User registrations</h2><p>How your community is growing</p></div><div className="dashboard-period" aria-label="Registration period">{[7, 30, 90].map(value => <button key={value} aria-pressed={period === value} onClick={() => { setPeriod(value); setSelectedDay(null) }}>{value} days</button>)}</div></div>
        <div className="dashboard-chart-summary"><strong>{number(registrations)}</strong><span>new accounts in the last {period} days</span></div>
        <div className="dashboard-chart-readout" aria-live="polite">{selected ? `${dateLabel(`${selected.date}T12:00:00+08:00`)} · ${number(selected.count)} ${selected.count === 1 ? 'registration' : 'registrations'}` : 'Daily registrations · Philippine time'}</div>
        {registrations > 0 ? <><div className="dashboard-chart" role="group" aria-label={`Daily registrations over ${period} days`}>
          <div className="dashboard-chart-axis" aria-hidden="true">{[ceiling, ceiling * .75, ceiling * .5, ceiling * .25, 0].map(value => <span key={value}>{number(value)}</span>)}</div>
          <div className="dashboard-chart-plot"><div className="dashboard-chart-grid" aria-hidden="true">{[0, 1, 2, 3, 4].map(value => <i key={value} />)}</div><div className="dashboard-chart-bars">{days.map(day => <button key={day.date} className={`dashboard-chart-day${selectedDay === day.date ? ' is-selected' : ''}`} aria-label={`${day.date}: ${day.count} registrations`} aria-pressed={selectedDay === day.date} onMouseEnter={() => setSelectedDay(day.date)} onFocus={() => setSelectedDay(day.date)} onClick={() => setSelectedDay(day.date)}><span style={{ height: `${day.count / ceiling * 100}%` }} /></button>)}</div></div>
        </div>
        <div className="dashboard-chart-dates"><span>{dateLabel(`${days[0].date}T12:00:00+08:00`)}</span><span>{dateLabel(`${days[Math.floor(days.length / 2)].date}T12:00:00+08:00`)}</span><span>Today</span></div></> : <div className="dashboard-chart-empty"><EmptyState title="No new registrations yet">New accounts created in this period will appear here.</EmptyState></div>}
      </section>
      <section className="dashboard-panel dashboard-roles" aria-labelledby="roles-title"><div className="dashboard-panel-heading"><div><h2 id="roles-title">Users by role</h2><p>All registered accounts</p></div></div><div className="dashboard-role-list">{data.totalUsers === 0 ? <EmptyState title="No users to display">Role totals will appear after accounts are registered.</EmptyState> : roles.map(role => {
        const count = data.users.filter(user => user.role === role.key).length
        if (role.key === 'cooperative' && count === 0) return null
        const percentage = data.totalUsers ? count / data.totalUsers * 100 : 0
        return <button className="dashboard-role" key={role.key} onClick={() => onUsers(role.key)}><span className="dashboard-role-label"><span>{role.label}</span><strong>{number(count)} <small>{percentage.toFixed(0)}%</small></strong></span><span className="dashboard-role-track" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></span></button>
      })}</div><button className="dashboard-text-link" onClick={() => onUsers()}>View all users <Arrow /></button></section>
    </div>

    <div className="dashboard-operations">
      <section className="dashboard-panel" aria-labelledby="reports-title"><div className="dashboard-panel-heading"><div><h2 id="reports-title">Reports to review</h2><p>Reservation issues needing a decision</p></div><button className="dashboard-text-link" onClick={onReports}>View all <Arrow /></button></div><div className="dashboard-record-list">{openReports.slice(0, 4).map(report => <button className="dashboard-record" key={report.id} onClick={() => onReport(report)}><span><strong>{report.reason}</strong><small>{report.reporter} · {report.subject}</small></span><span className="dashboard-record-meta">{dateLabel(report.createdAt)}<Arrow /></span></button>)}{!openReports.length && <EmptyState title="All caught up" ghost>New reservation reports that need review will appear here.</EmptyState>}</div></section>
      <section className="dashboard-panel" aria-labelledby="dashboard-events"><div className="dashboard-panel-heading"><div><h2 id="dashboard-events" tabIndex={-1}>Active market events</h2><p>Published events that are upcoming or ongoing</p></div><span className="dashboard-count">{events.length}</span></div><div className="dashboard-event-list">{events.slice(0, 5).map(event => <div className="dashboard-event" key={event.market_event_id}><time dateTime={event.event_date}>{dateLabel(`${event.event_date}T12:00:00+08:00`)}</time><div><strong>{event.event_name}</strong><small>{event.location || 'Location not recorded'}</small></div><span className="dashboard-event-status">{new Date(`${event.event_date}T00:00:00+08:00`).getTime() > now ? 'Upcoming' : 'Ongoing'}</span></div>)}{!events.length && <EmptyState title="No active events">Published upcoming or ongoing events will appear here.</EmptyState>}</div>{events.length > 5 && <p className="dashboard-footnote">Showing the next 5 of {events.length} active events.</p>}</section>
    </div>
    <section className="dashboard-activity" aria-labelledby="activity-title"><div className="dashboard-panel-heading"><h2 id="activity-title">Recent Admin Activity</h2><button className="dashboard-text-link" onClick={onActivity}>View all activity logs <Arrow /></button></div>{activity.length ? activity.slice(0, 3).map(entry => <div className="dashboard-activity-row" key={entry.id}><strong>{activityLabel(entry.action)}</strong><span>{entry.actor}</span><time dateTime={entry.createdAt}>{dateLabel(entry.createdAt)}</time></div>) : <EmptyState title="No activity recorded yet">Administrative actions will be listed here as they happen.</EmptyState>}</section>
  </div>
}
