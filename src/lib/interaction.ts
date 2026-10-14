import { useMind } from '../store'
import { rt } from './runtime'

const DRAG_THRESHOLD = 6

/** Window-level pointer tracking so DOM overlays never block the scene. */
export function initPointer() {
  let pressed = false
  let sx = 0
  let sy = 0
  let lx = 0
  let ly = 0
  let touch = false

  const move = (e: PointerEvent) => {
    rt.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    rt.pointerActive = true
    if (!pressed) return
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > DRAG_THRESHOLD) rt.dragMoved = true
    const st = useMind.getState()
    if (rt.dragMoved && st.inHall && !st.selected) {
      // drag to look around the hall (touch: horizontal only, vertical scrolls)
      rt.look.yawT = Math.max(-1.2, Math.min(1.2, rt.look.yawT + (e.clientX - lx) * 0.0042))
      if (!touch) rt.look.pitchT = Math.max(-0.5, Math.min(0.45, rt.look.pitchT + (e.clientY - ly) * 0.003))
      document.body.style.cursor = 'grabbing'
    }
    lx = e.clientX
    ly = e.clientY
  }
  const down = (e: PointerEvent) => {
    move(e)
    if ((e.target as HTMLElement)?.closest('[data-ui]')) return
    pressed = true
    touch = e.pointerType === 'touch'
    rt.dragMoved = false
    sx = lx = e.clientX
    sy = ly = e.clientY
    if (useMind.getState().phase !== 'ready' || !rt.hitSphere(rt.pointer.x, rt.pointer.y)) return
    rt.holding = true
    rt.spinDir = rt.spinDir === 1 ? -1 : 1
    useMind.getState().addReversal()
  }
  const up = () => {
    pressed = false
    rt.holding = false
    if (document.body.style.cursor === 'grabbing') document.body.style.cursor = ''
  }
  const leave = () => {
    rt.pointerActive = false
    up()
  }

  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerdown', down)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
  document.documentElement.addEventListener('pointerleave', leave)
  return () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerdown', down)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    document.documentElement.removeEventListener('pointerleave', leave)
  }
}
