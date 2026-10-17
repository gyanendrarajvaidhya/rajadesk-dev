import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, GitPullRequestIcon, KeyRoundIcon, LogInIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Status } from '@/lib/types'
import { AsyncButton } from '@/components/async-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

/** Raja sign-in: opens Raja's own Katyayani SSO page in a separate browser window, no terminal needed. */
export function RajaSignIn({ status }: { status: Status['raja'] }) {
  const qc = useQueryClient()
  const start = async () => {
    try {
      await api('/api/raja/login', {})
      await qc.invalidateQueries({ queryKey: ['status'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <div className="mx-auto max-w-md py-16">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogInIcon className="size-5" /> {status.expired ? 'Your Raja session expired' : 'Sign in to Raja'}
          </CardTitle>
          <CardDescription>
            A browser window opens on Raja's normal sign-in page. Sign in with your Katyayani account there. The window closes by itself and this page loads your
            work. Your session stays only on this PC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.signingIn ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <Spinner /> Waiting for you to sign in in the other window…
            </div>
          ) : (
            <AsyncButton className="w-full" onClick={start}>
              <LogInIcon /> {status.expired || status.email ? 'Sign in again' : 'Sign in to Raja'}
            </AsyncButton>
          )}
          {status.lastLogin && !status.lastLogin.ok && !status.signingIn && (
            <Alert variant="destructive">
              <AlertTitle>Sign-in didn't finish</AlertTitle>
              <AlertDescription>{status.lastLogin.error}</AlertDescription>
            </Alert>
          )}
          {status.error && (
            <Alert variant="destructive">
              <AlertTitle>Signed in, but Raja said no</AlertTitle>
              <AlertDescription>{status.error}</AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">Needs Google Chrome or Microsoft Edge installed. It uses its own window, so your normal browser tabs are untouched.</p>
        </CardContent>
      </Card>
    </div>
  )
}

/** GitHub: paste a personal access token. Shown again, with the reason, when GitHub stops accepting the saved one. */
export function GithubConnect({ status, newTokenUrl, compact, onDone }: { status: Status['github']; newTokenUrl: string; compact?: boolean; onDone?: () => void }) {
  const qc = useQueryClient()
  const [token, setToken] = useState('')
  const save = async () => {
    try {
      const r = await api<{ login: string }>('/api/github/token', { token })
      setToken('')
      toast.success(`GitHub connected as ${r.login}`)
      await qc.invalidateQueries({ queryKey: ['status'] })
      await qc.invalidateQueries({ queryKey: ['github'] })
      onDone?.()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  return (
    <Card size={compact ? 'sm' : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitPullRequestIcon className="size-5" /> {status.error ? 'Reconnect GitHub' : 'Connect GitHub'}
        </CardTitle>
        <CardDescription>
          {status.error ?? 'Shows your open PRs, review requests and pushes next to your Raja work.'} The token is saved only on this PC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <a className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2" href={newTokenUrl} target="_blank" rel="noopener">
              Open GitHub's new-token page <ExternalLinkIcon className="size-3.5" />
            </a>{' '}
            (the right boxes are already ticked: repo, read:org).
          </li>
          <li>Pick an expiry, click Generate token, copy it.</li>
          <li>Paste it here.</li>
        </ol>
        <div className="flex gap-2">
          <Input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && token.trim() && void save()}
            placeholder="ghp_… or github_pat_…"
            className="flex-1 font-mono"
          />
          <AsyncButton disabled={!token.trim()} onClick={save}>
            <KeyRoundIcon /> Save token
          </AsyncButton>
        </div>
      </CardContent>
    </Card>
  )
}
