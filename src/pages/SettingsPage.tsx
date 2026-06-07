import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { clearAllData, db } from '../lib/db'
import type { Exercise } from '../lib/types'
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

      <Card className="mt-4 border-danger/30">
        <h2 className="mb-1 font-bold text-danger">Danger zone</h2>
        <p className="mb-3 text-sm text-muted">
          Permanently delete every session, goal, and exercise and start from a
          clean slate. Export a backup first if you might want it back.
        </p>
        <Button
          variant="danger"
          className="w-full border border-danger/40"
          onClick={async () => {
            if (!confirm('Delete ALL your data? This cannot be undone.')) return
            if (!confirm('Last chance — really clear everything?')) return
            await clearAllData()
            setMsg('All data cleared. Starter exercises restored.')
          }}
        >
          Clear all data
        </Button>
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

  return (
    <Card>
      <h2 className="mb-1 font-bold">Exercises</h2>
      <p className="mb-2 text-xs text-muted">
        Add setup notes (safety-bar heights, seat/pin positions) — they show on
        the Log screen.
      </p>
      <div className="divide-y divide-border/60">
        {active.map((e) => (
          <ExerciseRow key={e.id} exercise={e} />
        ))}
        {active.length === 0 && (
          <p className="py-3 text-sm text-muted">No exercises.</p>
        )}
      </div>
    </Card>
  )
}

function ExerciseRow({ exercise: e }: { exercise: Exercise }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(e.setup ?? '')

  async function rename() {
    const name = prompt('Rename exercise', e.name)?.trim()
    if (name && name !== e.name) await db.exercises.update(e.id!, { name })
  }

  async function archive() {
    if (
      confirm(
        `Hide “${e.name}”? It stays out of pickers but your logged history is kept.`,
      )
    ) {
      await db.exercises.update(e.id!, { archived: 1 })
    }
  }

  async function saveSetup() {
    await db.exercises.update(e.id!, { setup: draft.trim() })
    setEditing(false)
  }

  return (
    <div className="py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{e.name}</p>
          <p className="text-xs text-muted">{e.category}</p>
        </div>
        <button
          onClick={() => {
            setDraft(e.setup ?? '')
            setEditing((v) => !v)
          }}
          className="rounded-lg px-2 py-1 text-xs text-muted active:text-text"
        >
          {e.setup ? 'Setup ✎' : 'Setup +'}
        </button>
        <button
          onClick={rename}
          className="rounded-lg px-2 py-1 text-xs text-muted active:text-text"
        >
          Rename
        </button>
        <button
          onClick={archive}
          className="rounded-lg px-2 py-1 text-xs text-muted active:text-danger"
        >
          Hide
        </button>
      </div>

      {!editing && e.setup && (
        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          {e.setup}
        </p>
      )}

      {editing && (
        <div className="mt-2 space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            rows={2}
            placeholder="e.g. Safety pins: hole 6 · Seat: 3"
            className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <Button onClick={saveSetup} className="px-3 py-1.5 text-xs">
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
