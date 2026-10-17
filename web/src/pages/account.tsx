import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRoundIcon, LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { d10 } from '@/lib/format'
import type { Status } from '@/lib/types'
import { GithubConnect } from '@/components/connect'
import { UpdateNow } from '@/components/update-now'
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
              ? `Version ${status.update.latest} is out.`
              : status.update.latest
                ? 'You have the latest version.'
                : "Couldn't check for a newer version right now."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpdateNow update={status.update} label={status.update.available ? `Update to ${status.update.latest}` : 'Reinstall latest'} />
        </CardContent>
      </Card>
    </div>
  )
}
