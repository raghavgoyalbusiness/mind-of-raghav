import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { IS_MOBILE, MAX_DPR } from '../lib/config'
import { rt } from '../lib/runtime'
import { useMind } from '../store'

const MIN_DPR = IS_MOBILE ? 0.75 : 1

/**
 * Keeps the frame rate up: lowers the pixel ratio (and drops depth of field)
 * when frames run long, raises it again when there is headroom. Also pauses
 * rendering entirely while a Memory Projection covers the screen.
 */
export function Performance() {
  const setDpr = useThree((s) => s.setDpr)
  const setFrameloop = useThree((s) => s.setFrameloop)
  const dpr = useRef(Math.min(window.devicePixelRatio, MAX_DPR))
  const win = useRef({ t: 0, n: 0, calm: 0 })

  useFrame((_, delta) => {
    if (delta > 0.25) return // tab switch, ignore
    const w = win.current
    w.t += delta
    w.n++
    if (w.t < 1.5) return
    const avg = w.t / w.n
    w.t = 0
    w.n = 0
    if (avg > 1 / 45 && dpr.current > MIN_DPR) {
      dpr.current = Math.max(MIN_DPR, dpr.current - 0.25)
      setDpr(dpr.current)
      rt.lowQuality = true
      w.calm = 0
    } else if (avg < 1 / 57) {
      // sustained headroom (~6s) before stepping back up
      if (++w.calm >= 4 && dpr.current < Math.min(window.devicePixelRatio, MAX_DPR)) {
        dpr.current = Math.min(Math.min(window.devicePixelRatio, MAX_DPR), dpr.current + 0.25)
        setDpr(dpr.current)
        if (dpr.current >= Math.min(window.devicePixelRatio, MAX_DPR)) rt.lowQuality = false
        w.calm = 0
      }
    } else w.calm = 0
  })

  // a full-screen projection hides the scene: stop rendering behind it
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const unsub = useMind.subscribe((s, p) => {
      if (s.selected === p.selected) return
      clearTimeout(t)
      if (s.selected) t = setTimeout(() => setFrameloop('never'), 1200)
      else setFrameloop('always')
    })
    return () => {
      unsub()
      clearTimeout(t)
    }
  }, [setFrameloop])

  return null
}
