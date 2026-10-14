import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector2, Vector3 } from 'three'
import { rt } from '../lib/runtime'

const UP = new Vector3(0, 1, 0)

/** Scroll-driven camera: hero → through the shell → overlooking the hall. */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const aspect = useThree((s) => s.size.width / s.size.height)
  const look = useRef(new Vector3())
  const par = useRef(new Vector2())

  const { pos, tgt } = useMemo(
    () => ({
      pos: new CatmullRomCurve3(
        [
          new Vector3(0, -0.8, 17),
          new Vector3(0, -0.3, 8.4),
          new Vector3(0, 0.3, 3.1),
          new Vector3(0, 0.9, 0.2),
          new Vector3(0, 2.6, 0.6),
          new Vector3(0, 4.2, 1.8),
        ],
        false,
        'centripetal',
      ),
      tgt: new CatmullRomCurve3(
        [
          new Vector3(0, -0.8, 0),
          new Vector3(0, -0.25, 0),
          new Vector3(0, 0, -1),
          new Vector3(0, -0.2, -6),
          new Vector3(0, -0.8, -16),
          new Vector3(0, -1.2, -24),
        ],
        false,
        'centripetal',
      ),
    }),
    [],
  )
  const dir = useMemo(() => new Vector3(), [])
  const right = useMemo(() => new Vector3(), [])
  const p = useMemo(() => new Vector3(), [])
  const t = useMemo(() => new Vector3(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const s = rt.scroll
    pos.getPoint(s.camT, p)
    tgt.getPoint(s.camT, t)
    // portrait screens: pull back so the whole sphere fits the width
    const fit = Math.max(0, 0.82 / aspect - 1)
    p.z += fit * 15 * (1 - MathUtils.smoothstep(s.camT, 0, 0.35))

    // gentle pointer parallax, stronger once inside the hall, calmer when browsing
    const k = rt.nav.k
    const amp = MathUtils.lerp(0.25, 0.6, s.hall) * (1 - k * 0.75)
    par.current.x = MathUtils.damp(par.current.x, rt.pointer.x, 2, dt)
    par.current.y = MathUtils.damp(par.current.y, rt.pointer.y, 2, dt)
    p.x += par.current.x * amp
    p.y += par.current.y * amp * 0.5
    t.x += par.current.x * amp * 2.2 * s.hall
    t.y += par.current.y * amp * 1.2 * s.hall

    // in-hall navigation (fly to a shelf section)
    if (k > 0) {
      p.lerp(rt.nav.pos, k)
      t.lerp(rt.nav.tgt, k)
    }

    // drag to look around
    const L = rt.look
    L.yaw = MathUtils.damp(L.yaw, L.yawT, 4, dt)
    L.pitch = MathUtils.damp(L.pitch, L.pitchT, 4, dt)
    dir.subVectors(t, p)
    if (Math.abs(L.yaw) > 1e-4 || Math.abs(L.pitch) > 1e-4) {
      dir.applyAxisAngle(UP, L.yaw)
      right.crossVectors(dir, UP).normalize()
      dir.applyAxisAngle(right, L.pitch)
    }
    look.current.copy(p).add(dir)

    camera.position.copy(p)
    camera.lookAt(look.current)
    rt.camTarget.copy(look.current)
    rt.camera = camera
    if (Math.abs(camera.fov - s.fov) > 0.01) {
      camera.fov = s.fov
      camera.updateProjectionMatrix()
    }
  })

  return null
}
