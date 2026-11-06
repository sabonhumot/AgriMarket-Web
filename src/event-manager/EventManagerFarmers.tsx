import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [selectedFarmer, setSelectedFarmer] = useState<ManagerFarmer | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const requestId = useRef(0)
  const hasSearched = useRef(false)
  const search = useCallback(async (text: string) => {
    const currentRequest = ++requestId.current
    hasSearched.current = true
    setLoading(true); setError(null)
    try {
      const results = await loadManagerFarmers(getSupabaseClient(), text)
      if (currentRequest === requestId.current) { setFarmers(results); setSubmittedQuery(text) }
    } catch (cause) {
      if (currentRequest === requestId.current) setError(cause instanceof Error ? cause.message : 'Farmer directory could not be loaded.')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (initialData && !hasSearched.current && !query.trim()) return
    const timer = setTimeout(() => { void search(query.trim()) }, query.trim() ? 250 : 0)
    return () => { clearTimeout(timer); requestId.current += 1 }
  }, [initialData, query, search])
  useEffect(() => {
    if (!selectedFarmer) return
    const dialog = dialogRef.current
    dialog?.showModal()
    dialog?.querySelector<HTMLButtonElement>('.em-farmer-modal-close')?.focus({ preventScroll: true })
    return () => {
      dialog?.close()
      previousFocus.current?.focus({ preventScroll: true })
    }
  }, [selectedFarmer])
  const openFarmer = (farmer: ManagerFarmer) => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedFarmer(farmer)
  }
  return <div className="em-shell"><EventManagerSidebar active="farmers" onSignOut={onSignOut} /><main className="em-main"><EventManagerTopbar current="Farmers" /><div className="em-content em-workspace-page">
    <div className="em-workspace-heading"><div><h1>Farmer directory</h1><p>Find verified farmers and open a card to review their farm details.</p></div></div>
    <div className="em-farmer-search"><label><span className="em-sr-only">Search farmers</span><input value={query} onChange={(event) => { hasSearched.current = true; setQuery(event.target.value); requestId.current += 1; setFarmers([]); setLoading(true) }} placeholder="Search by farmer, farm, barangay, or municipality" /></label>{loading && <span className="em-farmer-searching" role="status">Searching…</span>}{query && <button className="em-button-secondary" type="button" onClick={() => { hasSearched.current = true; setQuery(''); requestId.current += 1; setFarmers([]); setLoading(true) }}>Clear search</button>}</div>
    {error && <div className="em-operation-error" role="alert">{error} <button type="button" onClick={() => void search(submittedQuery)}>Try again</button></div>}
    {loading && farmers.length === 0 && !error ? <div className="em-workspace-loading" role="status">Loading verified farmers…</div> : !error && farmers.length === 0 ? <div className="em-workspace-empty"><strong>{submittedQuery ? 'No matching farmers' : 'No verified farmers yet'}</strong><p>{submittedQuery ? 'Try another name or location.' : 'Verified farmers will appear here when available.'}</p></div> :
      <><div className="em-farmer-results-head"><h2>Verified farmers</h2><span>{farmers.length} {farmers.length === 1 ? 'farmer' : 'farmers'}{submittedQuery ? ' matching “' + submittedQuery + '”' : ''}</span></div><div className="em-farmer-directory">{farmers.map((farmer) => <button className="em-farmer-card" type="button" key={farmer.id} onClick={() => openFarmer(farmer)} aria-label={`View details for ${farmer.name}`}><span className="em-farmer-card-top"><span className="em-farmer-avatar" aria-hidden="true">{farmer.name.charAt(0)}</span><span className="em-farmer-identity"><strong>{farmer.name}</strong><span>{farmer.farmName || 'Farm name not provided'}</span></span><span className="em-farmer-verified">Verified</span></span><span className="em-farmer-location">{[farmer.barangay, farmer.municipality].filter(Boolean).join(', ') || 'Location not provided'}</span><span className="em-farmer-card-stats"><span><strong>{farmer.activeListings}</strong> active listings</span><span><strong>{farmer.totalTransactions}</strong> completed transactions</span></span><span className="em-farmer-card-open">View farmer details <span aria-hidden="true">→</span></span></button>)}</div><p className="em-farmer-directory-note">To invite farmers, open an upcoming event and use its Invite farmers section. Eligibility is checked for that event.</p></>}
    {selectedFarmer && <dialog ref={dialogRef} className="em-farmer-modal" aria-labelledby="em-farmer-modal-title" onCancel={(event) => { event.preventDefault(); setSelectedFarmer(null) }} onClick={(event) => { if (event.target === event.currentTarget) setSelectedFarmer(null) }}><div className="em-farmer-modal-content"><header className="em-farmer-modal-header"><div className="em-farmer-modal-person"><span className="em-farmer-modal-avatar" aria-hidden="true">{selectedFarmer.name.charAt(0)}</span><div><h2 id="em-farmer-modal-title">{selectedFarmer.name}</h2><p>{selectedFarmer.farmName || 'Farm name not provided'}</p></div></div><button className="em-farmer-modal-close" type="button" aria-label="Close farmer details" onClick={() => setSelectedFarmer(null)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg></button></header><div className="em-farmer-modal-body"><span className="em-farmer-modal-status">Verified farmer</span><section><h3>Farm information</h3><dl><div><dt>Farm name</dt><dd>{selectedFarmer.farmName || 'Not provided'}</dd></div><div><dt>Barangay</dt><dd>{selectedFarmer.barangay || 'Not provided'}</dd></div><div><dt>Municipality</dt><dd>{selectedFarmer.municipality || 'Not provided'}</dd></div></dl></section><section><h3>Activity</h3><dl><div><dt>Active listings</dt><dd>{selectedFarmer.activeListings}</dd></div><div><dt>Completed transactions</dt><dd>{selectedFarmer.totalTransactions}</dd></div></dl></section><p className="em-farmer-modal-note">Open an upcoming event to check this farmer’s eligibility and send an invitation.</p></div></div></dialog>}
  </div></main></div>
}
