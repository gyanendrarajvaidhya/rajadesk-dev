import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Date input backed by a "YYYY-MM-DD" string (empty = no date). */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  size = 'default',
  id,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  size?: 'xs' | 'sm' | 'default'
  id?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const date = value ? new Date(`${value}T00:00:00`) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" size={size} className={cn('justify-start font-normal', !date && 'text-muted-foreground', className)}>
          <CalendarIcon />
          {date ? format(date, 'd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            if (!d) return
            onChange(format(d, 'yyyy-MM-dd'))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
