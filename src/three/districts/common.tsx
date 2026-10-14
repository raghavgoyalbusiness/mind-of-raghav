import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Color, MathUtils, type Mesh, SphereGeometry, Vector3 } from 'three'
import type { District, Memory, MemoryStatus } from '../../data/mind'
import { EMOTION_INDEX, emotionColour } from '../../lib/emotions'
import { openMemory, orbsInteractive } from '../../lib/memoryActions'
import { rt } from '../../lib/runtime'
import { useMind } from '../../store'
import { makeOrbMaterial, memoryTexture } from '../orbMaterial'

export const hdr = (hex: string, k: number) => new Color(hex).multiplyScalar(k)

const geoCache = new Map<number, SphereGeometry>()
const sphere = (r: number) => {
  if (!geoCache.has(r)) geoCache.set(r, new SphereGeometry(r, 40, 28))
  return geoCache.get(r)!
}

let uid = 0

type OrbProps = {
  memory: Memory
  radius?: number
  position?: [number, number, number]
  /** animate the orb's local position on its own clock (paused while hovered/open) */
  place?: (t: number, out: Vector3) => void
  status?: MemoryStatus
  /** return true to take over the click (e.g. a bubble that pops first) */
  onActivate?: (world: Vector3) => boolean | void
  /** 0..1 externally driven fade/shrink (e.g. bubbles drifting into storage) */
  presence?: () => number
  /** how far the orb rises when hovered (default: most of its radius) */
  liftHeight?: number
}

/** A single interactive memory orb living inside a district. */
export function DistrictOrb({ memory, radius = 0.45, position = [0, 0, 0], place, status, onActivate, presence, liftHeight }: OrbProps) {
  const key = useMemo(() => `d${uid++}`, [])
  const colour = emotionColour(memory.emotion)
  const mat = useMemo(() => makeOrbMaterial(colour, status ?? memory.status, memoryTexture(memory.title, colour)), [colour, memory, status])
  const mesh = useRef<Mesh>(null)
  const clock = useRef(0)
  const lift = useRef(0)
  const base = useMemo(() => new Vector3(...position), [position])
  const world = useMemo(() => new Vector3(), [])

  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    rt.districtOrbWorld.set(memory.id, world)
    return () => {
      if (rt.districtOrbWorld.get(memory.id) === world) rt.districtOrbWorld.delete(memory.id)
    }
  }, [memory.id, world])

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(delta, 1 / 20)
    const { hovered, selected } = useMind.getState()
    const mine = (hovered === memory.id && rt.hoverOwner === key) || (selected === memory.id && rt.projWorld === world)
    if (!mine) clock.current += dt
    if (place) place(clock.current, base)
    const l = (lift.current = MathUtils.damp(lift.current, mine ? 1 : 0, 7, dt))
    const pr = presence ? presence() : 1
    m.position.set(base.x, base.y + l * (liftHeight ?? radius * 0.8), base.z)
    m.rotation.y += dt * (0.3 + l * 2.4)
    m.scale.setScalar((1 + l * 0.35) * Math.max(pr, 0.001))
    m.visible = pr > 0.01
    mat.uniforms.uHover.value = l
    const f = useMind.getState().filter
    mat.uniforms.uDim.value = MathUtils.damp(mat.uniforms.uDim.value, f === null || f === EMOTION_INDEX[memory.emotion] ? 1 : 0.1, 5, dt)
    m.getWorldPosition(world)
    if (hovered === memory.id && rt.hoverOwner === key) {
      rt.hoverWorld.copy(world)
      rt.hoverRadius = radius * m.scale.x
    }
  })

  const active = () => orbsInteractive() && (!presence || presence() > 0.5)

  return (
    <mesh
      ref={mesh}
      geometry={sphere(radius)}
      material={mat}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!active() || e.nativeEvent.pointerType === 'touch') return
        e.stopPropagation()
        rt.hoverOwner = key
        useMind.getState().setHovered(memory.id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        if (e.nativeEvent.pointerType === 'touch') return
        if (useMind.getState().hovered === memory.id && rt.hoverOwner === key) useMind.getState().setHovered(null)
        document.body.style.cursor = ''
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!active() || rt.dragMoved) return
        e.stopPropagation()
        if ((e.nativeEvent as PointerEvent).pointerType === 'touch' && !(useMind.getState().hovered === memory.id && rt.hoverOwner === key)) {
          rt.hoverOwner = key
          useMind.getState().setHovered(memory.id)
          return
        }
        if (onActivate?.(world)) return
        openMemory(memory.id, radius * (mesh.current?.scale.x ?? 1), world)
      }}
    />
  )
}

/**
 * Lazy detail: true once the camera is close to a district (or has flown to it).
 * Uses hysteresis so details don't flicker at the boundary.
 */
export function useNear(d: District, radius = 75) {
  const [near, setNear] = useState(false)
  const anchor = useMemo(() => new Vector3(...d.anchor), [d])
  const nearRef = useRef(false)
  useFrame(() => {
    const cam = rt.camera
    if (!cam) return
    const focused = useMind.getState().district === d.id
    const dist = cam.position.distanceTo(anchor)
    const next = focused || (nearRef.current ? dist < radius * 1.15 : dist < radius)
    if (next !== nearRef.current) {
      nearRef.current = next
      setNear(next)
    }
  })
  return near
}

export function Platform({ colour, r = 4, h = 0.5 }: { colour: string; r?: number; h?: number }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[r, r * 0.82, h, 64]} />
        <meshStandardMaterial color="#2a1630" roughness={0.55} emissive={colour} emissiveIntensity={0.08} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={h / 2 + 0.01}>
        <torusGeometry args={[r, 0.05, 8, 128]} />
        <meshBasicMaterial color={hdr(colour, 3)} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={-h / 2 - 0.3}>
        <torusGeometry args={[r * 0.6, 0.03, 8, 96]} />
        <meshBasicMaterial color={hdr(colour, 1.6)} toneMapped={false} />
      </mesh>
    </group>
  )
}

export const ringPlace = (r: number, y: number, speed: number, phase: number, wobble = 0.2) => (t: number, out: Vector3) => {
  const a = t * speed + phase
  out.set(Math.cos(a) * r, y + Math.sin(t * 0.9 + phase * 3) * wobble, Math.sin(a) * r)
}
