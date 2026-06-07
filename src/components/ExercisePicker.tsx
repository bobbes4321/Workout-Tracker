import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { CATEGORIES } from '../lib/types'
import { Button, Pill } from './ui'

export function ExercisePicker({
  onPick,
  onClose,
  allowCreate = true,
}: {
  onPick: (exerciseId: number) => void
  onClose: () => void
  allowCreate?: boolean
}) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newCategory, setNewCategory] = useState<string>('Chest')

  const exercises = useLiveQuery(
    () => db.exercises.orderBy('name').toArray(),
    [],
  )

  const filtered = useMemo(() => {
    const list = (exercises ?? []).filter((e) => e.archived !== 1)
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter((e) => e.name.toLowerCase().includes(q))
  }, [exercises, query])

  const exactMatch = (exercises ?? []).some(
    (e) => e.name.toLowerCase() === query.trim().toLowerCase(),
  )

  async function createExercise() {
    const name = query.trim()
    if (!name) return
    const id = await db.exercises.add({
      name,
      category: newCategory,
      unit: 'kg',
      createdAt: Date.now(),
      archived: 0,
    })
    onPick(id as number)
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-lg font-bold">Pick exercise</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-muted hover:text-text"
          >
            ×
          </button>
        </div>

        <div className="px-4 pb-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCreating(false)
            }}
            placeholder="Search or type a new name…"
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filtered.map((e) => (
            <button
              key={e.id}
              onClick={() => onPick(e.id!)}
              className="flex w-full items-center justify-between border-b border-border/60 py-3 text-left last:border-0"
            >
              <span className="font-medium">{e.name}</span>
              <span className="text-xs text-muted">{e.category}</span>
            </button>
          ))}

          {allowCreate && query.trim() && !exactMatch && (
            <div className="mt-3 rounded-xl border border-dashed border-border p-3">
              {!creating ? (
                <Button
                  variant="surface"
                  className="w-full"
                  onClick={() => setCreating(true)}
                >
                  + Create “{query.trim()}”
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Category for “{query.trim()}”
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <Pill
                        key={c}
                        active={newCategory === c}
                        onClick={() => setNewCategory(c)}
                      >
                        {c}
                      </Pill>
                    ))}
                  </div>
                  <Button className="w-full" onClick={createExercise}>
                    Add exercise
                  </Button>
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 && !query.trim() && (
            <p className="py-6 text-center text-sm text-muted">
              No exercises yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
