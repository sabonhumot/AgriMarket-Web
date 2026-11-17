function formatTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return value
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function formatEventTime(start: unknown, end: unknown, fallback: unknown): string {
  const startTime = String(start ?? '').trim()
  const endTime = String(end ?? '').trim()
  if (!startTime) return String(fallback ?? '').trim()
  return `${formatTime(startTime)}${endTime ? `–${formatTime(endTime)}` : ''}`
}
