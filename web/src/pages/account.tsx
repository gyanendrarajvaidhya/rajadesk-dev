import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CopyIcon, KeyRoundIcon, LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { d10 } from '@/lib/format'
import type { Status } from '@/lib/types'
import { GithubConnect } from '@/components/connect'
import { ConfirmButton } from '@/components/confirm-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Raja + GitHub sign-ins and the installed version, all changeable from here. */
export function AccountPage({ status }: { status: Status }) {
  const qc = useQueryClient()
  const [replacing, setReplacing] = useState(false)
  const post = async (path: string, done: string) => {
    try {
      await api(path, {})
      toast.success(done)
      await qc.invalidateQueries()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const g = status.github
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Raja</CardTitle>
          <CardDescription>
            Signed in as {status.raja.name} ({status.raja.email}). Play, pause and status changes are saved in Raja under your name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmButton variant="outline" confirmLabel="Confirm: sign out of Raja" onConfirm={() => post('/api/raja/logout', 'Signed out of Raja')}>
            <LogOutIcon /> Sign out
          </ConfirmButton>
        </CardContent>
      </Card>
      {g.connected && !replacing ? (
        <Card>
          <CardHeader>
            <CardTitle>GitHub</CardTitle>
            <CardDescription>
              Connected as {g.login} since {d10(g.savedAt)}. Token scopes: {g.scopes?.length ? g.scopes.join(', ') : 'fine-grained token'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-row flex-wrap gap-2">
            <Button variant="outline" onClick={() => setReplacing(true)}>
              <KeyRoundIcon /> Paste a new token
            </Button>
            <ConfirmButton variant="ghost" confirmLabel="Confirm: disconnect" onConfirm={() => post('/api/github/disconnect', 'GitHub disconnected')}>
              Disconnect
            </ConfirmButton>
          </CardContent>
        </Card>
      ) : (
        <GithubConnect status={g} newTokenUrl={status.newTokenUrl} onDone={() => setReplacing(false)} />
      )}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Version {status.update.current}</CardTitle>
          <CardDescription>
            {status.update.available
              ? `Version ${status.update.latest} is out. Run this in a terminal, then start rajadesk --dev again:`
              : status.update.latest
                ? 'You have the latest version. To reinstall:'
                : 'To update, run this in a terminal, then start rajadesk --dev again:'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpdateCommand command={status.update.command} />
        </CardContent>
      </Card>
    </div>
  )
}

export function UpdateCommand({ command }: { command: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-sm">
      <span className="min-w-0 flex-1 truncate">{command}</span>
      <Button
        size="icon-xs"
        variant="ghost"
        title="Copy"
        onClick={() => navigator.clipboard.writeText(command).then(() => toast.success('Copied'))}
      >
        <CopyIcon />
      </Button>
    </div>
  )
}
