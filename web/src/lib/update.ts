import { useSyncExternalStore } from 'react'

// While the server reinstalls itself and restarts, every API call fails for a few seconds. This store lets the page show
// "Updating…" instead of "can't reach the server", and reloads once the new version answers.
let restarting: string | null = null // the version we are updating away from (shown on the waiting screen)
const subs = new Set<() => void>()
const set = (v: string | null) => {
  restarting = v
  subs.forEach((s) => s())
}
export const useRestarting = () => useSyncExternalStore((l) => (subs.add(l), () => subs.delete(l)), () => restarting)

/**
 * Started right after "Update now": polls /api/ping until a new server process answers, then reloads the page. Gives up
 * (back to the normal page, which shows the error) if this server reports the install failed, or after 3 minutes.
 */
export async function waitForRestart(fromVersion: string, fromPid: number) {
  if (restarting) return
  set(fromVersion)
  const until = Date.now() + 3 * 60 * 1000
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 1500))
    try {
      const r = await fetch('/api/ping', { cache: 'no-store' })
      const j = await r.json()
      if (j.pid && j.pid !== fromPid) break
      if (j.pid === fromPid && j.update === 'failed') return set(null)
    } catch {
      // server is restarting
    }
  }
  location.reload()
}
