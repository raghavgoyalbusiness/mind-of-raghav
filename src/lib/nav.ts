import gsap from 'gsap'
import { CatmullRomCurve3, Vector3 } from 'three'
import { districtById } from '../data/mind'
import { useMind } from '../store'
import { SECTIONS } from './memoryLayout'
import { rt } from './runtime'

let tween: gsap.core.Animation | null = null

/** Black veil used instead of camera flights when reduced motion is on. */
function crossfade(jump: () => void) {
  const veil = document.getElementById('veil')
  if (!veil) return jump()
  gsap.to(veil, {
    opacity: 1,
    duration: 0.25,
    ease: 'power1.in',
    onComplete: () => {
      jump()
      gsap.to(veil, { opacity: 0, duration: 0.45, delay: 0.05, ease: 'power1.out' })
    },
  })
}

/** Take over from the scroll camera exactly where it is, so flights never jump. */
function takeOver() {
  tween?.kill()
  rt.look.yawT = 0
  rt.look.pitchT = 0
  const from = rt.camera ? rt.camera.position.clone() : new Vector3()
  const fromT = rt.camTarget.clone()
  rt.nav.pos.copy(from)
  rt.nav.tgt.copy(fromT)
  rt.nav.k = 1
  return { from, fromT }
}

/** Fly the camera along an eased arc to a new viewpoint (overrides the scroll camera). */
export function flyTo(position: Vector3, target: Vector3, duration = 2.4, onArrive?: () => void) {
  const { from, fromT } = takeOver()
  if (rt.reducedMotion) {
    crossfade(() => {
      rt.nav.pos.copy(position)
      rt.nav.tgt.copy(target)
      onArrive?.()
    })
    return
  }
  const mid = from.clone().lerp(position, 0.5)
  mid.y = Math.max(from.y, position.y) + from.distanceTo(position) * 0.12
  const path = new CatmullRomCurve3([from, mid, position], false, 'centripetal')
  const tgtPath = new CatmullRomCurve3([fromT, fromT.clone().lerp(target, 0.5).setY(Math.max(fromT.y, target.y)), target])
  const p = { u: 0 }
  tween = gsap.to(p, {
    u: 1,
    duration,
    ease: 'power3.inOut',
    onUpdate: () => {
      path.getPoint(p.u, rt.nav.pos)
      tgtPath.getPoint(p.u, rt.nav.tgt)
    },
    onComplete: onArrive,
  })
}

/**
 * Ride a neural pathway: the camera joins the curve, travels along it looking
 * ahead, then settles on the destination viewpoint.
 */
export function flyAlong(route: Vector3[], position: Vector3, target: Vector3, onArrive?: () => void) {
  const { from, fromT } = takeOver()
  if (rt.reducedMotion) {
    crossfade(() => {
      rt.nav.pos.copy(position)
      rt.nav.tgt.copy(target)
      onArrive?.()
    })
    return
  }
  const lifted = route.map((p) => p.clone().add(new Vector3(0, 1.6, 0)))
  const path = new CatmullRomCurve3([from, ...lifted, position], false, 'centripetal')
  const len = path.getLength()
  const ahead = new Vector3()
  const look = new Vector3()
  const p = { u: 0 }
  tween = gsap.to(p, {
    u: 1,
    duration: Math.min(Math.max(len / 38, 2.8), 6.5),
    ease: 'power3.inOut',
    onUpdate: () => {
      path.getPointAt(p.u, rt.nav.pos)
      path.getPointAt(Math.min(p.u + 0.05, 1), ahead)
      // look ahead along the pathway, easing into the destination at both ends
      const k0 = Math.min(p.u / 0.12, 1)
      const k1 = Math.max((p.u - 0.75) / 0.25, 0)
      look.copy(fromT).lerp(ahead, k0)
      rt.nav.tgt.copy(look.lerp(target, k1 * k1))
    },
    onComplete: onArrive,
  })
}

/** Blend back to the scroll camera (overlooking the hall from the deck). */
export function flyHome(duration = 2) {
  tween?.kill()
  useMind.getState().setSection(null)
  useMind.getState().setDistrict(null)
  rt.look.yawT = 0
  rt.look.pitchT = 0
  if (rt.nav.k === 0) return
  if (rt.reducedMotion) return crossfade(() => (rt.nav.k = 0))
  tween = gsap.to(rt.nav, { k: 0, duration, ease: 'power3.inOut' })
}

export function flyToSection(district: string) {
  const s = SECTIONS.find((x) => x.district === district)
  if (!s) return
  useMind.getState().setSection(district)
  flyTo(s.view.position, s.view.target)
}

/** Where the camera stands to look at each district (offsets from its anchor). */
const VIEWS: Record<string, { pos: [number, number, number]; tgt: [number, number, number] }> = {
  'founder-hq': { pos: [12, 4, 30], tgt: [0, -1, 0] },
  workshop: { pos: [9, 3, 15], tgt: [0, 1, 0] },
  'dream-factory': { pos: [-7, 3, 16], tgt: [0, 2, 0] },
  atelier: { pos: [8, 3, 15], tgt: [0, 1.2, 0] },
  roots: { pos: [-6, 3, 12], tgt: [0, 1.4, 0] },
  atlas: { pos: [7, 1, 17], tgt: [0, -0.5, 0] },
  studio: { pos: [-7, 2, 12], tgt: [0, 1.6, 0] },
  track: { pos: [7, 4, 10], tgt: [0, 2.5, -1] },
  'long-game': { pos: [1, 1, 20], tgt: [0, 0.5, 0] },
}

export function districtView(id: string) {
  const d = districtById[id]
  const v = VIEWS[id]
  const a = new Vector3(...d.anchor)
  return { position: a.clone().add(new Vector3(...v.pos)), target: a.clone().add(new Vector3(...v.tgt)) }
}

export function flyToDistrict(id: string, route?: Vector3[], onArrive?: () => void) {
  if (!districtById[id]) return
  const wasHere = useMind.getState().district === id
  useMind.getState().setDistrict(id)
  const v = districtView(id)
  // already there: arrive straight away
  if (wasHere && rt.nav.k === 1 && rt.camera && rt.camera.position.distanceTo(v.position) < 1) return onArrive?.()
  if (route && route.length > 1) flyAlong(route, v.position, v.target, onArrive)
  else flyTo(v.position, v.target, 3, onArrive)
}
