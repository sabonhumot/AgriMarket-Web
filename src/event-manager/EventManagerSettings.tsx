import AccountSettings from '../components/AccountSettings'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import './EventManagerWorkspace.css'

export default function EventManagerSettings({ onSignOut }: { onSignOut?: () => void | Promise<void> }) {
  return <div className="em-shell">
    <EventManagerSidebar active="settings" onSignOut={onSignOut} />
    <main className="em-main">
      <EventManagerTopbar current="Settings" />
      <div className="em-content em-workspace-page">
        <header className="em-workspace-heading"><div><h1>Settings</h1><p>Review your account and update your password.</p></div></header>
        <AccountSettings role="event_manager" />
      </div>
    </main>
  </div>
}
