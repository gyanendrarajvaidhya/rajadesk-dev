import { useState } from 'react'
import { ArrowRightIcon, CheckIcon, GitPullRequestIcon, ListChecksIcon, PauseIcon, PlayIcon, RotateCcwIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWrite } from '@/lib/api'
import { useDesk } from '@/lib/desk'
import { label, shortDate, taskTone } from '@/lib/format'
import type { Task } from '@/lib/types'
import { AsyncButton } from '@/components/async-button'
import { Chip, LiveTimer } from '@/components/chips'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

/** Play starts a pending task too; Raja then counts the time. Only one of your timers runs at a time. */
export function PlayPause({ t, size = 'xs' }: { t: Task; size?: 'xs' | 'sm' | 'default' }) {
  const write = useWrite()
  if (!t.mine || ['done', 'abandoned', 'in_review'].includes(t.status)) return null
  return t.running_by_me ? (
    <AsyncButton size={size} variant="outline" onClick={() => write(`/api/task/${t.id}/pause`, {}, { success: 'Paused' })}>
      <PauseIcon /> Pause
    </AsyncButton>
  ) : (
    <AsyncButton
      size={size}
      onClick={() => write(`/api/task/${t.id}/play`, {}, { success: t.status === 'pending' ? 'Started: task is now In progress' : 'Timer running' })}
    >
      <PlayIcon /> {t.status === 'pending' ? 'Start' : 'Play'}
    </AsyncButton>
  )
}

const PR_LINK = /^(?:https?:\/\/)?(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/i

export function TaskRow({ t, showEpic }: { t: Task; showEpic?: boolean }) {
  const write = useWrite()
  const { openEpic } = useDesk()
  const [dodOpen, setDodOpen] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [reason, setReason] = useState('')
  // Review / Done: a small panel with an optional PR link before the move.
  const [finishing, setFinishing] = useState<'in_review' | 'done' | null>(null)
  const [pr, setPr] = useState('')
  const cl = t.checklist ?? []
  const s = t.status
  const prBad = pr.trim() !== '' && !PR_LINK.test(pr.trim())

  const setStatus = (to: string, extra: Record<string, string> = {}) => write(`/api/task/${t.id}/status`, { to, ...extra }, { success: `Task moved to ${label(to)}` })
  const finish = async () => {
    if (!finishing) return
    if (await setStatus(finishing, pr.trim() ? { prUrl: pr.trim() } : {})) {
      setFinishing(null)
      setPr('')
    }
  }
  const openFinish = (to: 'in_review' | 'done') => {
    setFinishing((f) => (f === to ? null : to))
    setReopening(false)
  }

  return (
    <div className={cn('px-4 py-2.5', t.running_by_me && 'bg-success/5')}>
      <div className="grid grid-cols-1 items-center gap-x-3 gap-y-1.5 sm:grid-cols-[6.5rem_1fr_auto]">
        <div>
          <Chip tone={taskTone(s)}>{label(s)}</Chip>
        </div>
        <div className="min-w-0">
          <p className="text-sm">{t.title}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {showEpic && (
              <button type="button" className="font-mono hover:text-foreground hover:underline" onClick={() => openEpic(t.epic_hid)} title={t.epic_title}>
                {t.epic_hid}
              </button>
            )}
            <span>
              {t.story_points ?? '–'} SP{t.sp_approved ? '' : ' (not approved yet)'}
            </span>
            <span className={cn(t.overdue && 'font-medium text-destructive', t.due_today && 'font-medium text-warning')}>
              · due {t.due_today ? 'today' : shortDate(t.deadline)}
              {t.overdue && ' (overdue)'}
            </span>
            {!t.mine && <span>· {t.assignee ?? 'unassigned'}</span>}
            {t.timer_running && !t.running_by_me && <span className="font-medium text-success">· {t.running_by} working on it</span>}
            {t.prs?.map((p) => (
              <a key={p.id} href={p.pr_url} target="_blank" rel="noopener" className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline">
                · <GitPullRequestIcon className="size-3" /> {p.label}
              </a>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <LiveTimer base={t.elapsed_seconds} since={t.timer_running ? t.running_since : null} className="mr-1 min-w-16 text-right font-mono text-xs" />
          {t.mine && (
            <>
              <PlayPause t={t} />
              {cl.length > 0 && s !== 'pending' && (
                <Button size="xs" variant={dodOpen ? 'secondary' : 'ghost'} onClick={() => setDodOpen((o) => !o)} title="Definition of Done">
                  <ListChecksIcon /> {t.checklist_done}/{cl.length}
                </Button>
              )}
              {['in_progress', 'reopened'].includes(s) && (
                <Button size="xs" variant={finishing === 'in_review' ? 'secondary' : 'outline'} onClick={() => openFinish('in_review')} title="Send for review">
                  <ArrowRightIcon /> Review
                </Button>
              )}
              {['in_progress', 'reopened', 'in_review'].includes(s) && (
                <Button size="xs" variant={finishing === 'done' ? 'secondary' : 'outline'} onClick={() => openFinish('done')}>
                  <CheckIcon /> Done
                </Button>
              )}
              {['done', 'in_review'].includes(s) && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setReopening((o) => !o)
                    setFinishing(null)
                  }}
                >
                  <RotateCcwIcon /> Reopen
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {finishing && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-muted/50 p-3 sm:ml-[7.25rem]">
          <div className="flex flex-wrap items-center gap-2">
            <GitPullRequestIcon className="size-4 text-muted-foreground" />
            <Input
              autoFocus
              value={pr}
              onChange={(e) => setPr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !prBad) void finish()
                if (e.key === 'Escape') setFinishing(null)
              }}
              placeholder="PR link (optional): https://github.com/Katyayani-Organics/repo/pull/12"
              aria-invalid={prBad || undefined}
              className="h-7 min-w-56 flex-1 text-sm"
            />
            <AsyncButton size="xs" disabled={prBad} onClick={finish}>
              {finishing === 'done' ? <CheckIcon /> : <ArrowRightIcon />}
              {pr.trim() ? `Link PR + move to ${label(finishing)}` : `Move to ${label(finishing)}`}
            </AsyncButton>
            <Button size="xs" variant="ghost" onClick={() => setFinishing(null)}>
              Cancel
            </Button>
          </div>
          <p className={cn('text-xs', prBad ? 'text-destructive' : 'text-muted-foreground')}>
            {prBad
              ? 'That isn’t a GitHub pull request link. Leave it empty to move without one.'
              : `No PR? Leave it empty.${cl.length && t.checklist_done < cl.length ? ` The ${cl.length - t.checklist_done} unticked Definition of Done item${cl.length - t.checklist_done > 1 ? 's are' : ' is'} ticked for you.` : ''}`}
          </p>
        </div>
      )}
      {reopening && (
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:ml-[7.25rem]">
          <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why reopen?" className="h-7 min-w-48 flex-1 text-sm" />
          <AsyncButton
            size="xs"
            disabled={!reason.trim()}
            onClick={async () => {
              if (await setStatus('reopened', { reason })) {
                setReopening(false)
                setReason('')
              }
            }}
          >
            Reopen task
          </AsyncButton>
        </div>
      )}
      {dodOpen && cl.length > 0 && (
        <div className="mt-2 grid gap-1.5 rounded-lg bg-muted/50 p-3 sm:ml-[7.25rem]">
          <p className="text-xs text-muted-foreground">Definition of Done. Anything left unticked is ticked when you move the task to Review or Done.</p>
          {cl.map((i) => (
            <label key={i.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={i.checked}
                disabled={!t.mine || s === 'done'}
                onCheckedChange={(checked) => write(`/api/task/${t.id}/check`, { itemId: i.id, checked: checked === true })}
              />
              {i.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
