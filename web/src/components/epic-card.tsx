import { useState } from 'react'
import { ArrowRightIcon, CheckIcon, ExternalLinkIcon, GitPullRequestIcon, HourglassIcon, PlusIcon, TimerIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWrite } from '@/lib/api'
import { useDesk } from '@/lib/desk'
import { daysFrom, epicTone, label, shortDate, todayIso } from '@/lib/format'
import type { Epic, Ticket } from '@/lib/types'
import { AsyncButton } from '@/components/async-button'
import { Chip, LiveTimer } from '@/components/chips'
import { ConfirmButton } from '@/components/confirm-button'
import { DatePicker } from '@/components/date-picker'
import { Combobox } from '@/components/combobox'
import { TaskRow } from '@/components/task-row'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function TicketChip({ t }: { t: Ticket }) {
  return (
    <Chip asChild tone={t.sla_breached ? 'bad' : t.sla_at_risk ? 'warn' : 'neutral'}>
      <a href={t.url} target="_blank" rel="noopener" title={`${t.title}${t.sla_breached ? ` · SLA breached (${t.sla_breached_codes.join(', ')})` : t.sla_at_risk ? ' · SLA at risk' : ''}`}>
        {t.sla_breached && <TriangleAlertIcon />}
        {t.human_id} · {label(t.status)}
      </a>
    </Chip>
  )
}

/** ETD line: "ETD 12 Oct" plus how late / how close it is. */
export function Etd({ e }: { e: Epic }) {
  if (!e.deadline) return <span>no ETD</span>
  const d = daysFrom(e.deadline)
  return (
    <span className={cn(e.overdue && 'font-medium text-destructive')}>
      ETD {shortDate(e.deadline)}
      {e.overdue ? ` · ${-d} day${d === -1 ? '' : 's'} late` : !['done', 'in_review'].includes(e.status) && d <= 2 && d >= 0 ? ` · ${d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`}` : ''}
    </span>
  )
}

export function EpicCard({ e }: { e: Epic }) {
  const { openEpic } = useDesk()
  const write = useWrite()
  const [adding, setAdding] = useState(false)
  const mine = e.tasks.filter((t) => t.mine)
  const done = e.tasks.filter((t) => t.status === 'done').length
  const total = e.tasks.reduce((s, t) => s + (t.elapsed_seconds || 0), 0)
  const liveSince = e.tasks.find((t) => t.timer_running)?.running_since
  const canReview = e.owned_by_me && ['open', 'in_progress', 'reopened'].includes(e.status)
  // Your own tasks first, then the rest of the team's.
  const tasks = [...mine, ...e.tasks.filter((t) => !t.mine)]

  return (
    <div className={cn('overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10', e.needs_my_ack && 'ring-2 ring-warning/60', e.overdue && !e.needs_my_ack && 'ring-destructive/40')}>
      <div className="flex flex-wrap items-start gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm">
            <button type="button" className="mr-1.5 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline" onClick={() => openEpic(e.human_id)}>
              {e.human_id}
            </button>
            <button type="button" className="text-left font-semibold hover:underline" onClick={() => openEpic(e.human_id)}>
              {e.title}
            </button>
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <Chip tone={epicTone(e.status)}>{label(e.status)}</Chip>
            <span>{e.project}</span>
            <span>· {e.priority ?? 'no priority'}</span>
            <span>· owner {e.owned_by_me ? 'you' : (e.owner ?? '—')}</span>
            <span>
              · <Etd e={e} />
            </span>
            <span>
              · {done}/{e.tasks.length} tasks done · <LiveTimer base={total} since={liveSince} />
            </span>
            {e.tasks.some((t) => t.running_by_me) && (
              <span className="inline-flex items-center gap-1 font-medium text-success">
                · <TimerIcon className="size-3.5" /> your timer is running
              </span>
            )}
          </p>
          {(e.tickets.length > 0 || e.prs.length > 0) && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              {e.tickets.map((t) => (
                <TicketChip key={t.id} t={t} />
              ))}
              {e.prs.map((p) => (
                <Chip key={p.id} asChild tone={p.merged_at ? 'ok' : 'info'}>
                  <a href={p.pr_url} target="_blank" rel="noopener">
                    <GitPullRequestIcon /> {p.label}
                  </a>
                </Chip>
              ))}
            </div>
          )}
          {e.needs_my_ack && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <AsyncButton size="xs" onClick={() => write(`/api/epic/${e.human_id}/ack`, {}, { success: `${e.human_id} acknowledged` })}>
                <CheckIcon /> Acknowledge
              </AsyncButton>
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <HourglassIcon className="size-3.5" /> New for you: acknowledge so the ticket can move to Developer assigned
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {canReview && (
            <ConfirmButton
              size="xs"
              variant="outline"
              disabled={!e.all_tasks_done}
              title={e.all_tasks_done ? 'Submit the epic for review' : `Finish every task first (${done}/${e.tasks.length} done)`}
              confirmLabel="Confirm: send for review"
              onConfirm={() => write(`/api/epic/${e.human_id}/review`, {}, { success: `${e.human_id} is in review` })}
            >
              <ArrowRightIcon /> Epic to review
            </ConfirmButton>
          )}
          {e.status !== 'done' && (
            <Button size="xs" variant="ghost" onClick={() => setAdding((a) => !a)}>
              <PlusIcon /> Task
            </Button>
          )}
          <Button size="xs" variant="ghost" asChild>
            <a href={e.url} target="_blank" rel="noopener">
              Raja <ExternalLinkIcon />
            </a>
          </Button>
        </div>
      </div>
      {tasks.length ? (
        <div className="divide-y">
          {tasks.map((t) => (
            <TaskRow key={t.id} t={t} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">No tasks yet. Add your first task to start the timer.</p>
      )}
      {adding && <AddTaskForm epic={e} onDone={() => setAdding(false)} />}
    </div>
  )
}

const POINTS = [1, 2, 3, 5, 8, 13].map((p) => ({ value: String(p), label: `${p} SP` }))

function AddTaskForm({ epic, onDone }: { epic: Epic; onDone: () => void }) {
  const write = useWrite()
  const [title, setTitle] = useState('')
  const [sp, setSp] = useState('1')
  const [deadline, setDeadline] = useState(() => (epic.deadline && epic.deadline >= todayIso() ? epic.deadline : todayIso()))
  return (
    <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-2.5">
      <PlusIcon className="size-4 text-muted-foreground" />
      <Input autoFocus value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="New task for you…" className="h-7 min-w-48 flex-1 text-sm" />
      <Combobox size="xs" options={POINTS} value={sp} onValueChange={setSp} className="w-24" />
      <DatePicker size="xs" value={deadline} onChange={setDeadline} />
      <AsyncButton
        size="xs"
        disabled={!title.trim()}
        onClick={async () => {
          if (await write(`/api/epic/${epic.human_id}/task`, { title, sp, deadline }, { success: 'Task added' })) onDone()
        }}
      >
        Add task
      </AsyncButton>
    </div>
  )
}
