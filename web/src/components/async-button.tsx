import { useState, type ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/** A button that shows a spinner and disables itself while its async click handler runs. */
export function AsyncButton({ onClick, children, ...props }: Omit<ComponentProps<typeof Button>, 'onClick'> & { onClick: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      {...props}
      disabled={props.disabled || busy}
      onClick={async () => {
        setBusy(true)
        try {
          await onClick()
        } finally {
          setBusy(false)
        }
      }}
    >
      {busy && <Spinner />}
      {children}
    </Button>
  )
}
