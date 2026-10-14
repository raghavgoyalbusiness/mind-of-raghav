import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Color, ExtrudeGeometry, type Group, type InstancedMesh, Matrix4, Shape, SRGBColorSpace, Vector2 } from 'three'
import { type District, MEMORIES } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { hash4 } from '../../lib/random'
import { DistrictOrb, useNear } from './common'

/** Front outline of a running vest (units ≈ metres × 2). */
const OUTLINE: [number, number][] = [
  [-1.0, 2.6], [-0.55, 2.6], [-0.3, 1.9], [0.0, 1.6], [0.3, 1.9], [0.55, 2.6], [1.0, 2.6],
  [1.05, 1.6], [1.55, 1.15], [1.6, -2.2], [-1.6, -2.2], [-1.55, 1.15], [-1.05, 1.6],
]

function inside(x: number, y: number) {
  let c = false
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i]
    const [xj, yj] = OUTLINE[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

function bibTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#fff6ec'
  g.fillRect(0, 0, 512, 256)
  g.fillStyle = '#1a0a08'
  g.font = '700 120px "Space Grotesk", sans-serif'
  g.textAlign = 'center'
  g.fillText('2027', 256, 150)
  g.font = '500 30px "Space Grotesk", sans-serif'
  g.fillText('LONDON · MAKE-A-WISH UK', 256, 210)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** The race vest, split into ad blocks. Sponsored blocks glow. */
function Vest() {
  const shape = useMemo(() => new Shape(OUTLINE.map(([x, y]) => new Vector2(x, y))), [])
  const geo = useMemo(() => new ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), [shape])
  const blocks = useMemo(() => {
    const out: { x: number; y: number; sponsored: boolean }[] = []
    const S = 0.36
    for (let y = -2.0; y < 2.5; y += S)
      for (let x = -1.5; x < 1.55; x += S) {
        const cx = x + S / 2
        const cy = y + S / 2
        if (Math.abs(cx) < 0.65 && cy > -0.8 && cy < 0.35) continue // the bib
        if (inside(cx - S * 0.4, cy - S * 0.4) && inside(cx + S * 0.4, cy + S * 0.4) && inside(cx - S * 0.4, cy + S * 0.4) && inside(cx + S * 0.4, cy - S * 0.4))
          out.push({ x: cx, y: cy, sponsored: hash4(Math.round(cx * 10), Math.round(cy * 10), 27, 1) < 0.38 })
      }
    return out
  }, [])
  const ref = useRef<InstancedMesh>(null)
  const bib = useMemo(bibTexture, [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m4 = new Matrix4()
    blocks.forEach((b, i) => {
      mesh.setMatrixAt(i, m4.makeTranslation(b.x, b.y, 0.25))
      mesh.setColorAt(i, new Color(b.sponsored ? '#ffb43a' : '#3a1410'))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [blocks])
  // sponsor blocks breathe
  const c = useMemo(() => new Color(), [])
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh?.instanceColor) return
    const t = state.clock.elapsedTime
    blocks.forEach((b, i) => {
      if (!b.sponsored) return
      const k = 2.2 + Math.sin(t * 2 + i * 0.9) * 0.9
      mesh.setColorAt(i, c.set('#ffb43a').multiplyScalar(k))
    })
    mesh.instanceColor.needsUpdate = true
  })
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#6a1408" roughness={0.75} emissive="#ff4526" emissiveIntensity={0.12} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]}>
        <boxGeometry args={[0.32, 0.32, 0.04]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <mesh position={[0, -0.22, 0.26]}>
        <planeGeometry args={[1.25, 0.62]} />
        <meshBasicMaterial map={bib} />
      </mesh>
    </group>
  )
}

export function TrackVest({ d }: { d: District }) {
  const near = useNear(d)
  const vest = useRef<Group>(null)
  const memories = useMemo(() => MEMORIES.filter((m) => m.district === d.id), [d])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (vest.current) {
      vest.current.rotation.y = Math.sin(t * 0.35) * 0.45
      vest.current.position.y = 3.2 + Math.sin(t * 0.8) * 0.12
    }
  })
  return (
    <group>
      <group ref={vest}>
        <Vest />
      </group>
      <pointLight position={[0, 3.5, 3]} color={emotionColour('grit')} intensity={10} distance={10} />
      {near &&
        memories.map((m, i) => (
          <DistrictOrb
            key={m.id}
            memory={m}
            radius={m.isCore ? 0.6 : 0.42}
            place={(t, out) => {
              const a = t * 0.25 + (i / memories.length) * Math.PI * 2
              out.set(Math.cos(a) * 2.9, 3.4 + Math.sin(t + i) * 0.25, Math.sin(a) * 1.6)
            }}
          />
        ))}
    </group>
  )
}
