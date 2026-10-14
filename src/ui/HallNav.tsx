import { useEffect } from 'react'
import { districtById, memoryById } from '../data/mind'
import { flyHome } from '../lib/nav'
import { useMind } from '../store'

/** In-hall navigation chrome: back to the deck, browsing hints, deep links. */
export function HallNav() {
  const inHall = useMind((s) => s.inHall)
  const section = useMind((s) => s.section)
  const district = useMind((s) => s.district)
  const place = section ?? district
  const selected = useMind((s) => s.selected)
  const phase = useMind((s) => s.phase)

  // #m/<id> opens a memory directly
  useEffect(() => {
    if (phase !== 'ready') return
    const id = location.hash.match(/^#m\/(.+)$/)?.[1]
    if (id && memoryById[id]) useMind.getState().open(id, null)
  }, [phase])

  useEffect(() => {
    if (!place) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && !useMind.getState().selected && flyHome()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [place])

  const show = inHall && !selected
  return (
    <>
      <div className={`pointer-events-none fixed inset-x-0 top-14 z-10 flex justify-center transition-all duration-700 ${show && place ? 'opacity-100' : '-translate-y-2 opacity-0'}`}>
        <button
          data-ui
          onClick={() => flyHome()}
          className={`flex items-center gap-3 rounded-full border border-white/20 bg-black/30 px-4 py-2 font-display text-[11px] tracking-[0.25em] text-white/80 uppercase backdrop-blur-md transition hover:border-white/50 hover:text-white ${show && place ? 'pointer-events-auto' : ''}`}
        >
          <span aria-hidden>←</span> back to the deck
          {place && <span className="text-white/40">· {districtById[place]?.name}</span>}
        </button>
      </div>
      <p
        className={`pointer-events-none fixed inset-x-0 bottom-6 z-10 hidden px-6 text-center font-display sm:block text-[10px] tracking-[0.3em] text-white/45 uppercase transition-opacity delay-700 duration-1000 ${show && !place ? 'opacity-100' : 'opacity-0'}`}
      >
        drag to look around · pick a shelf or a district · ride a pathway
      </p>
    </>
  )
}
