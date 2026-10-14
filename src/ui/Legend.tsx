import { EMOTIONS } from '../lib/emotions'
import { sound } from '../lib/sound'
import { useMind } from '../store'

/** Emotion legend: click a feeling to see only the memories that carry it. */
export function Legend() {
  const inHall = useMind((s) => s.inHall)
  const selected = useMind((s) => s.selected)
  const filter = useMind((s) => s.filter)
  const show = inHall && !selected
  return (
    <div data-ui className={`fixed bottom-5 left-4 z-20 hidden transition-all duration-700 md:block ${show ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}>
      <div className="rounded-2xl border border-white/12 bg-black/30 p-2 backdrop-blur-xl">
        <p className="flex items-center justify-between gap-4 px-2 pt-1 pb-1.5 font-display text-[9px] tracking-[0.3em] text-white/40 uppercase">
          feelings
          {filter !== null && (
            <button onClick={() => useMind.getState().setFilter(null)} className="tracking-[0.2em] text-white/60 normal-case hover:text-white">
              show all
            </button>
          )}
        </p>
        <ul className="grid grid-cols-2 gap-0.5 sm:grid-cols-1">
          {EMOTIONS.map((e, i) => {
            const on = filter === i
            const dim = filter !== null && !on
            return (
              <li key={e.id}>
                <button
                  onClick={() => {
                    useMind.getState().setFilter(on ? null : i)
                    sound.chime(e.note, 0.8)
                  }}
                  title={e.means}
                  aria-pressed={on}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-all ${on ? 'bg-white/10' : 'hover:bg-white/5'} ${dim ? 'opacity-40' : ''}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125" style={{ background: e.colour, boxShadow: `0 0 ${on ? 14 : 8}px ${e.colour}` }} />
                  <span className="font-display text-[11px] tracking-wide text-white/85">{e.label}</span>
                  <span className="hidden max-w-0 overflow-hidden text-[11px] whitespace-nowrap text-white/40 transition-all duration-500 group-hover:max-w-[180px] sm:inline">{e.means}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
