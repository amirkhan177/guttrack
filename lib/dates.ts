export const TIMEZONE = 'America/Denver'

/**
 * Returns YYYY-MM-DD for the current cycle.
 * A cycle runs from 8:00 AM to 7:59 AM next day (Denver Time).
 * Hours 00:00 - 07:59 belong to the previous calendar day's cycle.
 */
export function getMtnCycleDate(offsetCycles = 0): string {
  const now = new Date()
  const mtn = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }))
  
  // If before 8am, we are still in yesterday's cycle
  if (mtn.getHours() < 8) {
    mtn.setDate(mtn.getDate() - 1)
  }
  
  if (offsetCycles !== 0) {
    mtn.setDate(mtn.getDate() + offsetCycles)
  }
  
  const y = mtn.getFullYear()
  const m = String(mtn.getMonth() + 1).padStart(2, '0')
  const d = String(mtn.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getMtnDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
}

/**
 * Returns the timestamp range for the current 8am-8am cycle.
 */
export function getMtnDateTimeRange(): { start: string; end: string } {
  const cycleDate = getMtnCycleDate(0) // YYYY-MM-DD
  const [y, m, d] = cycleDate.split('-')
  
  // Start is 8am on the cycle date
  const start = `${y}-${m}-${d}T08:00:00`
  
  // End is 7:59:59am on the next calendar day
  const nextDate = new Date(`${cycleDate}T12:00:00`)
  nextDate.setDate(nextDate.getDate() + 1)
  const ny = nextDate.getFullYear()
  const nm = String(nextDate.getMonth() + 1).padStart(2, '0')
  const nd = String(nextDate.getDate()).padStart(2, '0')
  const end = `${ny}-${nm}-${nd}T07:59:59`
  
  return { start, end }
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
