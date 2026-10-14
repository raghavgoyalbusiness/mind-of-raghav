import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, type Group, MathUtils, Vector3 } from 'three'
import { morseTimeline } from '../lib/morse'
import { rt } from '../lib/runtime'
import { useMind } from '../store'

const FWD = new Vector3()
const UP = new Vector3()
const RIGHT = new Vector3()

/** Type "weongo": two glowing eyes appear in the sky and blink the tagline in Morse. */
export function MorseEyes() {
  const camera = useThree((s) => s.camera)
  const group = useRef<Group>(null)
  const lids = useRef<(Group | null)[]>([])
  const irises = useRef<(Group | null)[]>([])
  const morse = useMind((s) => s.morse)
  const steps = useMemo(() => morseTimeline(), [])
  const total = useMemo(() => steps.reduce((a, s) => a + s.d, 0), [steps])
  const state = useRef({ start: -1, presence: 0 })

  useEffect(() => {
    if (morse > 0) state.current.start = -2 // armed: starts on the next frame clock
  }, [morse])

  useFrame((s, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const st = state.current
    const t = s.clock.elapsedTime
    if (st.start === -2) st.start = t + 1.0 // fade in for a second first
    const k = st.start < 0 ? -1 : t - st.start
    const active = st.start >= 0 && k < total + 1.2
    st.presence = MathUtils.damp(st.presence, active ? 1 : 0, 3, dt)
    g.visible = st.presence > 0.01
    if (!g.visible) {
      if (!active && st.start >= 0) {
        st.start = -1
        rt.morseLetter = -1
      }
      return
    }

    // float in front of the camera, high in the sky
    camera.getWorldDirection(FWD)
    UP.set(0, 1, 0)
    RIGHT.crossVectors(FWD, UP).normalize()
    UP.crossVectors(RIGHT, FWD).normalize()
    g.position.copy(camera.position).addScaledVector(FWD, 14).addScaledVector(UP, 3.2)
    g.quaternion.copy(camera.quaternion)
    g.scale.setScalar(0.4 + st.presence * 0.6)

    // where are we in the Morse?
    let closed = false
    let letter = -1
    if (k >= 0) {
      let acc = 0
      for (const step of steps) {
        if (k < acc + step.d) {
          closed = step.closed
          letter = step.letter
          break
        }
        acc += step.d
      }
    }
    rt.morseLetter = letter
    lids.current.forEach((l) => {
      if (l) l.scale.y = MathUtils.damp(l.scale.y, closed ? 0.06 : 1, 30, dt)
    })
    // irises follow the pointer
    irises.current.forEach((i) => {
      if (!i) return
      i.position.x = MathUtils.damp(i.position.x, rt.pointer.x * 0.28, 6, dt)
      i.position.y = MathUtils.damp(i.position.y, rt.pointer.y * 0.2, 6, dt)
    })
  })

  const glow = useMemo(() => new Color('#f4ecff').multiplyScalar(1.5), [])
  const iris = useMemo(() => new Color('#8f5bff').multiplyScalar(2.2), [])
  return (
    <group ref={group} visible={false} renderOrder={20}>
      {[-1.3, 1.3].map((x, i) => (
        <group key={x} position-x={x}>
          <group ref={(el) => void (lids.current[i] = el)}>
            <mesh scale={[1, 0.62, 0.3]} renderOrder={20}>
              <sphereGeometry args={[0.9, 32, 20]} />
              <meshBasicMaterial color={glow} toneMapped={false} fog={false} depthTest={false} transparent />
            </mesh>
            <group ref={(el) => void (irises.current[i] = el)}>
              <mesh position-z={0.3} renderOrder={21}>
                <circleGeometry args={[0.34, 32]} />
                <meshBasicMaterial color={iris} toneMapped={false} fog={false} depthTest={false} transparent />
              </mesh>
              <mesh position-z={0.31} renderOrder={22}>
                <circleGeometry args={[0.14, 24]} />
                <meshBasicMaterial color="#05030a" fog={false} depthTest={false} transparent />
              </mesh>
            </group>
          </group>
        </group>
      ))}
    </group>
  )
}
