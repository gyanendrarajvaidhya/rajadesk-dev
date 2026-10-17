import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

declare global {
  interface Window {
    RAJA_TOKEN?: string
  }
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** 401 = Raja signed out; 409 + github_signed_out = the GitHub token stopped working. Both re-read /api/status. */
export const isSignedOut = (e: unknown) => e instanceof ApiError && e.status === 401
export const isGithubSignedOut = (e: unknown) => e instanceof ApiError && e.code === 'github_signed_out'

/** GET when body is omitted, otherwise POST with the per-run token. */
export async function api<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-raja-token': window.RAJA_TOKEN ?? '' },
          body: JSON.stringify(body),
        },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new ApiError(json.error || `HTTP ${res.status}`, res.status, json.code)
    if (isSignedOut(err) || isGithubSignedOut(err)) void queryClient.invalidateQueries({ queryKey: ['status'] })
    throw err
  }
  return json as T
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, err) => !(err instanceof ApiError && err.status < 500) && n < 1,
      refetchOnWindowFocus: true,
    },
  },
})

/**
 * Run a write, toast the result and refetch Raja data. Never throws: errors are toasted and the promise resolves to
 * undefined, so it is safe to call straight from click handlers.
 */
export function useWrite() {
  const qc = useQueryClient()
  return async function write<T = Record<string, unknown>>(
    path: string,
    body: unknown = {},
    opts: { success?: string; onError?: (e: Error) => boolean | void } = {},
  ) {
    try {
      const r = await api<T>(path, body)
      if (opts.success) toast.success(opts.success)
      await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'github' })
      return r
    } catch (e) {
      if (opts.onError?.(e as Error) !== true) toast.error((e as Error).message)
      return undefined
    }
  }
}
