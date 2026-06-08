import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from './ui'

interface ConfirmOpts {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface PromptOpts {
  title: string
  message?: string
  label?: string
  initial?: string
  placeholder?: string
  inputMode?: 'numeric' | 'decimal' | 'text'
  confirmLabel?: string
}

type Active =
  | ({ kind: 'confirm' } & ConfirmOpts)
  | ({ kind: 'prompt' } & PromptOpts)

interface DialogApi {
  confirm: (o: ConfirmOpts) => Promise<boolean>
  prompt: (o: PromptOpts) => Promise<string | null>
}

const Ctx = createContext<DialogApi | null>(null)

export function useDialog(): DialogApi {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDialog must be used within <DialogProvider>')
  return c
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null)
  const [value, setValue] = useState('')
  const resolver = useRef<((v: boolean | string | null) => void) | null>(null)

  const close = useCallback((result: boolean | string | null) => {
    resolver.current?.(result)
    resolver.current = null
    setActive(null)
  }, [])

  const confirm = useCallback(
    (o: ConfirmOpts) =>
      new Promise<boolean>((res) => {
        resolver.current = res as (v: boolean | string | null) => void
        setActive({ kind: 'confirm', ...o })
      }),
    [],
  )

  const prompt = useCallback(
    (o: PromptOpts) =>
      new Promise<string | null>((res) => {
        resolver.current = res as (v: boolean | string | null) => void
        setValue(o.initial ?? '')
        setActive({ kind: 'prompt', ...o })
      }),
    [],
  )

  const cancelValue = active?.kind === 'confirm' ? false : null
  const isDanger = active?.kind === 'confirm' && active.danger

  return (
    <Ctx.Provider value={{ confirm, prompt }}>
      {children}
      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => close(cancelValue)}
          >
            <motion.div
              className="w-full max-w-md space-y-4 rounded-t-3xl border border-border bg-surface p-5"
              style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h2 className="text-lg font-bold">{active.title}</h2>
                {active.message && (
                  <p className="mt-1 text-sm text-muted">{active.message}</p>
                )}
              </div>

              {active.kind === 'prompt' && (
                <label className="block">
                  {active.label && (
                    <span className="mb-1 block text-xs font-medium text-muted">
                      {active.label}
                    </span>
                  )}
                  <input
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    inputMode={active.inputMode ?? 'text'}
                    placeholder={active.placeholder}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') close(value)
                    }}
                    className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base outline-none focus:border-accent"
                  />
                </label>
              )}

              <div className="flex gap-2">
                <Button
                  variant="surface"
                  className="flex-1"
                  onClick={() => close(cancelValue)}
                >
                  {(active.kind === 'confirm' && active.cancelLabel) || 'Cancel'}
                </Button>
                <Button
                  variant="primary"
                  className={`flex-1 ${isDanger ? '!bg-danger !text-white hover:!bg-danger/90' : ''}`}
                  onClick={() =>
                    close(active.kind === 'confirm' ? true : value)
                  }
                >
                  {active.confirmLabel ??
                    (active.kind === 'confirm' ? 'Confirm' : 'Save')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}
