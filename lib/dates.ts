export const TIMEZONE = 'America/Denver'

export function getMtnDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

export function getMtnDateTimeRange(): { start: string; end: string } {
  const now = new Date()
  const mtn = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }))
  const y = mtn.getFullYear()
  const m = String(mtn.getMonth() + 1).padStart(2, '0')
  const d = String(mtn.getDate()).padStart(2, '0')
  return {
    start: `${y}-${m}-${d}T00:00:00`,
    end: `${y}-${m}-${d}T23:59:59`,
  }
}

export function getMtnHour(): number {
  return parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }),
    10
  )
}

export function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function minutesAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000)
  if (diff < 1) return 'just now'
  if (diff === 1) return '1 min ago'
  if (diff < 60) return `${diff} min ago`
  const h = Math.floor(diff / 60)
  return h === 1 ? '1 hr ago' : `${h} hrs ago`
}
