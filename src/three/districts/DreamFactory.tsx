import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { AdditiveBlending, DynamicDrawUsage, type Group, type InstancedMesh, MathUtils, Matrix4, Vector3 } from 'three'
import { type District, memoryById, MEMORIES } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { openMemory, orbsInteractive } from '../../lib/memoryActions'
import { rt } from '../../lib/runtime'
import { useMind } from '../../store'
import { DistrictOrb, hdr, Platform, useNear } from './common'

const CHIMNEYS: [number, number, number][] = [
  [-2.2, 4.6, -0.6],
  [0, 5.2, -0.6],
  [2.2, 4.3, -0.6],
]
const STORAGE = new Vector3(0, 1.8, 0)
export const LEVER_POS: [number, number, number] = [4.6, 0.25, 3]

/** Little puffs of idea-smoke rising from the chimneys (decorative, instanced). */
function Puffs({ colour, active }: { colour: string; active: () => number }) {
  const N = 36
  const ref = useRef<InstancedMesh>(null)
  const m4 = useMemo(() => new Matrix4(), [])
  const v = useMemo(() => new Vector3(), [])
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const a = active()
    for (let i = 0; i < N; i++) {
      const c = CHIMNEYS[i % 3]
      const k = (t * 0.22 + i / N) % 1
      v.set(c[0] + Math.sin(t * 0.7 + i) * 0.5 * k, c[1] + 0.6 + k * 6, c[2] + Math.cos(t * 0.5 + i) * 0.4 * k)
      const s = (0.18 + k * 0.55) * a * (1 - k * k)
      m4.makeScale(s, s, s).setPosition(v)
      mesh.setMatrixAt(i, m4)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} raycast={() => null} onUpdate={(m) => m.instanceMatrix.setUsage(DynamicDrawUsage)}>
      <sphereGeometry args={[1, 16, 12]} />
      <meshBasicMaterial color={hdr(colour, 1.2)} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  )
}

function FocusLever({ colour }: { colour: string }) {
  const arm = useRef<Group>(null)
  const focus = useMind((s) => s.focus)
  const [hover, setHover] = useState(false)
  useFrame((_, dt) => {
    if (arm.current) arm.current.rotation.x = MathUtils.damp(arm.current.rotation.x, focus ? 0.95 : -0.7, 5, Math.min(dt, 0.05))
  })
  const pull = (e: { stopPropagation: () => void }) => {
    if (!orbsInteractive() || rt.dragMoved) return
    e.stopPropagation()
    useMind.getState().toggleFocus()
  }
  return (
    <group position={LEVER_POS}>
      <mesh position-y={0.35}>
        <boxGeometry args={[1.1, 0.7, 0.8]} />
        <meshStandardMaterial color="#2a1a40" emissive={colour} emissiveIntensity={0.25} roughness={0.4} />
      </mesh>
      <group ref={arm} position-y={0.7}>
        <mesh position-y={0.9} onClick={pull} onPointerOver={() => (setHover(true), (document.body.style.cursor = 'pointer'))} onPointerOut={() => (setHover(false), (document.body.style.cursor = ''))}>
          <cylinderGeometry args={[0.07, 0.07, 1.8, 10]} />
          <meshStandardMaterial color="#d9cfff" metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position-y={1.85} onClick={pull}>
          <sphereGeometry args={[0.24, 20, 14]} />
          <meshBasicMaterial color={hdr(focus ? '#ffcf6a' : colour, hover ? 5 : 3)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

export function DreamFactory({ d }: { d: District }) {
  const colour = emotionColour(d.emotion)
  const near = useNear(d)
  const base = useMemo(() => MEMORIES.filter((m) => m.district === d.id && !m.tags.includes('konami')), [d])
  const extra = useMind((s) => s.extraIdeas)
  const ideas = useMemo(() => [...base, ...extra.map((id) => memoryById[id]).filter(Boolean)], [base, extra])
  // focus: 0 = ideas out floating, 1 = all put away in storage
  const stored = useRef(0)
  const [popped, setPopped] = useState<Record<string, boolean>>({})
  useFrame((_, dt) => {
    stored.current = MathUtils.damp(stored.current, useMind.getState().focus ? 1 : 0, 1.6, Math.min(dt, 0.05))
  })

  // each idea has a home in the cloud above the factory
  const homes = useMemo(
    () =>
      base.map((_, i) => {
        const a = i * 2.39996
        const r = 2.2 + (i % 5) * 0.75
        return new Vector3(Math.cos(a) * r, 6.2 + ((i * 7) % 9) * 0.55, Math.sin(a) * r * 0.65)
      }),
    [base],
  )

  return (
    <group>
      <Platform colour={colour} r={6.5} />
      {/* factory body with a sawtooth roof */}
      <mesh position-y={1.75}>
        <boxGeometry args={[7, 3, 4.2]} />
        <meshStandardMaterial color="#26163e" roughness={0.5} emissive={colour} emissiveIntensity={0.14} />
      </mesh>
      {[-2.3, 0, 2.3].map((x) => (
        <mesh key={x} position={[x, 3.6, 0.2]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.01, 1.3, 0.9, 3, 1]} />
          <meshStandardMaterial color="#3a2160" roughness={0.4} emissive={colour} emissiveIntensity={0.3} flatShading />
        </mesh>
      ))}
      {[-1.2, 0.2, 1.6].map((y) => (
        <mesh key={y} position={[0, 1.75 + y * 0.6, 2.12]}>
          <planeGeometry args={[6.2, 0.14]} />
          <meshBasicMaterial color={hdr(colour, 2.6)} toneMapped={false} />
        </mesh>
      ))}
      {CHIMNEYS.map(([x, y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={y / 2 + 1.4}>
            <cylinderGeometry args={[0.42, 0.58, y - 1.2, 16]} />
            <meshStandardMaterial color="#3a2160" roughness={0.4} emissive={colour} emissiveIntensity={0.2} />
          </mesh>
          <mesh position-y={y + 0.8} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.45, 0.05, 8, 32]} />
            <meshBasicMaterial color={hdr(colour, 3)} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <Puffs colour={colour} active={() => 1 - stored.current} />
      <FocusLever colour={colour} />

      {near &&
        ideas.map((m, i) => (
          <DistrictOrb
            key={m.id}
            memory={m}
            radius={0.5}
            status={popped[m.id] ? 'shipped' : 'idea'}
            presence={() => 1 - stored.current * 0.97}
            place={(t, out) => {
              out.copy(homes[i % homes.length])
              if (i >= homes.length) out.add(new Vector3(0, 2.5 + (i - homes.length) * 0.6, 0))
              out.x += Math.sin(t * 0.5 + i) * 0.35
              out.y += Math.sin(t * 0.7 + i * 1.7) * 0.3
              // invented ideas burst out of the middle chimney first
              if (i >= base.length && t < 1.8) {
                const c = CHIMNEYS[1]
                const k = t / 1.8
                const e = 1 - Math.pow(1 - k, 3)
                const from = new Vector3(c[0], c[1] + 1, c[2])
                out.lerpVectors(from, out, e).add(new Vector3(0, Math.sin(k * Math.PI) * 3, 0))
              }
              // FOCUS: drift back into storage
              out.lerp(STORAGE, stored.current)
            }}
            onActivate={(world) => {
              // the bubble pops into an orb, then projects
              if (popped[m.id]) return false
              setPopped((p) => ({ ...p, [m.id]: true }))
              useMind.getState().setHovered(null)
              setTimeout(() => {
                useMind.getState().setHovered(m.id)
                openMemory(m.id, 0.6, world)
              }, 380)
              return true
            }}
          />
        ))}
    </group>
  )
}
