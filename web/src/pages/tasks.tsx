import { useState } from 'react'
import { myTasks, upNext } from '@/lib/derive'
import type { Task, Work } from '@/lib/types'
import { TaskRow } from '@/components/task-row'
import { Card, CardContent } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const FILTERS: { key: string; label: string; test: (t: Task) => boolean }[] = [
  { key: 'open', label: 'Open', test: (t) => !['done', 'abandoned'].includes(t.status) },
  { key: 'overdue', label: 'Overdue', test: (t) => t.overdue },
  { key: 'pending', label: 'Not started', test: (t) => t.status === 'pending' },
  { key: 'review', label: 'In review', test: (t) => t.status === 'in_review' },
  { key: 'done', label: 'Done', test: (t) => t.status === 'done' },
]

/** All your tasks across every epic, with play / pause and status moves in one list. */
export function TasksPage({ w }: { w: Work }) {
  const [filter, setFilter] = useState('open')
  const all = myTasks(w)
  const f = FILTERS.find((x) => x.key === filter)!
  const ordered = filter === 'done' ? all.filter(f.test).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) : upNext(w).filter(f.test)
  return (
    <div className="space-y-3">
      <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v)}>
        {FILTERS.map((x) => (
          <ToggleGroupItem key={x.key} value={x.key}>
            {x.label} · {all.filter(x.test).length}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Card className="gap-0 py-0">
        {ordered.length ? (
          <div className="divide-y">
            {ordered.map((t) => (
              <TaskRow key={t.id} t={t} showEpic />
            ))}
          </div>
        ) : (
          <CardContent className="py-4 text-sm text-muted-foreground">No tasks here.</CardContent>
        )}
      </Card>
    </div>
  )
}
