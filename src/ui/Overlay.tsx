import { useEffect, useRef, useState } from 'react'
import { rt } from '../lib/runtime'
import { scrollToHall, scrollToStart } from '../lib/scroll'
import { useMind } from '../store'

const CAPTIONS = ['Your mind is powerful. Reverse the spin.', 'See? You did that.', 'Again. It listens to you.', 'Now you know how it works in here.']

export function Overlay() {
  const phase = useMind((s) => s.phase)
  const reversals = useMind((s) => s.reversals)
  const inHall = useMind((s) => s.inHall)

  const hero = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const pct = useRef<HTMLSpanElement>(null)
  const loader = useRef<HTMLDivElement>(null)
  const [cursorOver, setCursorOver] = useState(false)

  // drive opacity straight from the runtime, no React renders per frame
  useEffect(() => {
    let raf = 0
    let lastOver = false
    const loop = () => {
      const t = rt.scroll.title
      if (hero.current) {
        hero.current.style.opacity = String(t)
        hero.current.style.transform = `translate3d(0, ${(1 - t) * 24}px, 0)`
      }
      if (caption.current) caption.current.style.opacity = String(Math.max(0, 1 - rt.progress * 9))
      if (pct.current) pct.current.textContent = String(Math.round(rt.assemble * 100)).padStart(2, '0')
      if (loader.current) loader.current.style.opacity = String(rt.assemble >= 1 ? 0 : 1)
      if (rt.overSphere !== lastOver) {
        lastOver = rt.overSphere
        setCursorOver(lastOver)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    document.body.style.cursor = cursorOver && rt.progress < 0.2 ? 'pointer' : ''
  }, [cursorOver])

  const ready = phase === 'ready'
  const captionText = CAPTIONS[Math.min(reversals, CAPTIONS.length - 1)]

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* loader */}
      <div ref={loader} className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-2 transition-opacity duration-700">
        <span className="font-display text-xs tracking-[0.5em] text-white/40 uppercase">assembling a mind</span>
        <span className="font-display text-sm tabular-nums text-white/70">
          <span ref={pct}>00</span>%
        </span>
      </div>

      {/* home */}
      <button
        data-ui
        aria-label="Return to the outer mind"
        onClick={scrollToStart}
        className="pointer-events-auto absolute top-5 left-5 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 backdrop-blur-md transition hover:border-white/40"
      >
        <span className="block h-4 w-4 rounded-full bg-[conic-gradient(from_200deg,#ff6fc4,#33e0cf,#ffc24f,#ad95ff,#ff6fc4)] opacity-90 shadow-[0_0_14px_rgba(255,255,255,0.35)]" />
      </button>

      {/* reverse-the-spin caption, sits just above the sphere */}
      <div
        ref={caption}
        className={`absolute inset-x-0 top-[12%] flex flex-col items-center gap-2 px-6 text-center transition-[filter] duration-1000 ${ready ? '' : 'blur-sm'}`}
      >
        <p key={captionText} className="caption-in font-sans text-[15px] font-light text-white/80 italic md:text-base">
          {captionText}
        </p>
        <p className="font-display text-[10px] tracking-[0.35em] text-white/35 uppercase">
          {reversals === 0 ? 'click & hold the sphere' : `reversed ×${reversals}`}
        </p>
      </div>

      {/* hero title */}
      <div ref={hero} className="absolute inset-x-0 bottom-[9%] flex flex-col items-center gap-3 px-6 text-center">
        <h1
          className={`font-display text-[clamp(18px,3.2vw,34px)] font-medium tracking-[0.32em] text-white transition-all duration-[1600ms] ${
            ready ? 'opacity-100 blur-0' : 'opacity-0 blur-md'
          }`}
        >
          THE MIND OF RAGHAV GOYAL
        </h1>
        <p
          className={`font-sans text-[13px] font-light text-white/60 italic transition-all delay-300 duration-[1600ms] md:text-sm ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        >
          founder · builder · 21 · Delhi ⇄ London ⇄ Bangalore
        </p>
        <button
          data-ui
          onClick={() => scrollToHall()}
          className={`breathe pointer-events-auto mt-6 flex flex-col items-center gap-2 transition-opacity delay-700 duration-[1600ms] ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="font-display text-[10px] tracking-[0.45em] text-white/55 uppercase">scroll to enter</span>
          <span className="h-8 w-px bg-gradient-to-b from-white/60 to-transparent" />
        </button>
      </div>

      {/* hall title */}
      <div
        className={`absolute top-5 left-1/2 -translate-x-1/2 text-center transition-all duration-[1400ms] ${
          inHall ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
      >
        <p className="font-display text-[11px] tracking-[0.5em] text-white/70 uppercase">The Memory Hall</p>
      </div>
    </div>
  )
}
