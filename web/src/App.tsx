import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleUserRoundIcon, GitPullRequestIcon, LayoutDashboardIcon, ListTodoIcon, RefreshCwIcon, SquareKanbanIcon, TimerIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isSignedOut } from '@/lib/api'
import { DeskContext, type Page } from '@/lib/desk'
import { counts, upNext } from '@/lib/derive'
import { useStatus, useWork } from '@/lib/queries'
import type { Status, Work } from '@/lib/types'
import { LiveTimer } from '@/components/chips'
import { RajaSignIn } from '@/components/connect'
import { EpicSheet } from '@/components/epic-sheet'
import { ModeToggle } from '@/components/mode-toggle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { AccountPage } from '@/pages/account'
import { UpdateNow } from '@/components/update-now'
import { useRestarting } from '@/lib/update'
import { EpicsPage } from '@/pages/epics'
import { GithubPage } from '@/pages/github'
import { TasksPage } from '@/pages/tasks'
import { TodayPage } from '@/pages/today'

const readPage = (): Page => {
  try {
    return (sessionStorage.getItem('page') as Page) || 'today'
  } catch {
    return 'today'
  }
}

export default function App() {
  const { data: status, error } = useStatus()
  const restarting = useRestarting()
  const [page, setPage] = useState<Page>(readPage)
  const [epic, setEpic] = useState<string | null>(null)
  const go = (p: Page) => {
    setPage(p)
    try {
      sessionStorage.setItem('page', p)
    } catch {
      /* private mode: not remembered */
    }
    window.scrollTo({ top: 0 })
  }

  if (restarting)
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-24 text-sm text-muted-foreground">
          <Spinner className="size-6" />
          Updating from version {restarting}: Raja Desk Dev is restarting in a new window. This page reloads by itself.
        </div>
      </Shell>
    )
  if (error)
    return (
      <Shell>
        <p className="py-16 text-center text-sm text-destructive">
          Can't reach the Raja Desk Dev server ({error.message}). Is the <code>rajadesk --dev</code> window still open?
        </p>
      </Shell>
    )
  if (!status)
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <Spinner className="size-6" />
        </div>
      </Shell>
    )
  if (!status.raja.signedIn)
    return (
      <Shell>
        <RajaSignIn status={status.raja} />
      </Shell>
    )

  return (
    <DeskContext.Provider value={{ go, openEpic: setEpic }}>
      <Desk page={page} status={status} />
      <EpicSheet hid={epic} onClose={() => setEpic(null)} />
    </DeskContext.Provider>
  )
}

function Desk({ page, status }: { page: Page; status: Status }) {
  const { data: w, error, isFetching } = useWork()
  const qc = useQueryClient()
  if (error && isSignedOut(error)) return null // /api/status flips to the sign-in card
  const c = w ? counts(w) : null
  const running = w ? upNext(w).find((t) => t.running_by_me) : undefined

  return (
    <Shell
      nav={<Nav page={page} badges={c ? { epics: c.toAck + c.overdueEpics, tasks: c.overdueTasks, github: 0 } : {}} />}
      right={
        <>
          {running && (
            <span className="hidden items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success md:inline-flex" title={running.title}>
              <TimerIcon className="size-3.5" />
              <span className="max-w-40 truncate">{running.title}</span>
              <LiveTimer base={running.elapsed_seconds} since={running.running_since} />
            </span>
          )}
          <Button size="icon-sm" variant="ghost" title="Refresh" onClick={() => qc.invalidateQueries()} disabled={isFetching}>
            <RefreshCwIcon className={cn(isFetching && 'animate-spin')} />
          </Button>
          <span className="hidden text-sm text-muted-foreground sm:inline">{status.raja.name}</span>
        </>
      }
    >
      {status.update.available && (
        <Alert className="mb-4">
          <AlertTitle>Update available: version {status.update.latest}</AlertTitle>
          <AlertDescription className="w-full space-y-2">
            <p>One click: it installs, restarts in a new window, and this page reloads.</p>
            <UpdateNow update={status.update} />
          </AlertDescription>
        </Alert>
      )}
      {status.github.error && page !== 'github' && page !== 'account' && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>GitHub needs a new token</AlertTitle>
          <AlertDescription>{status.github.error} Open the GitHub page to paste one.</AlertDescription>
        </Alert>
      )}
      {error && <p className="text-sm text-destructive">Could not load your work: {error.message}</p>}
      {!w && !error && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}
      {w && <PageBody page={page} w={w} status={status} />}
    </Shell>
  )
}

function PageBody({ page, w, status }: { page: Page; w: Work; status: Status }) {
  switch (page) {
    case 'epics':
      return <EpicsPage w={w} />
    case 'tasks':
      return <TasksPage w={w} />
    case 'github':
      return <GithubPage w={w} status={status} />
    case 'account':
      return <AccountPage status={status} />
    default:
      return <TodayPage w={w} />
  }
}

const PAGES: { key: Page; label: string; icon: typeof LayoutDashboardIcon }[] = [
  { key: 'today', label: 'Today', icon: LayoutDashboardIcon },
  { key: 'epics', label: 'Epics', icon: SquareKanbanIcon },
  { key: 'tasks', label: 'Tasks', icon: ListTodoIcon },
  { key: 'github', label: 'GitHub', icon: GitPullRequestIcon },
  { key: 'account', label: 'Account', icon: CircleUserRoundIcon },
]

function Nav({ page, badges }: { page: Page; badges: Partial<Record<Page, number>> }) {
  return (
    <DeskContext.Consumer>
      {({ go }) => (
        <nav className="flex gap-1 overflow-x-auto">
          {PAGES.map(({ key, label, icon: Icon }) => (
            <Button key={key} size="sm" variant={page === key ? 'secondary' : 'ghost'} onClick={() => go(key)} aria-current={page === key ? 'page' : undefined}>
              <Icon /> {label}
              {!!badges[key] && <span className="rounded-full bg-destructive/15 px-1.5 text-[11px] font-semibold text-destructive tabular-nums">{badges[key]}</span>}
            </Button>
          ))}
        </nav>
      )}
    </DeskContext.Consumer>
  )
}

function Shell({ children, nav, right }: { children: React.ReactNode; nav?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <h1 className="font-heading font-semibold whitespace-nowrap">
            Raja Desk <span className="text-muted-foreground">· Dev</span>
          </h1>
          <div className="order-last w-full sm:order-none sm:w-auto">{nav}</div>
          <div className="ml-auto flex items-center gap-2">
            {right}
            <ModeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">{children}</main>
    </div>
  )
}
