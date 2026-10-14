import { useEffect, useState } from 'react'
import { useMind } from '../store'

/** A passing message at the bottom of the screen. */
export function Toast() {
  const toast = useMind((s) => s.toast)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!toast) return
    setShown(true)
    const t = setTimeout(() => setShown(false), 4800)
    return () => clearTimeout(t)
  }, [toast])
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[35] flex justify-center px-6">
      {toast && (
        <div
          key={toast.id}
          className={`max-w-sm rounded-2xl border border-white/15 bg-black/45 px-5 py-3 text-center shadow-2xl backdrop-blur-xl transition-all duration-700 ${shown ? 'card-in opacity-100' : 'translate-y-2 opacity-0'}`}
        >
          <p className="font-display text-sm text-white">{toast.text}</p>
          {toast.sub && <p className="mt-0.5 text-xs font-light text-white/60">{toast.sub}</p>}
        </div>
      )}
    </div>
  )
}
