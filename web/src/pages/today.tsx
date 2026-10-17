import { CheckIcon, GitPullRequestIcon, HourglassIcon, TimerIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWrite } from '@/lib/api'
import { useDesk } from '@/lib/desk'
import { counts, myTickets, upNext } from '@/lib/derive'
import { daysFrom, fmtHours, label, shortDate } from '@/lib/format'
import { useGithub, useStatus } from '@/lib/queries'
import type { Task, Work } from '@/lib/types'
import { AsyncButton } from '@/components/async-button'
import { Chip, LiveTimer } from '@/components/chips'
import { Etd, TicketChip } from '@/components/epic-card'
import { PlayPause, TaskRow } from '@/components/task-row'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TodayPage({ w }: { w: Work }) {
  const c = counts(w)
  const next = upNext(w)
  const running = next.find((t) => t.running_by_me)
  return (
    <div className="space-y-4">
      <NowPlaying running={running} next={next.filter((t) => !t.running_by_me)[0]} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Logged today" value={w.time ? fmtHours(w.time.today) : '—'} hint={w.time ? `${fmtHours(w.time.week)} this week` : 'timer log not readable'} />
        <Stat label="New epics" value={c.newEpics} hint={c.toAck ? `${c.toAck} to acknowledge` : 'all acknowledged'} tone={c.toAck ? 'warn' : undefined} page="epics" />
        <Stat label="Overdue epics" value={c.overdueEpics} hint={`of ${c.openEpics} open`} tone={c.overdueEpics ? 'bad' : undefined} page="epics" />
        <Stat label="SLA breached" value={c.slaBreached} hint={c.slaAtRisk ? `${c.slaAtRisk} more at risk` : 'tickets on your epics'} tone={c.slaBreached ? 'bad' : c.slaAtRisk ? 'warn' : undefined} />
        <Stat label="Tasks overdue" value={c.overdueTasks} hint={`${c.dueToday} due today`} tone={c.overdueTasks ? 'bad' : undefined} page="tasks" />
        <Stat label="Open tasks" value={c.openTasks} hint="yours, all epics" page="tasks" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Attention w={w} />
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Up next: your open tasks</CardTitle>
            </CardHeader>
            {next.length ? (
              <div className="divide-y">
                {next.slice(0, 12).map((t) => (
                  <TaskRow key={t.id} t={t} showEpic />
                ))}
              </div>
            ) : (
              <CardContent className="py-4 text-sm text-muted-foreground">No open tasks. Add one from an epic.</CardContent>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          {w.time && <WeekStrip time={w.time} today={w.today} />}
          <GithubSnapshot />
        </div>
      </div>
    </div>
  )
}

function NowPlaying({ running, next }: { running?: Task; next?: Task }) {
  const { openEpic } = useDesk()
  const t = running ?? next
  return (
    <Card className={cn('py-4', running && 'ring-2 ring-success/50')}>
      <CardContent className="flex flex-row flex-wrap items-center gap-4">
        <div className={cn('flex size-11 items-center justify-center rounded-full', running ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
          <TimerIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{running ? 'Working on now' : t ? 'Nothing running. Up next:' : 'Nothing running'}</p>
          {t ? (
            <p className="truncate font-semibold">
              {t.title}{' '}
              <button type="button" className="font-mono text-xs font-normal text-muted-foreground hover:underline" onClick={() => openEpic(t.epic_hid)}>
                {t.epic_hid}
              </button>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No open tasks assigned to you.</p>
          )}
        </div>
        {t && (
          <>
            <LiveTimer base={t.elapsed_seconds} since={running ? t.running_since : null} className="font-mono text-2xl" />
            <PlayPause t={t} size="default" />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label: l, value, hint, tone, page }: { label: string; value: number | string; hint?: string; tone?: 'bad' | 'warn'; page?: 'epics' | 'tasks' }) {
  const { go } = useDesk()
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className={cn('font-heading text-2xl font-semibold tabular-nums', tone === 'bad' && 'text-destructive', tone === 'warn' && 'text-warning')}>{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </>
  )
  const cls = 'rounded-xl bg-card px-4 py-3 text-left ring-1 ring-foreground/10'
  return page ? (
    <button type="button" className={cn(cls, 'transition-colors hover:bg-muted/50')} onClick={() => go(page)}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Acknowledge new epics, overdue epics, SLA-breached tickets: the things someone will ask you about. */
function Attention({ w }: { w: Work }) {
  const { openEpic } = useDesk()
  const write = useWrite()
  const open = w.epics.filter((e) => e.status !== 'done')
  const toAck = open.filter((e) => e.needs_my_ack)
  const overdue = open.filter((e) => e.overdue && !e.needs_my_ack).sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
  const breached = myTickets(w).filter((t) => t.sla_breached || t.sla_at_risk)
  if (!toAck.length && !overdue.length && !breached.length)
    return (
      <Card className="py-4">
        <CardContent className="flex flex-row items-center gap-2 text-sm text-muted-foreground">
          <CheckIcon className="size-4 text-success" /> Nothing needs attention: no new epics to acknowledge, nothing overdue, no SLA breaches.
        </CardContent>
      </Card>
    )
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-sm">Needs attention</CardTitle>
      </CardHeader>
      <ul className="divide-y text-sm">
        {toAck.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <Chip tone="warn">
              <HourglassIcon /> New
            </Chip>
            <EpicLink hid={e.human_id} title={e.title} onOpen={openEpic} />
            <span className="text-xs text-muted-foreground">
              {e.project} · <Etd e={e} />
            </span>
            <AsyncButton size="xs" className="ml-auto" onClick={() => write(`/api/epic/${e.human_id}/ack`, {}, { success: `${e.human_id} acknowledged` })}>
              <CheckIcon /> Acknowledge
            </AsyncButton>
          </li>
        ))}
        {overdue.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <Chip tone="bad">{-daysFrom(e.deadline!, w.today)}d late</Chip>
            <EpicLink hid={e.human_id} title={e.title} onOpen={openEpic} />
            <span className="text-xs text-muted-foreground">
              {e.project} · {label(e.status)} · was due {shortDate(e.deadline)} · {e.tasks.filter((t) => t.status === 'done').length}/{e.tasks.length} tasks done
            </span>
          </li>
        ))}
        {breached.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <Chip tone={t.sla_breached ? 'bad' : 'warn'}>
              <TriangleAlertIcon /> {t.sla_breached ? 'SLA breached' : 'SLA at risk'}
            </Chip>
            <TicketChip t={t} />
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className="text-xs text-muted-foreground">on {t.epics.join(', ')}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function EpicLink({ hid, title, onOpen }: { hid: string; title: string; onOpen: (hid: string) => void }) {
  return (
    <button type="button" className="min-w-0 truncate text-left hover:underline" onClick={() => onOpen(hid)}>
      <span className="mr-1.5 font-mono text-xs text-muted-foreground">{hid}</span>
      {title}
    </button>
  )
}

/** Hours per day this week, from Raja's play / pause log. */
function WeekStrip({ time, today }: { time: NonNullable<Work['time']>; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${time.weekStart}T00:00:00`)
    d.setDate(d.getDate() + i)
    const k = d.toLocaleDateString('en-CA')
    return { k, name: d.toLocaleDateString('en-IN', { weekday: 'short' }), secs: time.days[k] ?? 0 }
  })
  const max = Math.max(8 * 3600, ...days.map((d) => d.secs))
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-sm">This week · {fmtHours(time.week)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          {days.map((d) => (
            <div key={d.k} className="flex flex-1 flex-col items-center gap-1" title={`${d.k}: ${fmtHours(d.secs)}`}>
              <span className="text-[10px] text-muted-foreground tabular-nums">{d.secs ? fmtHours(d.secs) : ''}</span>
              <div className="relative h-20 w-full overflow-hidden rounded bg-muted">
                <div className={cn('absolute inset-x-0 bottom-0 rounded', d.k === today ? 'bg-primary' : 'bg-primary/50')} style={{ height: `${(d.secs / max) * 100}%` }} />
              </div>
              <span className={cn('text-[11px]', d.k === today ? 'font-semibold' : 'text-muted-foreground')}>{d.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function GithubSnapshot() {
  const { go } = useDesk()
  const st = useStatus().data
  const connected = !!st?.github.connected
  const { data, error } = useGithub(connected)
  const pushesToday = data?.pushes.filter((p) => new Date(p.at).toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA')) ?? []
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <GitPullRequestIcon className="size-4" /> GitHub {data && <span className="font-normal text-muted-foreground">· {data.login}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!connected ? (
          <>
            <p className="text-muted-foreground">{st?.github.error ?? 'Not connected yet.'}</p>
            <Button size="sm" variant="outline" onClick={() => go('github')}>
              Connect GitHub
            </Button>
          </>
        ) : error ? (
          <p className="text-destructive">{error.message}</p>
        ) : !data ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <Line n={data.reviews.length} what="PRs waiting for your review" bad />
            <Line n={data.open.length} what="open PRs of yours" />
            <Line n={pushesToday.length} what="pushes today" />
            <Line n={data.merged.length} what="PRs merged (14 days)" />
            <Button size="sm" variant="outline" className="mt-1" onClick={() => go('github')}>
              Open GitHub page
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Line({ n, what, bad }: { n: number; what: string; bad?: boolean }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className={cn('w-6 text-right font-semibold tabular-nums', bad && n > 0 && 'text-warning')}>{n}</span>
      <span className="text-muted-foreground">{what}</span>
    </p>
  )
}
