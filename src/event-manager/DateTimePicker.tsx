import { useEffect, useId, useRef, useState } from 'react'
import AppSelect from '../components/AppSelect'
import './DateTimePicker.css'

type Mode = 'date' | 'time' | 'datetime'

type Props = {
  name: string
  label: string
  mode: Mode
  value: string
  onChange: (value: string) => void
  minDate?: string
  maxDate?: string
  invalid?: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')
const dateParts = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? { year, month, day } : null
}
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`
const monthLabel = (year: number, month: number) => new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
const displayDate = (value: string) => {
  const parts = dateParts(value)
  return parts ? new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day))) : ''
}
const displayTime = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return ''
  const hour = Number(match[1]); const minute = Number(match[2])
  if (hour > 23 || minute > 59) return ''
  return `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`
}
const parseTime = (value: string) => {
  const match = /^(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(AM|PM)$/i.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)
  return `${pad(hour)}:${match[2] || '00'}`
}
const todayInManila = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export default function DateTimePicker({ name, label, mode, value, onChange, minDate, maxDate, invalid }: Props) {
  const [open, setOpen] = useState(false)
  const [typedTime, setTypedTime] = useState(() => displayTime(mode === 'datetime' ? value.slice(11, 16) : value))
  const [timeError, setTimeError] = useState(false)
  const [view, setView] = useState(() => {
    const date = dateParts(value.slice(0, 10)) || dateParts(minDate || '') || dateParts(todayInManila())!
    return { year: date.year, month: date.month }
  })
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  const hasDate = mode !== 'time'
  const hasTime = mode !== 'date'
  const selectedDate = hasDate ? value.slice(0, 10) : ''
  const selectedTime = mode === 'datetime' ? value.slice(11, 16) : mode === 'time' ? value : ''
  const time = /^(\d{2}):(\d{2})$/.test(selectedTime) ? selectedTime : '09:00'
  const [hour, minute] = time.split(':').map(Number)
  const hour12 = hour % 12 || 12
  const period = hour < 12 ? 'AM' : 'PM'

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  const changeMonth = (delta: number) => {
    const next = new Date(Date.UTC(view.year, view.month - 1 + delta, 1))
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 })
  }
  const setDate = (date: string) => {
    onChange(mode === 'datetime' ? `${date}T${selectedTime || '09:00'}` : date)
    if (mode === 'date') { setOpen(false); trigger.current?.focus() }
  }
  const setTime = (nextHour: number, nextMinute: number) => {
    const next = `${pad(nextHour)}:${pad(nextMinute)}`
    onChange(mode === 'datetime' ? `${selectedDate || minDate || todayInManila()}T${next}` : next)
    setTypedTime(displayTime(next))
    setTimeError(false)
  }
  const applyTypedTime = () => {
    const parsed = parseTime(typedTime)
    if (!parsed) { setTimeError(true); return false }
    setTime(Number(parsed.slice(0, 2)), Number(parsed.slice(3, 5)))
    return true
  }
  const firstWeekday = new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate()
  const display = mode === 'date' ? displayDate(value) : mode === 'time' ? displayTime(value) : value ? `${displayDate(selectedDate)} · ${displayTime(selectedTime)}` : ''
  const minMonth = minDate?.slice(0, 7)
  const maxMonth = maxDate?.slice(0, 7)
  const currentMonth = dateKey(view.year, view.month, 1).slice(0, 7)

  return <div className="em-dtp" ref={root}>
    <button ref={trigger} type="button" name={name} className="em-dtp-trigger" aria-label={`${label}: ${display || 'not selected'}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popoverId : undefined} aria-invalid={invalid || undefined} onClick={() => { if (!open) { if (hasDate) { const date = dateParts(selectedDate) || dateParts(minDate || '') || dateParts(todayInManila())!; setView({ year: date.year, month: date.month }) } if (hasTime) { setTypedTime(displayTime(selectedTime || '09:00')); setTimeError(false) } } setOpen(!open) }}>
      <span className={display ? '' : 'em-dtp-placeholder'}>{display || (mode === 'date' ? 'Choose a date' : mode === 'time' ? 'Choose a time' : 'Choose date and time')}</span>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{hasDate ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}</svg>
    </button>
    {open && <div id={popoverId} className="em-dtp-popover" role="dialog" aria-label={`${label} picker`}>
      {hasDate && <div className="em-dtp-calendar">
        <div className="em-dtp-month"><strong>{monthLabel(view.year, view.month)}</strong><div><button type="button" aria-label="Previous month" disabled={Boolean(minMonth && currentMonth <= minMonth)} onClick={() => changeMonth(-1)}>‹</button><button type="button" aria-label="Next month" disabled={Boolean(maxMonth && currentMonth >= maxMonth)} onClick={() => changeMonth(1)}>›</button></div></div>
        <div className="em-dtp-grid" role="group" aria-label={monthLabel(view.year, view.month)}>{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span className="em-dtp-weekday" key={day}>{day}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const date = dateKey(view.year, view.month, day); return <button key={date} type="button" className={date === selectedDate ? 'is-selected' : ''} aria-label={displayDate(date)} aria-pressed={date === selectedDate} disabled={Boolean((minDate && date < minDate) || (maxDate && date > maxDate))} onClick={() => setDate(date)}>{day}</button> })}</div>
      </div>}
      {hasTime && <div className="em-dtp-time"><span>Time · Philippine time</span><div className="em-dtp-time-controls"><div><span>Hour</span><AppSelect label={`${label} hour`} value={String(hour12)} options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} onChange={(next) => setTime(Number(next) % 12 + (period === 'PM' ? 12 : 0), minute)} /></div><span className="em-dtp-colon">:</span><div><span>Minute</span><AppSelect label={`${label} minute`} value={String(minute)} options={Array.from({ length: 60 }, (_, index) => ({ value: String(index), label: pad(index) }))} onChange={(next) => setTime(hour, Number(next))} /></div><div><span>AM / PM</span><AppSelect label={`${label} AM or PM`} value={period} options={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]} onChange={(next) => setTime(hour12 % 12 + (next === 'PM' ? 12 : 0), minute)} /></div></div><label className="em-dtp-type"><span>Or type a time</span><input type="text" inputMode="text" value={typedTime} onChange={(event) => { setTypedTime(event.target.value); setTimeError(false) }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyTypedTime() } }} placeholder="6:30 AM" aria-label={`${label}, type a time such as 6:30 AM`} aria-invalid={timeError || undefined} /></label>{timeError && <small className="em-dtp-time-error" role="alert">Enter a time like 6:30 AM.</small>}</div>}
      <div className="em-dtp-footer">{hasDate && <button type="button" disabled={Boolean((minDate && todayInManila() < minDate) || (maxDate && todayInManila() > maxDate))} onClick={() => setDate(todayInManila())}>Today</button>}<button type="button" className="em-dtp-done" onClick={() => { if (hasTime && (typedTime !== displayTime(selectedTime || '09:00') || !selectedTime) && !applyTypedTime()) return; setOpen(false); trigger.current?.focus() }}>Done</button></div>
    </div>}
  </div>
}
