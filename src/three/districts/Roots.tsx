import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CanvasTexture, CatmullRomCurve3, DynamicDrawUsage, type InstancedMesh, Matrix4, RepeatWrapping, SRGBColorSpace, TubeGeometry, Vector3 } from 'three'
import { type District, MEMORIES } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { DistrictOrb, hdr, useNear } from './common'

function tileTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#a8583a'
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = '#6e331f'
  g.lineWidth = 4
  g.strokeRect(0, 0, 128, 128)
  g.fillStyle = 'rgba(255,210,170,0.12)'
  g.beginPath()
  g.moveTo(64, 14)
  g.lineTo(114, 64)
  g.lineTo(64, 114)
  g.lineTo(14, 64)
  g.fill()
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(6, 6)
  t.colorSpace = SRGBColorSpace
  return t
}

const HALF = 5
const STRING_H = 4.6

/** A sagging string of lights between two posts. */
function catenary(a: Vector3, b: Vector3, sag: number) {
  const pts: Vector3[] = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    pts.push(a.clone().lerp(b, t).add(new Vector3(0, -Math.sin(t * Math.PI) * sag, 0)))
  }
  return new CatmullRomCurve3(pts)
}

function Arches({ colour }: { colour: string }) {
  const wall = '#8a4128'
  return (
    <>
      {[0, 1, 2, 3].map((side) => (
        <group key={side} rotation-y={(side * Math.PI) / 2}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 3.1, 1.1, HALF]}>
              <boxGeometry args={[3.6, 1.8, 0.4]} />
              <meshStandardMaterial color={wall} roughness={0.9} emissive={colour} emissiveIntensity={0.06} />
            </mesh>
          ))}
          <mesh position={[0, 1.95, HALF]} rotation-x={0}>
            <torusGeometry args={[1.3, 0.2, 8, 24, Math.PI]} />
            <meshStandardMaterial color={wall} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {[
        [-HALF, -HALF],
        [HALF, -HALF],
        [-HALF, HALF],
        [HALF, HALF],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={2.6}>
            <boxGeometry args={[0.6, 4.8, 0.6]} />
            <meshStandardMaterial color="#6e331f" roughness={0.85} />
          </mesh>
          <mesh position-y={5.15}>
            <sphereGeometry args={[0.28, 16, 12]} />
            <meshBasicMaterial color={hdr('#ffb46a', 4)} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function LanternStrings() {
  const curves = useMemo(
    () => [
      catenary(new Vector3(-HALF, STRING_H + 0.4, -HALF), new Vector3(HALF, STRING_H + 0.4, HALF), 1.2),
      catenary(new Vector3(HALF, STRING_H + 0.4, -HALF), new Vector3(-HALF, STRING_H + 0.4, HALF), 1.2),
      catenary(new Vector3(-HALF, STRING_H + 0.4, 0), new Vector3(HALF, STRING_H + 0.4, 0), 0.8),
    ],
    [],
  )
  const tubes = useMemo(() => curves.map((c) => new TubeGeometry(c, 40, 0.02, 4)), [curves])
  const ref = useRef<InstancedMesh>(null)
  const N = curves.length * 9
  const m4 = useMemo(() => new Matrix4(), [])
  const p = useMemo(() => new Vector3(), [])
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const c = curves[i % curves.length]
      c.getPoint((Math.floor(i / curves.length) + 0.5) / 9, p)
      p.x += Math.sin(t * 1.3 + i) * 0.05 // sway
      p.y -= 0.25
      m4.makeTranslation(p.x, p.y, p.z)
      mesh.setMatrixAt(i, m4)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color="#3a1c12" />
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[undefined, undefined, N]} onUpdate={(m) => m.instanceMatrix.setUsage(DynamicDrawUsage)}>
        <sphereGeometry args={[0.15, 12, 8]} />
        <meshBasicMaterial color={hdr('#ffc27a', 4.5)} toneMapped={false} />
      </instancedMesh>
    </>
  )
}

export function Roots({ d }: { d: District }) {
  const colour = emotionColour(d.emotion)
  const near = useNear(d)
  const memories = useMemo(() => MEMORIES.filter((m) => m.district === d.id), [d])
  const tiles = useMemo(tileTexture, [])
  return (
    <group>
      <mesh>
        <boxGeometry args={[HALF * 2 + 0.6, 0.45, HALF * 2 + 0.6]} />
        <meshStandardMaterial map={tiles} roughness={0.85} />
      </mesh>
      <Arches colour={colour} />
      <LanternStrings />
      {/* the planter at the heart of the courtyard */}
      <mesh position-y={0.5}>
        <cylinderGeometry args={[1.1, 1.25, 0.6, 24]} />
        <meshStandardMaterial color="#7a3a22" roughness={0.9} />
      </mesh>
      <mesh position-y={1.4}>
        <cylinderGeometry args={[0.12, 0.18, 1.4, 8]} />
        <meshStandardMaterial color="#3d2416" />
      </mesh>
      <pointLight position={[0, 3.5, 0]} color="#ffb070" intensity={18} distance={16} decay={1.6} />
      {near &&
        memories.map((m, i) => {
          // big lanterns hanging from the centre string, swinging gently
          const x = (i - (memories.length - 1) / 2) * 2.4
          return (
            <DistrictOrb
              key={m.id}
              memory={m}
              radius={0.55}
              place={(t, out) => {
                const swing = Math.sin(t * 1.1 + i * 2) * 0.12
                out.set(x + Math.sin(swing) * 1.4, STRING_H - 1.6 - (1 - Math.cos(swing)) * 1.4, 0)
              }}
            />
          )
        })}
    </group>
  )
}
