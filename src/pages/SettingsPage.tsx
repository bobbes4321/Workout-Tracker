import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { exportData, importData } from '../lib/backup'
import { Button, Card, PageHeader } from '../components/ui'

export function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const counts = useLiveQuery(async () => {
    const [exercises, sets, goals] = await Promise.all([
      db.exercises.where('archived').notEqual(1).count(),
      db.sets.count(),
      db.goals.count(),
    ])
    return { exercises, sets, goals }
  }, [])

  async function onImportFile(file: File) {
    if (
      !confirm(
        'Importing replaces ALL current data with the contents of this file. Continue?',
      )
    )
      return
    try {
      const r = await importData(file)
      setMsg(`Imported ${r.sets} sets, ${r.exercises} exercises, ${r.goals} goals.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Backup & manage your data" />

      <Card className="mb-4">
        <h2 className="mb-1 font-bold">Backup</h2>
        <p className="mb-3 text-sm text-muted">
          Your data lives only on this device. Export regularly so you never
          lose it — the file is also how you move to a new phone.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => exportData()}>⬇ Export</Button>
          <Button variant="surface" onClick={() => fileRef.current?.click()}>
            ⬆ Import
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImportFile(f)
            e.target.value = ''
          }}
        />
        {msg && <p className="mt-3 text-sm text-accent">{msg}</p>}
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 font-bold">Your data</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Count label="Exercises" value={counts?.exercises} />
          <Count label="Sets" value={counts?.sets} />
          <Count label="Goals" value={counts?.goals} />
        </div>
      </Card>

      <ExerciseManager />

      <Card className="mt-4">
        <h2 className="mb-1 font-bold">Install</h2>
        <p className="text-sm text-muted">
          For an app-like experience, open this page in your phone browser and
          choose <span className="text-text">“Add to Home Screen”</span>. It
          will run fullscreen and work offline.
        </p>
      </Card>
    </div>
  )
}

function Count({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl bg-surface-2 py-3">
      <p className="text-xl font-bold tabular-nums">{value ?? '–'}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

function ExerciseManager() {
  const exercises = useLiveQuery(
    () => db.exercises.orderBy('name').toArray(),
    [],
  )
  const active = (exercises ?? []).filter((e) => e.archived !== 1)

  async function rename(id: number, currentName: string) {
    const name = prompt('Rename exercise', currentName)?.trim()
    if (name && name !== currentName) await db.exercises.update(id, { name })
  }

  async function archive(id: number, name: string) {
    if (
      confirm(
        `Hide “${name}”? It stays out of pickers but your logged history is kept.`,
      )
    ) {
      await db.exercises.update(id, { archived: 1 })
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-bold">Exercises</h2>
      <div className="divide-y divide-border/60">
        {active.map((e) => (
          <div key={e.id} className="flex items-center gap-2 py-2.5">
            <div className="flex-1">
              <p className="text-sm font-medium">{e.name}</p>
              <p className="text-xs text-muted">{e.category}</p>
            </div>
            <button
              onClick={() => rename(e.id!, e.name)}
              className="rounded-lg px-2 py-1 text-xs text-muted hover:text-text"
            >
              Rename
            </button>
            <button
              onClick={() => archive(e.id!, e.name)}
              className="rounded-lg px-2 py-1 text-xs text-muted hover:text-danger"
            >
              Hide
            </button>
          </div>
        ))}
        {active.length === 0 && (
          <p className="py-3 text-sm text-muted">No exercises.</p>
        )}
      </div>
    </Card>
  )
}
