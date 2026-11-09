import { useState } from 'react'
import './AdminUserAvatar.css'

const initials = (name: string) => name.trim().split(/\s+/).map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'

export default function AdminUserAvatar({ name, role, photoUrl, large = false, className = '' }: { name: string; role: string; photoUrl?: string | null; large?: boolean; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const image = photoUrl && failedUrl !== photoUrl ? photoUrl : null
  return <span className={`admin-user-avatar admin-user-avatar-${role.toLowerCase()}${large ? ' is-large' : ''}${className ? ` ${className}` : ''}`} aria-hidden="true">
    {image ? <img src={image} alt="" onError={() => setFailedUrl(image)} /> : initials(name)}
  </span>
}
