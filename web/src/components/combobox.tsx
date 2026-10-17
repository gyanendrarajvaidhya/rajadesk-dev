import { useState } from 'react'
import { ChevronsUpDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type ComboboxOption = {
  value: string
  label: string
  /** Options sharing a group are listed under that heading, in first-seen order. */
  group?: string
  /** Extra words the search box should match. */
  keywords?: string[]
  disabled?: boolean
}

type ComboboxProps = {
  options: ComboboxOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Show the search box. Defaults to true when there are more than 8 options. */
  searchable?: boolean
  size?: 'xs' | 'sm' | 'default'
  disabled?: boolean
  id?: string
  className?: string
  contentClassName?: string
}

// A select with search, groups and keyboard navigation (Popover + Command). It flips up near the bottom edge.
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing found.',
  searchable = options.length > 8,
  size = 'default',
  disabled,
  id,
  className,
  contentClassName,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  const groups = new Map<string, ComboboxOption[]>()
  for (const o of options) groups.set(o.group ?? '', [...(groups.get(o.group ?? '') ?? []), o])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          size={size}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-(--radix-popover-trigger-width) min-w-48 p-0', contentClassName)}>
        <Command>
          {searchable && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {[...groups].map(([group, opts]) => (
              <CommandGroup key={group || '_'} heading={group || undefined}>
                {opts.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    keywords={[o.label, ...(o.keywords ?? [])]}
                    disabled={o.disabled}
                    data-checked={o.value === value}
                    onSelect={() => {
                      onValueChange(o.value)
                      setOpen(false)
                    }}
                  >
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
