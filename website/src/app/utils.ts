import type { Attachment } from './types'

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Local date key in yyyy-mm-dd form. */
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a local yyyy-mm-dd key into a local Date. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function isoFromDateInput(value: string): string | undefined {
  if (!value) return undefined
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d).toISOString()
}

export function daysUntil(iso: string | undefined, now: Date = new Date()): number {
  if (!iso) return 99
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return 99
  const today = startOfDay(now)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  return Math.round((dueDay.getTime() - today.getTime()) / 86400000)
}

export function dueMetaFromIso(iso: string | undefined, now: Date = new Date()): { label: string; days: number } {
  const days = daysUntil(iso, now)
  if (days === 99) return { label: 'No due date', days }
  return { label: formatDueLabel(days), days }
}

export function formatDueLabel(days: number): string {
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `In ${days} days`
  return new Date(Date.now() + days * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fmtMinutes(min: number): string {
  const hours = Math.floor(min / 60)
  const rest = min % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function fmtClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${String(m).padStart(2, '0')} ${period}`
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return new Date(iso).toLocaleString()
}

export function isSameWeek(d: Date, now: Date = new Date()): boolean {
  const start = startOfWeek(now)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  return d.getTime() >= start.getTime() && d.getTime() < end.getTime()
}

export function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff))
}

const MAX_ATTACHMENT_BYTES = 400 * 1024 // 400 KB raw — keeps the synced payload small

/**
 * Convert picked files into stored attachments (data: URLs). Text files get
 * their content extracted so the Assignment Help AI can read them. Files
 * larger than MAX_ATTACHMENT_BYTES are skipped.
 */
export function filesToAttachments(files: File[]): Promise<Attachment[]> {
  const read = (file: File): Promise<Attachment | null> =>
    new Promise((resolve) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result || '')
        const isText = /^(text\/|application\/(json|xml|javascript)|.*(\+xml|\+json))/.test(file.type) || /\.(txt|md|json|csv|ts|tsx|js|jsx|py|html|css)$/i.test(file.name)
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl,
          text: isText ? dataUrl.slice(dataUrl.indexOf(',') + 1).slice(0, 6000) : undefined,
        })
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  return Promise.all(files.map(read)).then((results) => results.filter((a): a is Attachment => a !== null))
}

export function priorityRank(p: string): number {
  switch (p) {
    case 'Critical':
      return 3
    case 'High':
      return 2
    case 'Medium':
      return 1
    default:
      return 0
  }
}
