import type { ComponentProps } from 'react'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/utils'
import { fmtDur, liveSeconds, type Tone } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

const VARIANT = { neutral: 'secondary', bad: 'destructive', warn: 'warning', ok: 'success', info: 'info' } as const

export function Chip({ tone = 'neutral', className, ...props }: Omit<ComponentProps<typeof Badge>, 'variant'> & { tone?: Tone }) {
  return <Badge variant={VARIANT[tone]} className={cn('max-w-full', className)} {...props} />
}

/** H:MM:SS that ticks while `since` is set (a timer is running). */
export function LiveTimer({ base, since, className }: { base: number; since?: string | null; className?: string }) {
  return since ? <Ticking base={base} since={since} className={className} /> : <span className={cn('tabular-nums', className)}>{fmtDur(base)}</span>
}
function Ticking({ base, since, className }: { base: number; since: string; className?: string }) {
  const now = useNow()
  return <span className={cn('font-medium text-success tabular-nums', className)}>{fmtDur(liveSeconds(base, since, now))}</span>
}
