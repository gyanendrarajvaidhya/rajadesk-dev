import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon, GitPullRequestIcon, KeyRoundIcon, LogInIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Status } from '@/lib/types'
import { useNow } from '@/hooks/use-now'
import { AsyncButton } from '@/components/async-button'
import { CommandLine } from '@/components/update-now'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

/** Raja sign-in: opens Raja's own Katyayani SSO page in a separate browser window, no terminal needed. */
export function RajaSignIn({ status }: { status: Status['raja'] }) {
  const qc = useQueryClient()
  const now = useNow()
  const post = async (path: string) => {
    try {
      await api(path, {})
      await qc.invalidateQueries({ queryKey: ['status'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  // After 20 s without a sign-in, the window may never have appeared (or be hidden behind others): offer Cancel + the terminal way.
  const slow = status.signingIn && !!status.signingInSince && now - status.signingInSince > 20_000
  const failed = status.lastLogin && !status.lastLogin.ok && !status.signingIn
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
            <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
              <p className="flex items-center gap-2">
                <Spinner /> Waiting for you to sign in in the other window…
              </p>
              <p className="text-xs text-muted-foreground">Don't see it? Look for a new Chrome or Edge icon in the taskbar: it can open behind this window.</p>
              <AsyncButton size="sm" variant="outline" onClick={() => post('/api/raja/login/cancel')}>
                <XIcon /> Cancel
              </AsyncButton>
            </div>
          ) : (
            <AsyncButton className="w-full" onClick={() => post('/api/raja/login')}>
              <LogInIcon /> {failed || status.expired || status.email ? 'Try again' : 'Sign in to Raja'}
            </AsyncButton>
          )}
          {failed && (
            <Alert variant="destructive">
              <AlertTitle>Sign-in didn't finish</AlertTitle>
              <AlertDescription>{status.lastLogin!.error}</AlertDescription>
            </Alert>
          )}
          {status.error && (
            <Alert variant="destructive">
              <AlertTitle>Signed in, but Raja said no</AlertTitle>
              <AlertDescription>{status.error}</AlertDescription>
            </Alert>
          )}
          {(failed || slow) && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Still stuck? Open a new terminal (PowerShell) and run this. It opens the same window and prints any error. Then reload this page.</p>
              <CommandLine command="rajadesk login" />
            </div>
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
