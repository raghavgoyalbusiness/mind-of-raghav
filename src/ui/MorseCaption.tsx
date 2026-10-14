import { useEffect, useRef, useState } from 'react'
import { morseOf, morseTimeline, TAGLINE } from '../lib/morse'

const DURATION = morseTimeline().reduce((a, s) => a + s.d, 0)
import { rt } from '../lib/runtime'
import { useMind } from '../store'

/** Spells out the tagline under the eyes as they blink it. */
export function MorseCaption() {
  const morse = useMind((s) => s.morse)
  const [on, setOn] = useState(false)
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  useEffect(() => {
    if (!morse) return
    setOn(true)
    const tick = () => {
      refs.current.forEach((el, i) => el?.classList.toggle('morse-on', i === rt.morseLetter))
    }
    rt.domTicks.add(tick)
    const t = setTimeout(() => setOn(false), 1000 * (1 + DURATION + 0.6))
    return () => {
      rt.domTicks.delete(tick)
      clearTimeout(t)
    }
  }, [morse])
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-[22%] z-[15] flex justify-center transition-opacity duration-1000 ${on ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex gap-3">
        {[...TAGLINE].map((ch, i) =>
          ch === ' ' ? (
            <span key={i} className="w-3" />
          ) : (
            <span key={i} ref={(el) => void (refs.current[i] = el)} className="flex flex-col items-center text-white/35 transition-colors duration-150">
              <span className="font-display text-lg tracking-widest">{ch}</span>
              <span className="text-[10px] tracking-[0.2em]">{morseOf(ch)}</span>
            </span>
          ),
        )}
      </div>
    </div>
  )
}
