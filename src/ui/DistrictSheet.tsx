import { useEffect, useState } from 'react'
import { DISTRICTS, MEMORIES } from '../data/mind'
import { EMOTIONS, EMOTION_INDEX } from '../lib/emotions'
import { goToDistrict } from '../lib/goto'
import { flyHome } from '../lib/nav'
import { useMind } from '../store'

const COUNT = MEMORIES.reduce<Record<string, number>>((a, m) => ((a[m.district] = (a[m.district] ?? 0) + 1), a), {})

/** Mobile: the districts (and feelings) as a bottom sheet instead of a minimap. */
export function DistrictSheet() {
  const inHall = useMind((s) => s.inHall)
  const selected = useMind((s) => s.selected)
  const district = useMind((s) => s.district)
  const filter = useMind((s) => s.filter)
  const [open, setOpen] = useState(false)
  const show = inHall && !selected

  useEffect(() => {
    if (!show) setOpen(false)
  }, [show])
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open])

  const go = (id: string | null) => {
    setOpen(false)
    if (id) goToDistrict(id)
    else flyHome()
  }

  return (
    <div className="md:hidden">
      {/* compact feelings strip + districts button */}
      <div data-ui className={`fixed bottom-4 left-4 z-30 flex items-center gap-2 transition-all duration-700 ${show ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}>
        <div className="flex items-center gap-1 rounded-full border border-white/12 bg-black/35 px-2 py-1.5 backdrop-blur-xl">
          {EMOTIONS.map((e, i) => (
            <button
              key={e.id}
              aria-label={`Show only ${e.label}`}
              aria-pressed={filter === i}
              onClick={() => useMind.getState().setFilter(filter === i ? null : i)}
              className="grid h-6 w-6 place-items-center"
            >
              <span
                className={`block rounded-full transition-all ${filter === i ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} ${filter !== null && filter !== i ? 'opacity-30' : ''}`}
                style={{ background: e.colour, boxShadow: `0 0 ${filter === i ? 12 : 6}px ${e.colour}` }}
              />
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 font-display text-[10px] tracking-[0.25em] text-white/80 uppercase backdrop-blur-xl"
        >
          <span aria-hidden>▲</span> districts
        </button>
      </div>

      {/* the sheet */}
      <div data-ui className={`fixed inset-0 z-[45] transition-opacity duration-500 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button aria-label="Close districts" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
        <div
          role="dialog"
          aria-label="Districts of the mind"
          className={`absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#0d0716]/90 px-4 pt-3 pb-8 backdrop-blur-2xl transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] ${open ? 'translate-y-0' : 'translate-y-full'}`}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
          <p className="mb-2 px-1 font-display text-[10px] tracking-[0.35em] text-white/40 uppercase">The districts</p>
          <button onClick={() => go(null)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${!district ? 'bg-white/10' : 'active:bg-white/5'}`}>
            <span className="h-3 w-3 rounded-full border border-cyan-200" />
            <span className="flex-1">
              <span className="block font-display text-sm text-white">The Control Deck</span>
              <span className="block text-xs text-white/50">Overlooking the Memory Hall</span>
            </span>
          </button>
          {DISTRICTS.map((d) => {
            const c = EMOTIONS[EMOTION_INDEX[d.emotion]].colour
            return (
              <button key={d.id} onClick={() => go(d.id)} className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${district === d.id ? 'bg-white/10' : 'active:bg-white/5'}`}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm text-white">{d.name}</span>
                  <span className="block truncate text-xs text-white/50">{d.blurb}</span>
                </span>
                <span className="text-xs text-white/35 tabular-nums">{COUNT[d.id] ?? 0}</span>
              </button>
            )
          })}
          <p className="mt-5 mb-2 px-1 font-display text-[10px] tracking-[0.35em] text-white/40 uppercase">Feelings</p>
          <div className="flex flex-wrap gap-2 px-1">
            {EMOTIONS.map((e, i) => (
              <button
                key={e.id}
                onClick={() => useMind.getState().setFilter(filter === i ? null : i)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${filter === i ? 'border-white/40 bg-white/10 text-white' : 'border-white/12 text-white/70'}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: e.colour }} />
                {e.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
