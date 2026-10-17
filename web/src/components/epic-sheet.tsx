import { useState } from 'react'
import { ExternalLinkIcon, GitPullRequestIcon, SendIcon } from 'lucide-react'
import { useWrite } from '@/lib/api'
import { ago, label } from '@/lib/format'
import { useEpic } from '@/lib/queries'
import { AsyncButton } from '@/components/async-button'
import { Chip } from '@/components/chips'
import { EpicCard, TicketChip } from '@/components/epic-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

/** Epic drawer: the card (tasks + timers), description, tickets, pull requests and comments. */
export function EpicSheet({ hid, onClose }: { hid: string | null; onClose: () => void }) {
  const { data: e, error } = useEpic(hid)
  const write = useWrite()
  const [comment, setComment] = useState('')
  const [pr, setPr] = useState('')

  return (
    <Sheet open={!!hid} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-[820px]">
        <SheetHeader className="border-b">
          <SheetTitle className="pr-8">
            <span className="mr-2 font-mono text-sm text-muted-foreground">{hid}</span>
            {e?.title}
          </SheetTitle>
          <SheetDescription>{e ? `${e.project} · ${label(e.status)} · owner ${e.owned_by_me ? 'you' : (e.owner ?? '—')}` : 'Loading…'}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-4">
          {error && <p className="text-sm text-destructive">Could not load: {error.message}</p>}
          {!e && !error && <Skeleton className="h-40 w-full rounded-xl" />}
          {e && (
            <>
              <EpicCard e={e} />

              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold">Description</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{e.description.trim() || 'No description.'}</p>
              </section>

              {e.tickets.length > 0 && (
                <section className="space-y-1.5">
                  <h3 className="text-sm font-semibold">Tickets</h3>
                  <ul className="space-y-1">
                    {e.tickets.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <TicketChip t={t} />
                        <span className="min-w-0 flex-1">{t.title}</span>
                        {t.sla_breached && <Chip tone="bad">SLA breached ({t.sla_breached_codes.join(', ')})</Chip>}
                        {t.sla_at_risk && <Chip tone="warn">SLA at risk</Chip>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold">Pull requests</h3>
                {e.prs.length ? (
                  <ul className="space-y-1">
                    {e.prs.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <GitPullRequestIcon className="size-4 text-muted-foreground" />
                        <a className="hover:underline" href={p.pr_url} target="_blank" rel="noopener">
                          {p.label}
                        </a>
                        <Chip tone={p.merged_at ? 'ok' : 'info'}>{p.merged_at ? 'merged' : (p.state ?? 'open')}</Chip>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No PRs linked yet.</p>
                )}
                {e.owned_by_me && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Input value={pr} onChange={(ev) => setPr(ev.target.value)} placeholder="https://github.com/Katyayani-Organics/repo/pull/12" className="h-8 min-w-64 flex-1 text-sm" />
                    <AsyncButton
                      size="sm"
                      variant="outline"
                      disabled={!pr.trim()}
                      onClick={async () => {
                        if (await write(`/api/epic/${e.human_id}/pr`, { url: pr }, { success: 'PR linked to the epic' })) setPr('')
                      }}
                    >
                      Link PR
                    </AsyncButton>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Comments</h3>
                {e.comments.length ? (
                  <ul className="space-y-2">
                    {e.comments.map((c, i) => (
                      <li key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                        <p className="mb-0.5 text-xs text-muted-foreground">
                          {c.author} · {ago(c.created_at)}
                        </p>
                        <p className="whitespace-pre-wrap">{c.body_text}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}
                <Textarea value={comment} onChange={(ev) => setComment(ev.target.value)} placeholder="Write a comment (posted in Raja as you)…" className="min-h-20 text-sm" />
                <div className="flex justify-between gap-2">
                  <Button size="sm" variant="ghost" asChild>
                    <a href={e.url} target="_blank" rel="noopener">
                      Open in Raja <ExternalLinkIcon />
                    </a>
                  </Button>
                  <AsyncButton
                    size="sm"
                    disabled={!comment.trim()}
                    onClick={async () => {
                      if (await write(`/api/epic/${e.human_id}/comment`, { text: comment }, { success: 'Comment posted' })) setComment('')
                    }}
                  >
                    <SendIcon /> Comment
                  </AsyncButton>
                </div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
