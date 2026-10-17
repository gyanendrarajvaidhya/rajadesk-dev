import type { Epic, Task, Ticket, Work } from './types'
import { daysFrom } from './format'

const OPEN_TASK = ['pending', 'in_progress', 'reopened', 'blocked', 'in_review']

/** Epic buckets, in the order the Epics page shows them. */
export const BUCKETS = [
  { key: 'new', label: 'New' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'active', label: 'In progress' },
  { key: 'review', label: 'In review' },
  { key: 'done', label: 'Done (14 days)' },
] as const
export type Bucket = (typeof BUCKETS)[number]['key']

/** New = waiting for your acknowledgement, or assigned in the last 3 days and not started. */
export function bucketOf(e: Epic, today: string): Bucket {
  if (e.status === 'done') return 'done'
  if (e.status === 'in_review') return 'review'
  if (e.needs_my_ack || (e.status === 'open' && daysFrom(e.created_at.slice(0, 10), today) >= -3 && !e.tasks.some((t) => t.status !== 'pending'))) return 'new'
  if (e.overdue) return 'overdue'
  return 'active'
}

/** Your own tasks across all epics. */
export const myTasks = (w: Work): Task[] => w.epics.flatMap((e) => e.tasks.filter((t) => t.mine))

const rank = (t: Task) => (t.running_by_me ? 0 : t.status === 'in_progress' ? 1 : t.status === 'reopened' ? 2 : t.status === 'blocked' ? 4 : t.status === 'in_review' ? 5 : 3)

/** What to work on next: running, in progress, reopened, then pending by due date. */
export const upNext = (w: Work) =>
  myTasks(w)
    .filter((t) => OPEN_TASK.includes(t.status))
    .sort((a, b) => rank(a) - rank(b) || String(a.deadline ?? '9').localeCompare(String(b.deadline ?? '9')))

/** Open tickets on your open epics, once each. */
export function myTickets(w: Work): (Ticket & { epics: string[] })[] {
  const byId = new Map<string, Ticket & { epics: string[] }>()
  for (const e of w.epics.filter((x) => x.status !== 'done'))
    for (const t of e.tickets.filter((x) => x.open)) {
      const cur = byId.get(t.id) ?? { ...t, epics: [] }
      cur.epics.push(e.human_id)
      byId.set(t.id, cur)
    }
  return [...byId.values()]
}

export function counts(w: Work) {
  const open = w.epics.filter((e) => e.status !== 'done')
  const tasks = myTasks(w).filter((t) => OPEN_TASK.includes(t.status))
  const tickets = myTickets(w)
  return {
    openEpics: open.length,
    overdueEpics: open.filter((e) => e.overdue).length,
    toAck: open.filter((e) => e.needs_my_ack).length,
    newEpics: open.filter((e) => bucketOf(e, w.today) === 'new').length,
    slaBreached: tickets.filter((t) => t.sla_breached).length,
    slaAtRisk: tickets.filter((t) => t.sla_at_risk).length,
    overdueTasks: tasks.filter((t) => t.overdue).length,
    dueToday: tasks.filter((t) => t.due_today).length,
    openTasks: tasks.length,
  }
}
