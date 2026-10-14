import { useEffect, useMemo, useRef } from 'react'
import { type PerspectiveCamera, Vector3 } from 'three'
import { DISTRICTS, districtById } from '../data/mind'
import { EMOTIONS, emotionColour } from '../lib/emotions'
import { orbsInteractive } from '../lib/memoryActions'
import { PLACEMENTS, SECTIONS } from '../lib/memoryLayout'
import { flyToDistrict, flyToSection } from '../lib/nav'
import { rt } from '../lib/runtime'
import { useMind } from '../store'
import { LEVER_POS } from '../three/districts/DreamFactory'
import { CHAPTERS } from '../three/districts/LongGame'

type Spec = { key: string; world: Vector3; maxDist: number; minDist?: number }

const DISTRICT_Y: Record<string, number> = { 'founder-hq': 9.5, atlas: 10.5, 'long-game': 8.6, track: 6.6 }
const count = PLACEMENTS.reduce<Record<string, number>>((acc, p) => ((acc[p.memory.district] = (acc[p.memory.district] ?? 0) + 1), acc), {})
const v = new Vector3()

/**
 * Every label that floats in the 3D world, positioned from one projection loop
 * (cheaper and sturdier than a React root per label).
 */
export function WorldLabels() {
  const inHall = useMind((s) => s.inHall)
  const district = useMind((s) => s.district)
  const section = useMind((s) => s.section)
  const focus = useMind((s) => s.focus)
  const selected = useMind((s) => s.selected)
  const refs = useRef<Record<string, HTMLElement | null>>({})

  const specs = useMemo(() => {
    const out: Spec[] = []
    for (const d of DISTRICTS) out.push({ key: `d:${d.id}`, world: new Vector3(...d.anchor).add(new Vector3(0, DISTRICT_Y[d.id] ?? 8, 0)), maxDist: 400, minDist: 6 })
    SECTIONS.forEach((s, i) => out.push({ key: `s:${s.district}`, world: new Vector3(s.centre.x - s.side * 1.1, i % 2 === 0 ? 6.1 : -1.95, s.centre.z), maxDist: 90 }))
    const df = new Vector3(...districtById['dream-factory'].anchor)
    out.push({ key: 'lever', world: df.clone().add(new Vector3(LEVER_POS[0], LEVER_POS[1] + 2.9, LEVER_POS[2])), maxDist: 45 })
    const lg = new Vector3(...districtById['long-game'].anchor)
    CHAPTERS.forEach((c) => out.push({ key: `c:${c.id}`, world: lg.clone().add(c.at).add(new Vector3(c.stars[0][0], c.stars[0][1] - 0.9, 0)), maxDist: 60 }))
    return out
  }, [])

  useEffect(() => {
    const tick = () => {
      const cam = rt.camera as PerspectiveCamera | null
      if (!cam) return
      const w = window.innerWidth
      const h = window.innerHeight
      for (const s of specs) {
        const el = refs.current[s.key]
        if (!el) continue
        const dist = cam.position.distanceTo(s.world)
        v.copy(s.world).project(cam)
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15 && dist < s.maxDist && dist > (s.minDist ?? 0)
        el.style.visibility = onScreen ? 'visible' : 'hidden'
        if (onScreen) el.style.transform = `translate3d(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px, 0) translate(-50%, -50%)`
      }
    }
    rt.domTicks.add(tick)
    return () => void rt.domTicks.delete(tick)
  }, [specs])

  const show = inHall && !selected
  const set = (key: string) => (el: HTMLElement | null) => {
    refs.current[key] = el
  }
  const base = 'absolute top-0 left-0 transition-opacity duration-700'

  return (
    <div className="pointer-events-none fixed inset-0 z-[8] overflow-hidden">
      {DISTRICTS.map((d) => {
        const on = show && district !== d.id
        return (
          <button
            key={d.id}
            ref={set(`d:${d.id}`)}
            data-ui
            onClick={() => orbsInteractive() && flyToDistrict(d.id)}
            className={`${base} font-display whitespace-nowrap px-2 py-1 text-[9px] tracking-[0.35em] text-white/60 uppercase hover:text-white ${on ? 'pointer-events-auto opacity-100' : 'opacity-0'}`}
            style={{ textShadow: `0 0 12px ${emotionColour(d.emotion)}` }}
          >
            {d.name}
          </button>
        )
      })}

      {SECTIONS.map((s) => {
        const d = districtById[s.district]
        const colour = EMOTIONS.find((e) => e.id === d.emotion)!.colour
        const active = section === s.district
        const on = show && !district
        return (
          <button
            key={s.district}
            ref={set(`s:${s.district}`)}
            data-ui
            onClick={() => orbsInteractive() && flyToSection(s.district)}
            className={`${base} font-display flex items-center rounded-md border px-2.5 py-1 text-[10px] tracking-[0.22em] whitespace-nowrap uppercase backdrop-blur-md hover:bg-white/15 ${
              on ? 'pointer-events-auto opacity-100' : 'opacity-0'
            } ${active ? 'border-white/50 bg-white/15 text-white' : 'border-white/20 bg-black/35 text-white/75'}`}
            style={{ boxShadow: `0 0 16px ${colour}44` }}
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full" style={{ background: colour, boxShadow: `0 0 8px ${colour}` }} />
            {d.name}
            <span className="ml-2 text-white/40 tabular-nums">{count[s.district]}</span>
          </button>
        )
      })}

      <div ref={set('lever')} className={`${base} flex flex-col items-center ${show ? 'opacity-100' : 'opacity-0'}`}>
        <button
          data-ui
          onClick={() => orbsInteractive() && useMind.getState().toggleFocus()}
          className={`font-display rounded-md border px-3 py-1 text-[11px] font-semibold tracking-[0.4em] whitespace-nowrap uppercase backdrop-blur-md transition-colors duration-500 ${show ? 'pointer-events-auto' : ''} ${
            focus ? 'border-amber-200/60 bg-amber-200/15 text-amber-100' : 'border-violet-300/40 bg-black/40 text-violet-100 hover:bg-violet-300/15'
          }`}
        >
          Focus
        </button>
        <p className={`mt-2 w-48 text-center text-[11px] font-light text-white/70 italic transition-opacity duration-700 ${focus ? 'opacity-100' : 'opacity-0'}`}>
          Concentration of forces over parallel bets.
        </p>
      </div>

      {CHAPTERS.map((c) => (
        <div key={c.id} ref={set(`c:${c.id}`)} className={`${base} text-center whitespace-nowrap ${show && district === 'long-game' ? 'opacity-100 delay-[1600ms]' : 'opacity-0'}`}>
          <p className="font-display text-[10px] tracking-[0.35em] text-violet-200/70 uppercase">{c.label}</p>
          <p className="font-display text-sm text-white/90">{c.text}</p>
        </div>
      ))}
    </div>
  )
}
