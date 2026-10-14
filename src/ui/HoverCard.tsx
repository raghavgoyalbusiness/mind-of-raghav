import { useEffect, useRef } from 'react'
import { CORE_MEMORIES, districtById, memoryById } from '../data/mind'
import { travelFromCore } from '../three/ControlDeck'
import { EMOTIONS, EMOTION_INDEX } from '../lib/emotions'
import { openMemory, screenCircle } from '../lib/memoryActions'
import { rt } from '../lib/runtime'
import { useMind } from '../store'

export const STATUS_LABEL = { shipped: 'Shipped', building: 'Building', idea: 'Idea' } as const

/** Soft glass card that follows the hovered orb. */
export function HoverCard() {
  const hovered = useMind((s) => s.hovered)
  const selected = useMind((s) => s.selected)
  const card = useRef<HTMLDivElement>(null)
  const m = hovered ? memoryById[hovered] : null
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  useEffect(() => {
    if (!hovered) return
    let raf = 0
    const loop = () => {
      const el = card.current
      const c = screenCircle(rt.hoverWorld, rt.hoverRadius)
      if (el && c) {
        const w = el.offsetWidth
        const h = el.offsetHeight
        const right = c.x + c.r + 18 + w < window.innerWidth - 12
        const x = right ? c.x + c.r + 18 : c.x - c.r - 18 - w
        const y = Math.min(Math.max(c.y - h / 2, 12), window.innerHeight - h - 12)
        el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [hovered])

  if (!m || selected) return null
  const emo = EMOTIONS[EMOTION_INDEX[m.emotion]]
  const district = districtById[m.district]
  // core memories on the pedestal are portals to their districts
  const portal = rt.hoverOwner === 'core'

  return (
    <div ref={card} className="pointer-events-none fixed top-0 left-0 z-20" style={{ transform: 'translate3d(-999px,-999px,0)' }}>
      <div
        key={m.id}
        data-ui
        onClick={() => (portal ? travelFromCore(CORE_MEMORIES.findIndex((c) => c.id === m.id)) : openMemory(m.id, rt.hoverRadius, rt.hoverWorld.clone()))}
        className={`card-in w-[min(300px,78vw)] rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-xl ${touch ? 'pointer-events-auto' : ''}`}
        style={{ boxShadow: `0 10px 40px -10px ${emo.colour}66, inset 0 1px 0 rgba(255,255,255,0.12)` }}
      >
        <div className="mb-2 flex items-center gap-2 font-display text-[10px] tracking-[0.22em] text-white/55 uppercase">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: emo.colour, boxShadow: `0 0 8px ${emo.colour}` }} />
          {emo.label}
          <span className="text-white/25">·</span>
          {district?.name}
          <span className="ml-auto rounded-full border border-white/15 px-2 py-0.5 text-[9px] tracking-[0.16em] text-white/60">{STATUS_LABEL[m.status]}</span>
        </div>
        <h3 className="font-display text-lg leading-tight font-medium text-white">{m.title}</h3>
        <p className="mt-1 text-[13px] leading-snug font-light text-white/70">{m.oneLiner}</p>
        <p className="mt-3 font-display text-[9px] tracking-[0.3em] text-white/40 uppercase">
          {portal ? `${touch ? 'tap again' : 'click'} to travel to ${district?.name}` : touch ? 'tap again to open' : 'click to open'}
        </p>
      </div>
    </div>
  )
}
