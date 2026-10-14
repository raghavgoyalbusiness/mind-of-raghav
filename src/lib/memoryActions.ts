import { type PerspectiveCamera, Vector3 } from 'three'
import { useMind, type ProjectionOrigin } from '../store'
import { lenis } from './scroll'
import { rt } from './runtime'

const v = new Vector3()

/** Screen-space circle covering a world-space orb. */
export function screenCircle(world: Vector3, radius: number): ProjectionOrigin | null {
  const cam = rt.camera as PerspectiveCamera | null
  if (!cam) return null
  v.copy(world).project(cam)
  if (v.z > 1) return null
  const dist = cam.position.distanceTo(world)
  const px = (radius / (dist * Math.tan((cam.fov * Math.PI) / 360))) * (window.innerHeight / 2)
  return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, r: Math.max(px, 6) }
}

export function openMemory(id: string, radius = 0.42, world?: Vector3) {
  const w = world ?? rt.orbWorld.get(id)
  rt.projWorld = w ?? null
  rt.projRadius = radius
  const origin = w ? screenCircle(w, radius) : null
  useMind.getState().open(id, origin)
  lenis?.stop()
  history.replaceState(null, '', `#m/${id}`)
}

export function closeMemory() {
  useMind.getState().close()
  lenis?.start()
  history.replaceState(null, '', location.pathname + location.search)
}

/** Interactive only once settled in the hall and nothing is projected. */
export function orbsInteractive() {
  const s = useMind.getState()
  return s.inHall && !s.selected
}
