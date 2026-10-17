import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { GitCommitHorizontalIcon, GitMergeIcon, GitPullRequestIcon, RefreshCwIcon } from 'lucide-react'
import { api, useWrite } from '@/lib/api'
import { useDesk } from '@/lib/desk'
import { ago } from '@/lib/format'
import { useGithub } from '@/lib/queries'
import type { Pr, Status, Work } from '@/lib/types'
import { AsyncButton } from '@/components/async-button'
import { Chip } from '@/components/chips'
import { Combobox } from '@/components/combobox'
import { GithubConnect } from '@/components/connect'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function GithubPage({ w, status }: { w: Work; status: Status }) {
  const qc = useQueryClient()
  const connected = status.github.connected
  const { data, error, isFetching } = useGithub(connected)
  if (!connected) return <GithubConnect status={status.github} newTokenUrl={status.newTokenUrl} />

  // Which Raja epic each PR is linked to (Raja → epic → Pull requests).
  const epicOf = new Map(w.epics.flatMap((e) => e.prs.map((p) => [p.pr_url.toLowerCase(), e] as const)))
  const refresh = async () => {
    await qc.fetchQuery({ queryKey: ['github'], queryFn: () => api('/api/github?fresh') })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          Signed in to GitHub as <span className="font-medium text-foreground">{status.github.login}</span>
          {w.me.github_username && w.me.github_username.toLowerCase() !== status.github.login?.toLowerCase() && (
            <Chip tone="warn" className="ml-2">
              Raja lists you as {w.me.github_username}
            </Chip>
          )}
        </span>
        {data && <span>· updated {ago(data.fetched_at)}</span>}
        <AsyncButton size="sm" variant="outline" className="ml-auto" onClick={refresh} disabled={isFetching}>
          <RefreshCwIcon /> Refresh
        </AsyncButton>
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {!data && !error && <Skeleton className="h-60 w-full rounded-xl" />}
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PrList title="Waiting for your review" prs={data.reviews} empty="No PRs waiting for your review." showAuthor />
          <PrList title="Your open PRs" prs={data.open} empty="No open PRs." epicOf={epicOf} w={w} />
          <PrList title="Merged in the last 14 days" prs={data.merged} empty="Nothing merged in the last 14 days." epicOf={epicOf} w={w} merged />
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Recent pushes · {data.pushes.length}</CardTitle>
            </CardHeader>
            {data.pushes.length ? (
              <ul className="divide-y text-sm">
                {data.pushes.slice(0, 25).map((p) => (
                  <li key={p.id} className="space-y-0.5 px-4 py-2">
                    <a href={p.url} target="_blank" rel="noopener" className="flex items-center gap-2 hover:underline">
                      <GitCommitHorizontalIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {p.repo} <span className="text-muted-foreground">· {p.branch}</span>
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{ago(p.at)}</span>
                    </a>
                    {p.commits.slice(0, 3).map((c) => (
                      <p key={c.sha} className="truncate pl-6 text-xs text-muted-foreground">
                        {c.message}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <CardContent className="py-3 text-sm text-muted-foreground">No pushes in your recent GitHub activity.</CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function PrList({
  title,
  prs,
  empty,
  showAuthor,
  epicOf,
  w,
  merged,
}: {
  title: string
  prs: Pr[]
  empty: string
  showAuthor?: boolean
  epicOf?: Map<string, Work['epics'][number]>
  w?: Work
  merged?: boolean
}) {
  const { openEpic } = useDesk()
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-sm">
          {title} · {prs.length}
        </CardTitle>
      </CardHeader>
      {prs.length ? (
        <ul className="divide-y text-sm">
          {prs.map((p) => {
            const epic = epicOf?.get(p.url.toLowerCase())
            return (
              <li key={p.url} className="space-y-1 px-4 py-2">
                <a href={p.url} target="_blank" rel="noopener" className="flex items-start gap-2 hover:underline">
                  {merged ? <GitMergeIcon className="mt-0.5 size-4 shrink-0 text-success" /> : <GitPullRequestIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0">
                    {p.title}
                    <span className="block text-xs text-muted-foreground">
                      {p.repo}#{p.number}
                      {showAuthor && ` · by ${p.author}`} · {merged ? `merged ${ago(p.merged_at)}` : `updated ${ago(p.updated_at)}`}
                      {p.draft && ' · draft'}
                    </span>
                  </span>
                </a>
                {epicOf && (
                  <div className="pl-6">
                    {epic ? (
                      <Chip asChild tone="info">
                        <button type="button" onClick={() => openEpic(epic.human_id)}>
                          {epic.human_id} · {epic.title}
                        </button>
                      </Chip>
                    ) : (
                      w && <LinkToEpic pr={p} w={w} />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <CardContent className="py-3 text-sm text-muted-foreground">{empty}</CardContent>
      )}
    </Card>
  )
}

/** Raja lets the epic owner link PRs, so only epics you own are offered. */
function LinkToEpic({ pr, w }: { pr: Pr; w: Work }) {
  const write = useWrite()
  const [epic, setEpic] = useState('')
  const options = w.epics.filter((e) => e.owned_by_me && e.status !== 'done').map((e) => ({ value: e.human_id, label: `${e.human_id} · ${e.title}` }))
  if (!options.length) return <span className="text-xs text-muted-foreground">Not linked to a Raja epic.</span>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Not linked:</span>
      <Combobox size="xs" options={options} value={epic} onValueChange={setEpic} placeholder="Pick your epic…" className="w-56" />
      <AsyncButton size="xs" variant="outline" disabled={!epic} onClick={() => write(`/api/epic/${epic}/pr`, { url: pr.url }, { success: `Linked to ${epic}` })}>
        Link
      </AsyncButton>
    </div>
  )
}
