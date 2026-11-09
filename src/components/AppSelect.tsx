import { forwardRef, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './AppSelect.css'

export type SelectOption = { value: string; label: string }
type Props = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  label: string
  id?: string
  name?: string
  disabled?: boolean
  invalid?: boolean
  compact?: boolean
  className?: string
}

const AppSelect = forwardRef<HTMLButtonElement, Props>(function AppSelect({ value, options, onChange, label, id, name, disabled, invalid, compact, className = '' }, forwardedRef) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const position = () => {
      const bounds = trigger.current?.getBoundingClientRect()
      if (!bounds) return
      const spaceBelow = window.innerHeight - bounds.bottom - 12
      const spaceAbove = bounds.top - 12
      const above = spaceBelow < 180 && spaceAbove > spaceBelow
      const maxHeight = Math.min(260, Math.max(100, above ? spaceAbove : spaceBelow))
      setMenuPosition({ top: above ? bounds.top - Math.min(maxHeight, options.length * 37 + 10) - 5 : bounds.bottom + 5, left: Math.max(8, Math.min(bounds.left, window.innerWidth - Math.min(360, window.innerWidth - 16) - 8)), width: bounds.width, maxHeight })
    }
    position()
    document.addEventListener('pointerdown', onOutside)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    requestAnimationFrame(() => root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[selectedIndex]?.focus())
    return () => { document.removeEventListener('pointerdown', onOutside); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [open, selectedIndex, options.length])

  function choose(option: SelectOption) {
    onChange(option.value)
    setOpen(false)
    trigger.current?.focus()
  }

  function onKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return }
    if (!open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setOpen(true); return }
    if (!open) return
    const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || [])
    const current = buttons.findIndex((button) => button === document.activeElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
      buttons[next]?.focus()
    } else if (event.key === 'Tab') setOpen(false)
    else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const start = current < 0 ? 0 : current + 1
      const match = options.findIndex((option, index) => index >= start && option.label.toLowerCase().startsWith(event.key.toLowerCase()))
      const wrapped = match >= 0 ? match : options.findIndex((option) => option.label.toLowerCase().startsWith(event.key.toLowerCase()))
      if (wrapped >= 0) buttons[wrapped]?.focus()
    }
  }

  return <div ref={root} className={`app-select${compact ? ' app-select-compact' : ''}${open ? ' is-open' : ''} ${className}`} onKeyDown={onKeys}>
    <button ref={(node) => { trigger.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node }} id={id} type="button" className="app-select-trigger" disabled={disabled} aria-label={`${label}: ${selected?.label || 'not selected'}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-invalid={invalid || undefined} onClick={() => setOpen((current) => !current)}>
      <span className={!value ? 'app-select-placeholder' : ''}>{selected?.label || 'Choose an option'}</span><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
    </button>
    <select className="app-select-native" name={name} value={value} onChange={(event) => onChange(event.target.value)} tabIndex={-1} aria-hidden="true" hidden>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    {open && <div id={listId} className="app-select-menu" role="listbox" aria-label={label} style={menuPosition ? { position: 'fixed', top: menuPosition.top, left: menuPosition.left, minWidth: menuPosition.width, maxHeight: menuPosition.maxHeight } : undefined}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'is-selected' : ''} onClick={() => choose(option)}>{option.label}{option.value === value && <span aria-hidden="true">✓</span>}</button>)}</div>}
  </div>
})

export default AppSelect
