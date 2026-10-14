import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, type Group, type Mesh, SRGBColorSpace } from 'three'
import { type District, MEMORIES } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { DistrictOrb, hdr, useNear } from './common'

function ringText(g: CanvasRenderingContext2D, text: string, r: number, size: number, alpha: number) {
  g.save()
  g.translate(512, 512)
  g.font = `600 ${size}px "Space Grotesk", sans-serif`
  g.fillStyle = `rgba(255,255,255,${alpha})`
  g.textAlign = 'center'
  const chars = [...text]
  chars.forEach((ch, i) => {
    g.save()
    g.rotate((i / chars.length) * Math.PI * 2)
    g.fillText(ch, 0, -r)
    g.restore()
  })
  g.restore()
}

/** "We On Go", projected on the floor in light. */
function taglineTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 1024
  const g = c.getContext('2d')!
  g.shadowColor = '#ffffff'
  g.shadowBlur = 16
  ringText(g, 'WE ON GO · WE ON GO · WE ON GO · WE ON GO · ', 440, 64, 0.9)
  ringText(g, 'MAN GOD · LIMITED EDITION · COMING 2027 · ', 330, 34, 0.55)
  g.strokeStyle = 'rgba(255,255,255,0.35)'
  g.lineWidth = 2
  for (const r of [485, 380, 300]) {
    g.beginPath()
    g.arc(512, 512, r, 0, Math.PI * 2)
    g.stroke()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function fogTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,0.5)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

const PLINTHS: { id: string; pos: [number, number, number]; h: number }[] = [
  { id: 'man-god', pos: [0, 0, 0], h: 2.2 },
  { id: 'man-god-tees', pos: [-3.6, 0, 1.6], h: 1.3 },
  { id: 'printed-hoodies', pos: [3.6, 0, 1.6], h: 1.3 },
  { id: 'firesoles', pos: [0, 0, -3.8], h: 1.6 },
]

export function Atelier({ d }: { d: District }) {
  const colour = emotionColour(d.emotion)
  const near = useNear(d)
  const memories = useMemo(() => MEMORIES.filter((m) => m.district === d.id), [d])
  const tagline = useMemo(taglineTexture, [])
  const fog = useMemo(fogTexture, [])
  const proj = useRef<Mesh>(null)
  const mist = useRef<Group>(null)
  useFrame((state, dt) => {
    if (proj.current) proj.current.rotation.z += Math.min(dt, 0.05) * 0.12
    const t = state.clock.elapsedTime
    mist.current?.children.forEach((c, i) => {
      c.position.x = Math.sin(t * 0.05 + i * 1.7) * 6
      c.position.z = Math.cos(t * 0.04 + i * 2.3) * 5
      c.quaternion.copy(state.camera.quaternion) // billboard: always face the viewer
    })
  })

  return (
    <group>
      {/* black glass floor with a pearl edge */}
      <mesh>
        <cylinderGeometry args={[7.5, 7.2, 0.4, 96]} />
        <meshPhysicalMaterial color="#060507" roughness={0.12} metalness={0.4} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.21}>
        <torusGeometry args={[7.5, 0.05, 8, 160]} />
        <meshBasicMaterial color={hdr(colour, 2.6)} toneMapped={false} />
      </mesh>
      <mesh ref={proj} rotation-x={-Math.PI / 2} position-y={0.22}>
        <circleGeometry args={[7, 96]} />
        <meshBasicMaterial map={tagline} color={hdr('#f4ecff', 1.6)} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {PLINTHS.map((p) => (
        <group key={p.id} position={p.pos}>
          <mesh position-y={p.h / 2 + 0.2}>
            <boxGeometry args={[0.9, p.h, 0.9]} />
            <meshPhysicalMaterial color="#020203" roughness={0.12} metalness={0.2} clearcoat={1} />
          </mesh>
          <mesh position-y={p.h + 0.22}>
            <boxGeometry args={[0.96, 0.04, 0.96]} />
            <meshBasicMaterial color={hdr(colour, 2.2)} toneMapped={false} />
          </mesh>
          {/* a spotlight cone from above */}
          <mesh position-y={p.h + 3.6} raycast={() => null}>
            <coneGeometry args={[1.1, 6, 32, 1, true]} />
            <meshBasicMaterial color={hdr('#fff4ff', 0.018)} transparent blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <group ref={mist}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[0, 0.8 + (i % 3) * 0.7, 0]} raycast={() => null}>
            <planeGeometry args={[7, 3.2]} />
            <meshBasicMaterial map={fog} color={hdr('#e9e2ff', 0.5)} transparent blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {near &&
        PLINTHS.map((p) => {
          const m = memories.find((x) => x.id === p.id)
          if (!m) return null
          const r = p.id === 'man-god' ? 0.65 : 0.45
          return <DistrictOrb key={m.id} memory={m} radius={r} place={(t, out) => out.set(p.pos[0], p.h + 0.25 + r + 0.15 + Math.sin(t * 1.1 + p.pos[0]) * 0.08, p.pos[2])} />
        })}
    </group>
  )
}
