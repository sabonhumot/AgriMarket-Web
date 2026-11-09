import { navigateWeb } from '../auth/web-navigation'

export default function CreateEventLink() {
  const href = '/event-manager/events/new'
  return <a className="em-dashboard-create" href={href} onClick={(event) => navigateWeb(event, href)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Create event</a>
}
