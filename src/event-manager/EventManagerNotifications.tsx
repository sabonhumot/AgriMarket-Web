import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import { loadManagerNotifications, markAllManagerNotificationsRead, markManagerNotificationRead, type ManagerNotification } from './manager-service'
import './EventManagerOperations.css'
import './EventManagerWorkspace.css'
import './EventManagerDashboard.css'
import './EventManagerNotificationsPage.css'

const eventPath = (item: ManagerNotification) => item.referenceId && ['market_event', 'event'].includes(item.referenceType ?? '') ? '/event-manager/events/' + item.referenceId : null
const dateLabel = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
export default function EventManagerNotifications({ onSignOut, initialData }: { onSignOut?: () => void | Promise<void>; initialData?: ManagerNotification[] }) {
  const [items, setItems] = useState<ManagerNotification[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | 'all' | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const refresh = useCallback(async (notify = false) => {
    setLoading(true); setError(null)
    try { setItems(await loadManagerNotifications(getSupabaseClient())); if (notify) toast.success('Notifications refreshed.') }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Notifications could not be loaded.'; setError(message); toast.error('Notifications could not be loaded.', { description: message }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (initialData) return; const timer = setTimeout(() => { void refresh() }, 0); return () => clearTimeout(timer) }, [initialData, refresh])
  const unread = useMemo(() => items.filter((item) => !item.isRead).length, [items])
  const visible = filter === 'unread' ? items.filter((item) => !item.isRead) : items
  async function markOne(id: number) {
    if (busyId !== null) return false
    setBusyId(id); setError(null)
    try { await markManagerNotificationRead(getSupabaseClient(), id); setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item)); toast.success('Notification marked as read.'); return true }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'The notification could not be marked read.'; setError(message); toast.error('Could not mark notification as read.', { description: message }); return false }
    finally { setBusyId(null) }
  }
  async function markAll() {
    if (busyId !== null || unread === 0) return
    setBusyId('all'); setError(null)
    try { await markAllManagerNotificationsRead(getSupabaseClient()); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); toast.success('All notifications marked as read.') }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Notifications could not be marked read.'; setError(message); toast.error('Could not mark notifications as read.', { description: message }) }
    finally { setBusyId(null) }
  }
  async function openEvent(click: MouseEvent<HTMLAnchorElement>, item: ManagerNotification, path: string) {
    click.preventDefault()
    if (!item.isRead && !(await markOne(item.id))) return
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return <div className="em-shell em-notifications-shell"><EventManagerSidebar active="notifications" onSignOut={onSignOut} /><main className="em-main em-dashboard em-notifications-page"><EventManagerTopbar current="Notifications" /><div className="em-content em-dashboard-content">
    <header className="em-dashboard-heading"><div><h1>Notifications</h1><p>Updates about your market events and farmer participation.</p></div><div className="em-dashboard-actions"><button type="button" disabled={loading || busyId !== null} onClick={() => void refresh(true)} aria-label="Refresh notifications" title="Refresh notifications"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7" /></svg></button></div></header>
    <section className="em-notifications-panel" aria-label="Notification inbox"><div className="em-notifications-panel-head"><div><h2>Your updates</h2><p>{loading ? 'Checking for updates…' : unread ? `${unread} unread ${unread === 1 ? 'notification' : 'notifications'}` : 'You’re all caught up'}</p></div><button type="button" className="em-notifications-mark-all" disabled={busyId !== null || unread === 0} onClick={() => void markAll()}>{busyId === 'all' ? 'Marking…' : 'Mark all as read'}</button></div>
    <div className="em-notification-toolbar"><div className="em-workspace-tabs" role="group" aria-label="Filter notifications"><button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All <span>{items.length}</span></button><button type="button" aria-pressed={filter === 'unread'} className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>Unread <span>{unread}</span></button></div></div>
    {error && <div className="em-operation-error" role="alert">{error} <button type="button" onClick={() => void refresh(true)}>Try again</button></div>}
    {loading && items.length === 0 && !error ? <div className="em-notifications-loading" role="status" aria-label="Loading notifications"><span /><span /><span /></div> : visible.length === 0 && !error ? <div className="em-notifications-empty"><span className="em-notifications-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></svg></span><strong>{filter === 'unread' ? 'All caught up' : 'No notifications yet'}</strong><p>{filter === 'unread' ? 'You have no unread updates.' : 'Event updates will appear here when they arrive.'}</p></div> :
      <div className="em-notification-list">{visible.map((item) => {
        const path = eventPath(item)
        return <article className={'em-notification-row' + (item.isRead ? '' : ' is-unread')} key={item.id}><span className="em-notification-dot" aria-label={item.isRead ? 'Read' : 'Unread'} /><div className="em-notification-content"><div><strong>{item.title}{!item.isRead && <span className="em-notification-unread-label">Unread</span>}</strong><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></div><p>{item.body}</p><div className="em-notification-actions">{path && <a href={path} onClick={(click) => void openEvent(click, item, path)}>Open event <span aria-hidden="true">→</span></a>}{!item.isRead && <button type="button" disabled={busyId !== null} onClick={() => void markOne(item.id)}>{busyId === item.id ? 'Marking…' : 'Mark as read'}</button>}</div></div></article>
      })}</div>}
    </section>
  </div></main></div>
}
