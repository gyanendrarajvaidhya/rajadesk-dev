import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

type ConfirmButtonProps = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  /** Runs on the second click. The button shows a spinner while its promise is pending. */
  onConfirm: () => unknown
  /** Label shown after the first click. */
  confirmLabel?: ReactNode
  /** How long the armed state lasts before it reverts. */
  timeoutMs?: number
}

// Two-click confirm for writes. The first click arms it ("Confirm …") and the second click runs it.
// It disarms by itself after a few seconds, which makes it lighter than a dialog for frequent actions.
export function ConfirmButton({
  onConfirm,
  confirmLabel = 'Confirm',
  timeoutMs = 4000,
  children,
  variant,
  disabled,
  className,
  ...props
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), timeoutMs)
    return () => clearTimeout(t)
  }, [armed, timeoutMs])

  async function click() {
    if (!armed) return setArmed(true)
    setArmed(false)
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      {...props}
      variant={armed && variant !== 'destructive' ? 'default' : variant}
      data-armed={armed || undefined}
      disabled={disabled || busy}
      onClick={click}
      className={cn(armed && 'ring-3 ring-ring/40', className)}
    >
      {busy && <Spinner />}
      {armed ? confirmLabel : children}
    </Button>
  )
}
