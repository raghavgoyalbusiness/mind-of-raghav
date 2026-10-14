import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedBufferAttribute, type InstancedMesh, MathUtils, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import { EMOTIONS } from '../lib/emotions'
import { openMemory, orbsInteractive } from '../lib/memoryActions'
import { MEMORY_ORB_R, PLACEMENTS, type Placement } from '../lib/memoryLayout'
import { rt } from '../lib/runtime'
import { useMind } from '../store'
import { makeInstancedOrbMaterial, memoryAtlas, STATUS_CODE } from './orbMaterial'

const m4 = new Matrix4()
const q = new Quaternion()
const s3 = new Vector3()
const Y = new Vector3(0, 1, 0)

function OrbGroup({ items, mat }: { items: Placement[]; mat: ReturnType<typeof makeInstancedOrbMaterial> }) {
  const ref = useRef<InstancedMesh>(null)
  const geo = useMemo(() => {
    const g = new SphereGeometry(MEMORY_ORB_R, 40, 28)
    const grid = mat.uniforms.uGrid.value as number
    const cell = new Float32Array(items.length * 2)
    const status = new Float32Array(items.length)
    const seed = new Float32Array(items.length)
    items.forEach((p, i) => {
      cell[i * 2] = p.index % grid
      cell[i * 2 + 1] = Math.floor(p.index / grid)
      status[i] = STATUS_CODE[p.memory.status]
      seed[i] = (p.index * 1.618) % 10
    })
    g.setAttribute('aCell', new InstancedBufferAttribute(cell, 2))
    g.setAttribute('aStatus', new InstancedBufferAttribute(status, 1))
    g.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1))
    g.setAttribute('aHover', new InstancedBufferAttribute(new Float32Array(items.length), 1))
    return g
  }, [items, mat])
  const lift = useMemo(() => new Float32Array(items.length), [items])
  const spin = useMemo(() => Float32Array.from(items, (_, i) => i * 0.7), [items])
  const world = useMemo(() => items.map(() => new Vector3()), [items])

  useLayoutEffect(() => {
    items.forEach((p, i) => rt.orbWorld.set(p.memory.id, world[i]))
  }, [items, world])

  useFrame((state, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 1 / 20)
    const { hovered, selected } = useMind.getState()
    const t = state.clock.elapsedTime
    const hoverAttr = geo.getAttribute('aHover') as InstancedBufferAttribute
    items.forEach((p, i) => {
      const on = p.memory.id === hovered || p.memory.id === selected ? 1 : 0
      lift[i] = MathUtils.damp(lift[i], on, 7, dt)
      spin[i] += dt * (0.25 + lift[i] * 2.4)
      const l = lift[i]
      // lift out of the shelf towards the valley, a little up
      world[i].copy(p.position)
      world[i].x -= p.side * 0.85 * l
      world[i].y += 0.22 * l + Math.sin(t * 0.8 + i) * 0.03
      q.setFromAxisAngle(Y, spin[i])
      const sc = 1 + 0.3 * l
      mesh.setMatrixAt(i, m4.compose(world[i], q, s3.set(sc, sc, sc)))
      hoverAttr.setX(i, l)
      if (p.memory.id === hovered && rt.hoverOwner === 'shelf') {
        rt.hoverWorld.copy(world[i])
        rt.hoverRadius = MEMORY_ORB_R * sc
      }
    })
    mesh.instanceMatrix.needsUpdate = true
    hoverAttr.needsUpdate = true
  })

  const idOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId === undefined ? null : items[e.instanceId]?.memory.id ?? null)

  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, items.length]}
      frustumCulled={false}
      onPointerMove={(e) => {
        if (!orbsInteractive() || e.nativeEvent.pointerType === 'touch') return
        e.stopPropagation()
        const id = idOf(e)
        rt.hoverOwner = 'shelf'
        if (id && useMind.getState().hovered !== id) useMind.getState().setHovered(id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={(e) => {
        if (e.nativeEvent.pointerType === 'touch') return
        const id = idOf(e)
        if (!id || useMind.getState().hovered === id) useMind.getState().setHovered(null)
        document.body.style.cursor = ''
      }}
      onClick={(e) => {
        if (!orbsInteractive() || rt.dragMoved) return
        e.stopPropagation()
        const id = idOf(e)
        if (!id) return
        // touch: first tap previews, second tap opens
        if ((e.nativeEvent as PointerEvent).pointerType === 'touch' && useMind.getState().hovered !== id) {
          rt.hoverOwner = 'shelf'
          useMind.getState().setHovered(id)
          return
        }
        openMemory(id, MEMORY_ORB_R * 1.3, world[e.instanceId!])
      }}
    />
  )
}

export function MemoryOrbs() {
  const { groups, mats } = useMemo(() => {
    const atlas = memoryAtlas(PLACEMENTS.map((p) => ({ title: p.memory.title, colour: EMOTIONS.find((e) => e.id === p.memory.emotion)!.colour })))
    const groups = EMOTIONS.map((e) => PLACEMENTS.filter((p) => p.memory.emotion === e.id))
    const mats = EMOTIONS.map((e) => makeInstancedOrbMaterial(e.colour, atlas.texture, atlas.grid))
    return { groups, mats }
  }, [])

  // emotion filter dims the other colours
  useFrame((_, delta) => {
    const f = useMind.getState().filter
    mats.forEach((m, i) => {
      m.uniforms.uDim.value = MathUtils.damp(m.uniforms.uDim.value, f === null || f === i ? 1 : 0.1, 5, Math.min(delta, 0.05))
    })
  })

  return (
    <group>
      {groups.map((items, i) => (items.length ? <OrbGroup key={EMOTIONS[i].id} items={items} mat={mats[i]} /> : null))}
    </group>
  )
}
