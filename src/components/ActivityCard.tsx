import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { ACTIVITY_INFO } from '../lib/types'
import { Button } from './ui'

const INFO = ACTIVITY_INFO.bouldering

/**
 * Minimal bouldering logger for a given day: one tap to log, optional duration
 * and note. Counts toward consistency and Back/Arms/Core coverage.
 */
export function ActivityCard({ date }: { date: string }) {
  const existing = useLiveQuery(
    async () =>
      // Coalesce to null so "no session yet" (null) is distinct from the
      // loading state (undefined) — otherwise the log button never shows.
      (await db.activities
        .where('date')
        .equals(date)
        .and((a) => a.type === 'bouldering')
        .first()) ?? null,
    [date],
  )
  const [editing, setEditing] = useState(false)

  if (existing === undefined) return null // still loading

  if (!existing && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/50 py-3 text-sm font-medium text-muted active:bg-surface-2"
      >
        {INFO.icon} Log bouldering
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">
            {INFO.icon} {INFO.label}
          </h2>
          <p className="text-xs text-muted">
            Counts as {INFO.categories.join(', ')}
          </p>
        </div>
        {existing && !editing && (
          <button
            onClick={() => {
              if (confirm('Remove this bouldering session?'))
                db.activities.delete(existing.id!)
            }}
            className="text-sm text-muted active:text-danger"
            aria-label="Delete bouldering session"
          >
            ✕
          </button>
        )}
      </div>

      {editing ? (
        <BoulderForm
          date={date}
          id={existing?.id}
          initialDuration={existing?.durationMin}
          initialNote={existing?.note}
          onDone={() => setEditing(false)}
        />
      ) : (
        existing && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-muted">
              {existing.durationMin ? `${existing.durationMin} min` : 'Logged'}
              {existing.note ? ` · ${existing.note}` : ''}
            </p>
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-accent active:opacity-70"
            >
              Edit
            </button>
          </div>
        )
      )}
    </div>
  )
}

function BoulderForm({
  date,
  id,
  initialDuration,
  initialNote,
  onDone,
}: {
  date: string
  id?: number
  initialDuration?: number
  initialNote?: string
  onDone: () => void
}) {
  const [duration, setDuration] = useState(
    initialDuration ? String(initialDuration) : '',
  )
  const [note, setNote] = useState(initialNote ?? '')

  async function save() {
    const dur = parseInt(duration, 10)
    const payload = {
      durationMin: Number.isFinite(dur) && dur > 0 ? dur : undefined,
      note: note.trim() || undefined,
    }
    if (id != null) await db.activities.update(id, payload)
    else
      await db.activities.add({
        type: 'bouldering',
        date,
        createdAt: Date.now(),
        ...payload,
      })
    onDone()
  }

  return (
    <div className="mt-3 space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Duration (min, optional)
        </span>
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          inputMode="numeric"
          placeholder="e.g. 90"
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-base tabular-nums outline-none focus:border-accent"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Note (optional)
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. project send, felt strong"
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={save}>
          {id != null ? 'Save' : 'Log session'}
        </Button>
        <Button variant="ghost" onClick={onDone} className="px-4">
          Cancel
        </Button>
      </div>
    </div>
  )
}
