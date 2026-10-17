import { useSyncExternalStore } from 'react'

// One shared 1-second clock for every live timer on the page.
let now = Date.now()
const subs = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(fn: () => void) {
  subs.add(fn)
  timer ??= setInterval(() => {
    now = Date.now()
    subs.forEach((s) => s())
  }, 1000)
  return () => {
    subs.delete(fn)
    if (!subs.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** Current time in ms, re-rendering the caller every second. */
export const useNow = () => useSyncExternalStore(subscribe, () => now)
