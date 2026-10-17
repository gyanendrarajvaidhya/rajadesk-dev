import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CopyIcon, DownloadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { waitForRestart } from '@/lib/update'
import type { Status } from '@/lib/types'
import { AsyncButton } from '@/components/async-button'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * One click: the server runs the npm install itself, restarts in a new window, and this page reloads on the new version.
 * The command stays visible (copy button) as the fallback.
 */
export function UpdateNow({ update, label = 'Update now' }: { update: Status['update']; label?: string }) {
  const qc = useQueryClient()
  useEffect(() => {
    if (update.state === 'restarting') void waitForRestart(update.current, update.pid)
  }, [update.state, update.current, update.pid])

  const run = async () => {
    try {
      await api('/api/update', {})
      void waitForRestart(update.current, update.pid)
      await qc.invalidateQueries({ queryKey: ['status'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-2">
      {update.sourceCopy ? (
        <p className="text-sm text-muted-foreground">This is a source copy (git): update it with git pull.</p>
      ) : update.state === 'installing' || update.state === 'restarting' ? (
        <p className="flex items-center gap-2 text-sm">
          <Spinner />
          {update.state === 'installing' ? 'Downloading and installing the new version…' : 'Restarting Raja Desk Dev in a new window…'}
        </p>
      ) : (
        <AsyncButton onClick={run}>
          <DownloadIcon /> {label}
        </AsyncButton>
      )}
      {update.state === 'failed' && update.error && <p className="text-sm text-destructive">{update.error}</p>}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Or run it in a terminal</summary>
        <CommandLine command={update.command} />
      </details>
    </div>
  )
}

export function CommandLine({ command }: { command: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
      <span className="min-w-0 flex-1 break-all">{command}</span>
      <Button size="icon-xs" variant="ghost" title="Copy" onClick={() => navigator.clipboard.writeText(command).then(() => toast.success('Copied'))}>
        <CopyIcon />
      </Button>
    </div>
  )
}
