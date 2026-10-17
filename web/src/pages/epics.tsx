import { useState } from 'react'
import { SearchIcon } from 'lucide-react'
import { BUCKETS, bucketOf, type Bucket } from '@/lib/derive'
import type { Epic, Work } from '@/lib/types'
import { Combobox } from '@/components/combobox'
import { EpicCard } from '@/components/epic-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const ALL = '__all'

/** Every epic given to you, in one place: New / Overdue / In progress / In review / Done. */
export function EpicsPage({ w }: { w: Work }) {
  const [bucket, setBucket] = useState<Bucket | 'all'>('all')
  const [project, setProject] = useState(ALL)
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const matches = (e: Epic) =>
    (project === ALL || e.project === project) &&
    (!needle || `${e.human_id} ${e.title} ${e.project} ${e.tasks.map((t) => t.title).join(' ')} ${e.tickets.map((t) => t.human_id).join(' ')}`.toLowerCase().includes(needle))
  const shown = w.epics.filter(matches)
  const groups = BUCKETS.map((b) => ({
    ...b,
    epics: shown
      .filter((e) => bucketOf(e, w.today) === b.key)
      .sort((a, b2) => String(a.deadline ?? '9').localeCompare(String(b2.deadline ?? '9'))),
  }))
  const projects = [...new Set(w.epics.map((e) => e.project))].sort()
  const doneCount = groups.find((g) => g.key === 'done')?.epics.length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" value={bucket} onValueChange={(v) => v && setBucket(v as Bucket | 'all')}>
          <ToggleGroupItem value="all">All · {shown.length}</ToggleGroupItem>
          {groups.map((g) => (
            <ToggleGroupItem key={g.key} value={g.key}>
              {g.label} · {g.epics.length}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Combobox
          size="sm"
          options={[{ value: ALL, label: 'All projects' }, ...projects.map((p) => ({ value: p, label: p }))]}
          value={project}
          onValueChange={setProject}
          className="w-40"
        />
        <InputGroup className="h-8 min-w-52 flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search epics, tasks, tickets…" />
        </InputGroup>
      </div>
      {groups
        // "All" keeps finished epics out of the way; the button below shows them.
        .filter((g) => (bucket === 'all' ? g.key !== 'done' : g.key === bucket))
        .filter((g) => g.epics.length || bucket === g.key)
        .map((g) => (
          <section key={g.key} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {g.label} · {g.epics.length}
            </h2>
            {g.epics.length ? (
              g.epics.map((e) => <EpicCard key={e.id} e={e} />)
            ) : (
              <Card>
                <CardContent className="py-3 text-sm text-muted-foreground">Nothing here.</CardContent>
              </Card>
            )}
          </section>
        ))}
      {bucket === 'all' && doneCount > 0 && (
        <Button variant="outline" size="sm" onClick={() => setBucket('done')}>
          Show {doneCount} finished in the last 14 days
        </Button>
      )}
      {!shown.length && (
        <Card>
          <CardContent className="py-4 text-center text-sm text-muted-foreground">No epics match.</CardContent>
        </Card>
      )}
    </div>
  )
}
