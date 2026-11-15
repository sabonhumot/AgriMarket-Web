import { navigateWeb } from '../auth/web-navigation'

type Props = { current: string; parent?: string; parentHref?: string }

export default function EventManagerTopbar({ current, parent = 'Event Manager', parentHref }: Props) {
  return <header className="em-topbar">
    <div className="em-breadcrumb">
      {parentHref ? <a href={parentHref} onClick={(event) => navigateWeb(event, parentHref)}>{parent}</a> : <span>{parent}</span>}
      <span aria-hidden="true">/</span><strong>{current}</strong>
    </div>
  </header>
}
