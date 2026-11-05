import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabaseClient } from '../admin/supabase'
import EventManagerSidebar from './EventManagerSidebar'
import EventManagerTopbar from './EventManagerTopbar'
import { loadManagerFarmers, type ManagerFarmer } from './manager-service'
import './EventManagerOperations.css'
import './EventManagerWorkspace.css'

export default function EventManagerFarmers({ onSignOut, initialData }: { onSignOut?: () => void | Promise<void>; initialData?: ManagerFarmer[] }) {
  const [farmers, setFarmers] = useState<ManagerFarmer[]>(initialData ?? [])
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const search = useCallback(async (text: string) => {
    setLoading(true); setError(null)
    try { setFarmers(await loadManagerFarmers(getSupabaseClient(), text)); setSubmittedQuery(text) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Farmer directory could not be loaded.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { if (initialData) return; const timer = setTimeout(() => { void search('') }, 0); return () => clearTimeout(timer) }, [initialData, search])
  function submit(event: FormEvent) { event.preventDefault(); void search(query.trim()) }
  return <div className="em-shell"><EventManagerSidebar active="farmers" onSignOut={onSignOut} /><main className="em-main"><EventManagerTopbar current="Farmers" /><div className="em-content em-workspace-page">
    <div className="em-workspace-heading"><div><h1>Farmer directory</h1><p>Find verified farmers and review their farm summary before inviting them to an event.</p></div></div>
    <form className="em-farmer-search" onSubmit={submit}><label><span className="em-sr-only">Search farmers</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by farmer, farm, barangay, or municipality" /></label><button className="em-button-primary" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search farmers'}</button>{submittedQuery && <button className="em-button-secondary" type="button" onClick={() => { setQuery(''); void search('') }}>Clear search</button>}</form>
    {error && <div className="em-operation-error" role="alert">{error} <button type="button" onClick={() => void search(submittedQuery)}>Try again</button></div>}
    {loading && farmers.length === 0 && !error ? <div className="em-workspace-loading" role="status">Loading verified farmers…</div> : !error && farmers.length === 0 ? <div className="em-workspace-empty"><strong>{submittedQuery ? 'No matching farmers' : 'No verified farmers yet'}</strong><p>{submittedQuery ? 'Try another name or location.' : 'Verified farmers will appear here when available.'}</p></div> :
      <><div className="em-farmer-results-head"><h2>Verified farmers</h2><span>{farmers.length} {farmers.length === 1 ? 'farmer' : 'farmers'}{submittedQuery ? ' matching “' + submittedQuery + '”' : ''}</span></div><div className="em-farmer-directory">{farmers.map((farmer) => <article className="em-farmer-card" key={farmer.id}><div className="em-farmer-card-top"><span className="em-farmer-avatar" aria-hidden="true">{farmer.name.charAt(0)}</span><div className="em-farmer-identity"><h3>{farmer.name}</h3><p>{farmer.farmName || 'Farm name not provided'}</p></div><span className="em-farmer-verified">Verified</span></div><div className="em-farmer-location">{[farmer.barangay, farmer.municipality].filter(Boolean).join(', ') || 'Location not provided'}</div><div className="em-farmer-card-stats"><span><strong>{farmer.activeListings}</strong> active listings</span><span><strong>{farmer.totalTransactions}</strong> completed transactions</span></div></article>)}</div><p className="em-farmer-directory-note">To invite farmers, open an upcoming event and use its Invite farmers section. Eligibility is checked for that event.</p></>}
  </div></main></div>
}
