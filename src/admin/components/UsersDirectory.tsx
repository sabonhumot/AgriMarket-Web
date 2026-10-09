import { useState } from 'react'
import type { AdminUser } from '../admin-data'
import './UsersDirectory.css'

type Props = { users: AdminUser[]; totalUsers?: number; query: string; role: string; status: string; onQuery: (value: string) => void; onRole: (value: string) => void; onStatus: (value: string) => void; onOpen: (user: AdminUser) => void }
const roles = [{ value: 'all', label: 'All users' }, { value: 'buyer', label: 'Buyers' }, { value: 'farmer', label: 'Farmers' }, { value: 'coordinator', label: 'Event Managers' }, { value: 'admin', label: 'Admins' }, { value: 'cooperative', label: 'Cooperatives' }]
const statuses = [{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'pending_verification', label: 'Pending verification' }, { value: 'suspended', label: 'Suspended' }, { value: 'deactivated', label: 'Deactivated' }]
const initials = (name: string) => name.trim().split(/\s+/).map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
const roleLabel = (role: string) => ({ buyer: 'Buyer', farmer: 'Farmer', coordinator: 'Event Manager', admin: 'Admin', cooperative: 'Cooperative' })[role.toLowerCase()] || role
const dateLabel = (value: string) => Number.isNaN(Date.parse(value)) ? 'Not recorded' : new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })

export default function UsersDirectory({ users, totalUsers, query, role, status, onQuery, onRole, onStatus, onOpen }: Props) {
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)
  const search = query.trim().toLowerCase()
  const filtered = users.filter(user => (role === 'all' || user.role.toLowerCase() === role) && (status === 'all' || user.status.toLowerCase() === status) && (!search || [user.name, user.email, roleLabel(user.role), user.status.replaceAll('_', ' '), String(user.id)].some(value => value.toLowerCase().includes(search))))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))
  const pages = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, pages - 1)
  const rows = filtered.slice(currentPage * 20, (currentPage + 1) * 20)
  const hasFilters = Boolean(query || role !== 'all' || status !== 'all')
  function clear() { onQuery(''); onRole('all'); onStatus('all'); setPage(0) }
  return <section className="users-directory" aria-label="User directory">
    <div className="users-role-tabs" aria-label="Filter by account role">{roles.filter(item => item.value !== 'cooperative' || users.some(user => user.role === 'cooperative')).map(item => <button key={item.value} type="button" aria-pressed={role === item.value} onClick={() => { onRole(item.value); setPage(0) }}>{item.label}<span>{users.filter(user => item.value === 'all' || user.role.toLowerCase() === item.value).length.toLocaleString('en-PH')}</span></button>)}</div>
    <div className="users-directory-tools">
      <div className="users-search"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" aria-label="Search users" placeholder="Search name, email, or user ID…" value={query} onChange={event => { onQuery(event.target.value); setPage(0) }} /></div>
      <label className="users-select"><span>Status</span><select value={status} onChange={event => { onStatus(event.target.value); setPage(0) }}>{statuses.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="users-select"><span>Sort</span><select value={sort} onChange={event => { setSort(event.target.value); setPage(0) }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label>
    </div>
    <div className="users-results"><p role="status"><strong>{filtered.length.toLocaleString('en-PH')}</strong> {filtered.length === 1 ? 'account' : 'accounts'}{hasFilters ? ' matching your filters' : ' in this directory'}</p>{hasFilters && <button type="button" onClick={clear}>Clear filters</button>}</div>
    {rows.length ? <div className="users-table-scroll" role="region" aria-label="User accounts" tabIndex={0}><table className="users-table"><thead><tr><th scope="col" className="users-id-column">ID</th><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col"><span className="admin-sr-only">Account details</span></th></tr></thead><tbody>{rows.map(user => <tr key={user.id}><td className="users-id-column">#{user.id}</td><td><div className="users-identity"><span className="users-avatar" aria-hidden="true">{initials(user.name)}</span><div><button className="users-name" type="button" onClick={() => onOpen(user)}>{user.name}</button><span className="users-email">{user.email || 'No email recorded'}</span></div></div></td><td><span className="users-role-label">{roleLabel(user.role)}</span></td><td><span className={`users-status users-status-${user.status.toLowerCase()}`}><i aria-hidden="true" />{statuses.find(item => item.value === user.status.toLowerCase())?.label || user.status}</span></td><td><time dateTime={user.createdAt}>{dateLabel(user.createdAt)}</time></td><td><button className="users-view" type="button" aria-label={`View ${user.name}'s account`} onClick={() => onOpen(user)}>View<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10h12m-4-4 4 4-4 4" /></svg></button></td></tr>)}</tbody></table></div> : <div className="users-empty"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="10" cy="8" r="4" /><path d="M3 21v-2a7 7 0 0 1 10-6m2 3 6 6m0-6-6 6" /></svg><h2>{hasFilters ? 'No accounts match your filters' : 'No registered users yet'}</h2><p>{hasFilters ? 'Try another name, email, role, or account status.' : 'Registered accounts will appear here automatically.'}</p>{hasFilters && <button type="button" onClick={clear}>Clear filters</button>}</div>}
    <footer className="users-pagination"><span>{filtered.length ? `${currentPage * 20 + 1}–${Math.min((currentPage + 1) * 20, filtered.length)} of ${filtered.length} accounts` : '0 accounts'}</span><div><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous page">Previous</button><span aria-live="polite">Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)} aria-label="Next page">Next</button></div></footer>
    {totalUsers !== undefined && totalUsers > users.length && <p className="users-limit-note">Showing {users.length.toLocaleString('en-PH')} loaded accounts of {totalUsers.toLocaleString('en-PH')} registered users. Filters apply to loaded accounts.</p>}
  </section>
}

