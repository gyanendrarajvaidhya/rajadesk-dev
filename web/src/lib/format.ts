export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  discussion: 'Discussion',
  accept: 'Accepted',
  developer_assigned: 'Dev assigned',
  qa: 'QA',
  pm_testing: 'PM testing',
  ready_to_live: 'Ready to live',
  rejected: 'Rejected',
  resolved: 'Resolved',
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
  reopened: 'Reopened',
  cancelled: 'Cancelled',
  misc: 'Misc',
  blocked: 'Blocked',
  abandoned: 'Abandoned',
}

export const label = (status: string) => STATUS_LABEL[status] ?? status

/** YYYY-MM-DD, or an em dash. */
export const d10 = (s?: string | null) => (s ? String(s).slice(0, 10) : '—')

/** Local date as YYYY-MM-DD. */
export const todayIso = () => new Date().toLocaleDateString('en-CA')

/** "3 Oct" style short date from YYYY-MM-DD. */
export function shortDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(`${String(s).slice(0, 10)}T00:00:00`)
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Whole days from today to a YYYY-MM-DD date (negative = past). */
export function daysFrom(s: string, today = todayIso()) {
  return Math.round((new Date(`${s}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 864e5)
}

export function ago(s?: string | null) {
  if (!s) return ''
  const h = (Date.now() - new Date(s).getTime()) / 36e5
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`
  if (h < 48) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

/** Seconds → H:MM:SS */
export function fmtDur(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Seconds → "3h 20m" */
export function fmtHours(seconds: number) {
  const m = Math.round(Math.max(0, seconds) / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

export type Tone = 'neutral' | 'bad' | 'warn' | 'ok' | 'info'

export const taskTone = (status: string): Tone =>
  status === 'done'
    ? 'ok'
    : status === 'in_review'
      ? 'info'
      : status === 'blocked'
        ? 'bad'
        : status === 'in_progress'
          ? 'warn'
          : 'neutral'

export const epicTone = (status: string): Tone =>
  status === 'done' ? 'ok' : status === 'in_review' ? 'info' : status === 'in_progress' || status === 'reopened' ? 'warn' : 'neutral'

/** Elapsed seconds including a running timer. */
export const liveSeconds = (base: number, since: string | null | undefined, now: number) =>
  base + (since ? (now - new Date(since).getTime()) / 1000 : 0)
