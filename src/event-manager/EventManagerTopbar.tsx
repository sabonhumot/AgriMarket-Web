import { navigateWeb } from '../auth/web-navigation'

type Props = { current: string; parent?: string; parentHref?: string }

export default function EventManagerTopbar({ current, parent = 'Event Manager', parentHref }: Props) {
  return <header className="em-topbar">
    <div className="em-breadcrumb">
      {parentHref ? <a href={parentHref} onClick={(event) => navigateWeb(event, parentHref)}>{parent}</a> : <span>{parent}</span>}
      <span aria-hidden="true">/</span><strong>{current}</strong>
    </div>
    <a className="em-public-link" href="/" target="_blank" rel="noopener noreferrer">
      Public site <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 5h6v6M19 5l-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>
    </a>
  </header>
}
