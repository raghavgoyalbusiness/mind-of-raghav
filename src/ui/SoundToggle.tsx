import { useEffect, useState } from 'react'
import { memoryById } from '../data/mind'
import { EMOTIONS, EMOTION_INDEX } from '../lib/emotions'
import { rt } from '../lib/runtime'
import { sound } from '../lib/sound'
import { useMind } from '../store'

/** Bottom-right sound toggle, plus the wiring from what happens in the mind to what you hear. */
export function SoundToggle() {
  const [on, setOn] = useState(sound.enabled)
  const phase = useMind((s) => s.phase)

  useEffect(() => sound.onChange(setOn), [])

  // browsers only allow audio after a gesture: honour a saved "on" at the first one
  useEffect(() => {
    if (!sound.wanted) return
    const first = () => void sound.enable()
    window.addEventListener('pointerdown', first, { once: true })
    window.addEventListener('keydown', first, { once: true })
    return () => {
      window.removeEventListener('pointerdown', first)
      window.removeEventListener('keydown', first)
    }
  }, [])

  // reactions
  useEffect(() => {
    const unsub = useMind.subscribe((s, p) => {
      const noteOf = (id: string) => EMOTIONS[EMOTION_INDEX[memoryById[id].emotion]].note
      if (s.hovered && s.hovered !== p.hovered && memoryById[s.hovered]) {
        const idea = memoryById[s.hovered].status === 'idea'
        sound.chime(noteOf(s.hovered) * (idea ? 2 : 1), idea ? 0.55 : 0.9)
      }
      if (s.selected && s.selected !== p.selected && memoryById[s.selected]) sound.arpeggio(noteOf(s.selected))
      if (s.focus !== p.focus) sound.swell(!s.focus)
      if (s.reversals > p.reversals) sound.swell(s.reversals % 2 === 1)
    })
    const tick = () => sound.update(rt.scroll.hall, useMind.getState().focus)
    rt.domTicks.add(tick)
    return () => {
      unsub()
      rt.domTicks.delete(tick)
    }
  }, [])

  return (
    <button
      data-ui
      onClick={() => sound.toggle()}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      aria-pressed={on}
      className={`fixed right-4 bottom-4 z-30 flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 backdrop-blur-xl transition-all duration-700 hover:border-white/40 ${phase === 'ready' ? 'opacity-100' : 'opacity-0'}`}
    >
      <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`w-[2px] rounded-full bg-white/80 ${on ? 'sound-bar' : ''}`} style={{ height: on ? undefined : 3, animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span className="hidden font-display text-[9px] tracking-[0.3em] text-white/60 uppercase sm:inline">{on ? 'sound on' : 'sound off'}</span>
    </button>
  )
}
