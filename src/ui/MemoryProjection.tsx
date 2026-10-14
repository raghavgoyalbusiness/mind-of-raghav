import { useEffect, useMemo, useRef, useState } from 'react'
import { districtById, memoryById, MEMORIES, type Memory } from '../data/mind'
import { EMOTIONS, EMOTION_INDEX } from '../lib/emotions'
import { closeMemory, openMemory, screenCircle } from '../lib/memoryActions'
import { flyToDistrict } from '../lib/nav'
import { rt } from '../lib/runtime'
import { useMind, type ProjectionOrigin } from '../store'
import { drawMemoryGlyph, memoryInitials } from '../three/orbMaterial'
import { STATUS_LABEL } from './HoverCard'

const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)' // power3.inOut
const DURATION = 1000

function centre(): ProjectionOrigin {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2, r: 0 }
}

/** The orb, enlarged: glowing glass with the memory image and slowly turning rings. */
function ProjectedOrb({ m, colour }: { m: Memory; colour: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const g = c.getContext('2d')!
    g.clearRect(0, 0, c.width, c.height)
    drawMemoryGlyph(g, c.width / 2, c.height / 2, c.width, m.title, colour)
  }, [m, colour])
  const idea = m.status === 'idea'
  return (
    <div className="relative aspect-square w-[min(340px,62vw)] shrink-0">
      <div
        className={`absolute inset-0 rounded-full ${m.status === 'building' ? 'orb-pulse' : ''}`}
        style={{
          background: idea
            ? `radial-gradient(circle at 50% 50%, transparent 55%, ${colour}55 72%, ${colour}cc 86%, #fff8 92%, transparent 94%)`
            : `radial-gradient(circle at 34% 30%, #ffffffcc 0%, ${colour}aa 9%, ${colour}44 38%, ${colour}22 55%, ${colour}88 80%, #ffffffaa 90%, transparent 93%)`,
          boxShadow: `0 0 80px 10px ${colour}55, 0 0 200px 40px ${colour}22, inset 0 0 60px ${colour}66`,
        }}
      />
      <div className="orb-swirl absolute inset-[8%] rounded-full opacity-60 mix-blend-screen" style={{ background: `conic-gradient(from 0deg, transparent, ${colour}55, transparent 30%, ${colour}33, transparent 60%, #ffffff22, transparent)` }} />
      <svg className="ring-a absolute inset-0 h-full w-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="47" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="0.3" strokeDasharray="40 20 6 20" />
      </svg>
      <svg className="ring-b absolute inset-0 h-full w-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke={colour} strokeOpacity="0.7" strokeWidth="0.4" strokeDasharray="2 6" />
      </svg>
      <canvas ref={canvas} width={512} height={512} className="absolute inset-[12%] h-[76%] w-[76%] opacity-80" aria-hidden />
      {/* motes drifting up out of the memory */}
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className="mote absolute h-1 w-1 rounded-full"
          style={{ left: `${20 + ((i * 37) % 60)}%`, bottom: `${10 + ((i * 23) % 30)}%`, background: colour, boxShadow: `0 0 8px ${colour}`, animationDelay: `${i * 0.45}s` }}
        />
      ))}
      <span className="sr-only">{memoryInitials(m.title)}</span>
    </div>
  )
}

export function MemoryProjection() {
  const selected = useMind((s) => s.selected)
  const originIn = useMind((s) => s.origin)
  const [shown, setShown] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState<ProjectionOrigin>(centre)
  const closeBtn = useRef<HTMLButtonElement>(null)

  // opening / switching / closing choreography
  useEffect(() => {
    if (selected) {
      if (!shown) {
        setOrigin(originIn ?? centre())
        setShown(selected)
        // let the collapsed circle paint first, then expand it
        setTimeout(() => setOpen(true), 30)
      } else setShown(selected)
      return
    }
    if (!shown) return
    // collapse back into wherever the orb is now
    const w = rt.projWorld ?? rt.orbWorld.get(shown)
    setOrigin((w && screenCircle(w, rt.projRadius)) || origin)
    setOpen(false)
    const t = setTimeout(() => setShown(null), rt.reducedMotion ? 350 : DURATION)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  useEffect(() => {
    if (!selected) return
    // capture + stop so Escape closes only the projection, not the shelf view behind it
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      closeMemory()
    }
    window.addEventListener('keydown', key, true)
    const t = setTimeout(() => closeBtn.current?.focus(), 400)
    return () => {
      window.removeEventListener('keydown', key, true)
      clearTimeout(t)
    }
  }, [selected])

  const m = shown ? memoryById[shown] : null
  const related = useMemo(() => (m ? MEMORIES.filter((x) => x.district === m.district && x.id !== m.id).slice(0, 10) : []), [m])
  if (!m) return null

  const emo = EMOTIONS[EMOTION_INDEX[m.emotion]]
  const district = districtById[m.district]
  const reduced = rt.reducedMotion
  const clip = open ? `circle(150vmax at ${origin.x}px ${origin.y}px)` : `circle(${origin.r}px at ${origin.x}px ${origin.y}px)`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={m.title}
      data-ui
      className="fixed inset-0 z-40 overflow-y-auto"
      style={{
        clipPath: reduced ? undefined : clip,
        opacity: reduced ? (open ? 1 : 0) : 1,
        transition: reduced ? 'opacity 350ms ease' : `clip-path ${DURATION}ms ${EASE}`,
        background: `radial-gradient(120% 90% at ${origin.x}px ${origin.y}px, color-mix(in srgb, ${emo.colour} 26%, #0b0612) 0%, #0b0612 45%, #050308 100%)`,
      }}
      onClick={(e) => e.target === e.currentTarget && closeMemory()}
    >
      <div className="projection-grain pointer-events-none fixed inset-0 opacity-[0.07]" />
      <button
        ref={closeBtn}
        onClick={closeMemory}
        className={`fixed top-5 right-5 z-10 flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 font-display text-[11px] tracking-[0.25em] text-white/80 uppercase backdrop-blur-md transition hover:border-white/50 hover:text-white ${open ? 'opacity-100' : 'opacity-0'}`}
      >
        Close <span className="text-white/40">esc</span>
      </button>

      <div key={m.id} className={`proj ${open ? 'proj-open' : ''} mx-auto flex min-h-full max-w-6xl flex-col items-center justify-center gap-10 px-6 py-24 md:flex-row md:gap-16 md:px-12`}>
        <div className="proj-item" style={{ ['--d' as string]: '120ms' }}>
          <ProjectedOrb m={m} colour={emo.colour} />
        </div>

        <div className="w-full max-w-xl">
          <div className="proj-item flex flex-wrap items-center gap-2 font-display text-[10px] tracking-[0.22em] text-white/60 uppercase" style={{ ['--d' as string]: '260ms' }}>
            <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1" title={emo.means}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: emo.colour, boxShadow: `0 0 8px ${emo.colour}` }} />
              {emo.label}
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{district?.name}</span>
            <span className={`rounded-full border px-3 py-1 ${m.status === 'idea' ? 'border-dashed border-white/30' : 'border-white/15 bg-white/5'}`}>{STATUS_LABEL[m.status]}</span>
            {m.year && <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 tabular-nums">{m.year}</span>}
            {m.isCore && <span className="rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1 text-amber-100">Core memory</span>}
          </div>

          <h2 className="proj-item mt-5 font-display text-[clamp(32px,5.4vw,64px)] leading-[1.02] font-medium tracking-tight text-white" style={{ ['--d' as string]: '360ms' }}>
            {m.title}
          </h2>
          <p className="proj-item mt-4 max-w-lg text-[17px] leading-relaxed font-light text-white/75" style={{ ['--d' as string]: '460ms' }}>
            {m.oneLiner}
          </p>

          {m.tags.length > 0 && (
            <div className="proj-item mt-6 flex flex-wrap gap-2" style={{ ['--d' as string]: '560ms' }}>
              {m.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/60">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {m.links.length > 0 && (
            <div className="proj-item mt-6 flex flex-wrap gap-3" style={{ ['--d' as string]: '620ms' }}>
              {m.links.map((l) => (
                <a key={l} href={l} target="_blank" rel="noreferrer" className="rounded-full border border-white/25 px-4 py-2 text-sm text-white/85 transition hover:border-white/60 hover:bg-white/10">
                  {l.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} ↗
                </a>
              ))}
            </div>
          )}

          {useMind.getState().district !== m.district && (
            <div className="proj-item mt-7" style={{ ['--d' as string]: '640ms' }}>
              <button
                onClick={() => {
                  closeMemory()
                  flyToDistrict(m.district)
                }}
                className="group flex items-center gap-3 rounded-full border px-5 py-2.5 font-display text-[11px] tracking-[0.25em] text-white uppercase transition hover:bg-white/10"
                style={{ borderColor: `${emo.colour}88`, boxShadow: `0 0 24px -6px ${emo.colour}` }}
              >
                Visit {district?.name}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>
          )}

          {related.length > 0 && (
            <div className="proj-item mt-10 border-t border-white/10 pt-6" style={{ ['--d' as string]: '700ms' }}>
              <p className="mb-3 font-display text-[10px] tracking-[0.3em] text-white/40 uppercase">Also in {district?.name}</p>
              <div className="flex flex-wrap gap-2">
                {related.map((r) => {
                  const c = EMOTIONS[EMOTION_INDEX[r.emotion]].colour
                  return (
                    <button
                      key={r.id}
                      onClick={() => openMemory(r.id)}
                      className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/75 transition hover:border-white/40 hover:text-white"
                    >
                      <span className={`h-2 w-2 rounded-full ${r.status === 'idea' ? 'border' : ''}`} style={r.status === 'idea' ? { borderColor: c } : { background: c, boxShadow: `0 0 6px ${c}` }} />
                      {r.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
