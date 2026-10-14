import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CanvasTexture, type MeshBasicMaterial, SRGBColorSpace } from 'three'
import { type District, MEMORIES } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { useMind } from '../../store'
import { DistrictOrb, hdr, Platform, useNear } from './common'

export function isThreeAM(d = new Date()) {
  return d.getHours() === 3
}

function signTexture(text: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#1a0606'
  g.fillRect(0, 0, 512, 160)
  g.strokeStyle = '#ff5050'
  g.lineWidth = 6
  g.strokeRect(10, 10, 492, 140)
  g.fillStyle = '#ffffff'
  g.shadowColor = '#ff2a2a'
  g.shadowBlur = 20
  g.font = '700 84px "Space Grotesk", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 86)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export function Studio({ d }: { d: District }) {
  const colour = emotionColour(d.emotion)
  const near = useNear(d)
  const memories = useMemo(() => MEMORIES.filter((m) => m.district === d.id), [d])
  const live = useMind((s) => s.night)
  const sign = useMemo(() => signTexture(live ? 'LIVE' : 'ON AIR'), [live])
  const signMat = useRef<MeshBasicMaterial>(null)
  const hover = useRef({ on: false, was: false, since: 0 })

  useFrame((state) => {
    const m = signMat.current
    if (!m) return
    const t = state.clock.elapsedTime
    const on = hover.current.on || live || useMind.getState().selected === 'three-am-show'
    if (on && !hover.current.was) hover.current.since = t
    hover.current.was = on
    let lit = 0.18
    if (on) {
      // flicker on, like an old neon tube, then hold
      const k = t - hover.current.since
      lit = k > 0.7 || Math.sin(k * 90) > 0.2 || Math.sin(k * 37) > 0.6 ? 2.6 : 0.3
    }
    m.color.setScalar(lit)
  })
  const over = (on: boolean) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    hover.current.on = on
  }

  return (
    <group>
      <Platform colour={colour} r={4.6} />
      <group onPointerOver={over(true)} onPointerOut={over(false)}>
        {/* booth shell */}
        <mesh position={[0, 1.85, -0.4]}>
          <boxGeometry args={[4.6, 3.2, 3.2]} />
          <meshStandardMaterial color="#14101e" roughness={0.45} emissive={colour} emissiveIntensity={0.04} />
        </mesh>
        <mesh position={[0, 3.55, -0.4]}>
          <boxGeometry args={[5, 0.2, 3.6]} />
          <meshStandardMaterial color="#0d0a14" roughness={0.5} />
        </mesh>
        {/* warm window into the booth */}
        <mesh position={[-0.4, 1.95, 1.21]}>
          <planeGeometry args={[2.8, 1.5]} />
          <meshBasicMaterial color={hdr('#ffb36b', 1.5)} toneMapped={false} />
        </mesh>
        <mesh position={[1.75, 1.45, 1.21]}>
          <planeGeometry args={[0.8, 2]} />
          <meshStandardMaterial color="#2a2236" roughness={0.5} />
        </mesh>
        {/* microphone silhouette in the window */}
        <mesh position={[-0.9, 1.75, 1.23]}>
          <planeGeometry args={[0.05, 0.9]} />
          <meshBasicMaterial color="#20120a" />
        </mesh>
        <mesh position={[-0.9, 2.3, 1.235]}>
          <circleGeometry args={[0.18, 20]} />
          <meshBasicMaterial color="#20120a" />
        </mesh>
        {/* ON AIR */}
        <mesh position={[0, 4.15, 1.0]}>
          <planeGeometry args={[1.8, 0.56]} />
          <meshBasicMaterial ref={signMat} map={sign} toneMapped={false} />
        </mesh>
      </group>
      {/* a little night sky over the booth */}
      <mesh position={[3.2, 7.2, -2.5]}>
        <sphereGeometry args={[0.55, 24, 16]} />
        <meshBasicMaterial color={hdr('#fff3d6', 2.2)} toneMapped={false} />
      </mesh>
      {near &&
        memories.map((m, i) => (
          <DistrictOrb
            key={m.id}
            memory={m}
            radius={m.isCore ? 0.62 : 0.45}
            place={(t, out) => out.set(m.isCore ? -0.4 : 3.2, m.isCore ? 5.2 + Math.sin(t) * 0.1 : 1.6 + Math.sin(t * 1.2 + i) * 0.12, m.isCore ? 0.6 : 1.4)}
          />
        ))}
    </group>
  )
}
