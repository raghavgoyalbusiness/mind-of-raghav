import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  CatmullRomCurve3,
  DoubleSide,
  type Group,
  LatheGeometry,
  MathUtils,
  type Mesh,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { CORE_MEMORIES, districtById } from '../data/mind'
import { EMOTION_INDEX, emotionColour } from '../lib/emotions'
import { orbsInteractive } from '../lib/memoryActions'
import { flyToDistrict } from '../lib/nav'
import { rt } from '../lib/runtime'
import { useMind } from '../store'
import { makeNeuralMaterial } from './neuralMaterial'
import { makeOrbMaterial, memoryTexture } from './orbMaterial'
import { shared } from './shared'

export const DECK = new Vector3(0, -1.2, -8)
const DECK_R = 3.6

/** Where each core memory floats above the pedestal. */
export const CORE_SLOTS = CORE_MEMORIES.map((_, i) => {
  const k = i - (CORE_MEMORIES.length - 1) / 2
  return new Vector3(DECK.x + k * 0.74, DECK.y + 1.78 + 0.1 * Math.cos(k * 0.8), DECK.z + 0.09 * k * k - 0.35)
})

const consoleMaterial = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  side: DoubleSide,
  uniforms: { uTime: shared.uTime, uHall: shared.uHall },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uHall;
    varying vec2 vUv;
    float line(float v, float w) { return smoothstep(w, 0.0, abs(fract(v) - 0.5) - 0.5 + w); }
    void main() {
      vec2 uv = vUv;
      float grid = line(uv.x * 36.0, 0.04) * 0.25 + line(uv.y * 6.0, 0.05) * 0.2;
      float col = floor(uv.x * 48.0);
      float h = 0.25 + 0.55 * abs(sin(col * 1.7 + uTime * (0.6 + fract(col * 0.37))));
      float bars = step(uv.y, h) * step(0.15, fract(uv.x * 48.0)) * 0.55;
      float scan = 0.5 + 0.5 * sin(uv.y * 140.0 - uTime * 4.0);
      float edge = smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.82, uv.y) * smoothstep(0.0, 0.06, uv.x) * smoothstep(1.0, 0.94, uv.x);
      float topLine = smoothstep(0.03, 0.0, abs(uv.y - 0.86)) * 1.4;
      vec3 c = mix(vec3(0.25, 0.95, 1.0), vec3(1.0, 0.75, 0.35), uv.x);
      float a = (grid + bars * (0.6 + 0.4 * scan) + topLine) * edge * uHall;
      gl_FragColor = vec4(c * a * 1.4, 1.0);
    }`,
})

const glowMaterial = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  uniforms: { uTime: shared.uTime, uHall: shared.uHall },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uHall;
    varying vec2 vUv;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float g = exp(-r * r * 4.0) * 0.5 + smoothstep(0.02, 0.0, abs(r - 0.52)) * 0.35;
      float ripple = 0.5 + 0.5 * sin(r * 30.0 - uTime * 1.5);
      vec3 c = mix(vec3(1.0, 0.7, 0.4), vec3(0.3, 0.9, 1.0), r);
      gl_FragColor = vec4(c * g * (0.75 + 0.25 * ripple) * uHall, 1.0);
    }`,
})

function GlassDeck() {
  const ticks = useRef<Group>(null)
  useFrame((_, dt) => {
    if (ticks.current) ticks.current.rotation.y += dt * 0.06
  })
  return (
    <group position={DECK}>
      <mesh>
        <cylinderGeometry args={[DECK_R, DECK_R * 0.96, 0.14, 96]} />
        <meshPhysicalMaterial color="#cfefff" roughness={0.06} metalness={0.1} clearcoat={1} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.07}>
        <torusGeometry args={[DECK_R, 0.035, 10, 192]} />
        <meshBasicMaterial color={[1.6, 3.2, 3.6]} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.075}>
        <torusGeometry args={[DECK_R * 0.68, 0.012, 8, 160]} />
        <meshBasicMaterial color={[2.6, 1.8, 0.9]} toneMapped={false} />
      </mesh>
      <group ref={ticks} position-y={0.08}>
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.sin(a) * DECK_R * 0.86, 0, Math.cos(a) * DECK_R * 0.86]} rotation-y={a}>
              <boxGeometry args={[0.02, 0.01, i % 4 === 0 ? 0.3 : 0.12]} />
              <meshBasicMaterial color={[1.4, 2.4, 2.8]} toneMapped={false} />
            </mesh>
          )
        })}
      </group>
      <mesh material={glowMaterial} rotation-x={-Math.PI / 2} position-y={-0.35}>
        <planeGeometry args={[DECK_R * 3.4, DECK_R * 3.4]} />
      </mesh>
      {/* the console of light, along the far edge */}
      <mesh material={consoleMaterial} position-y={0.5}>
        <cylinderGeometry args={[DECK_R * 0.86, DECK_R * 0.9, 0.75, 72, 1, true, Math.PI - 0.95, 1.9]} />
      </mesh>
    </group>
  )
}

function Pedestal() {
  const lathe = useMemo(
    () =>
      new LatheGeometry(
        [
          [0.0, 0.0],
          [0.62, 0.0],
          [0.66, 0.07],
          [0.32, 0.2],
          [0.2, 0.55],
          [0.18, 0.95],
          [0.3, 1.12],
          [0.36, 1.2],
          [0.0, 1.2],
        ].map(([x, y]) => new Vector2(x, y)),
        64,
      ),
    [],
  )
  const rail = useMemo(() => {
    const pts = CORE_SLOTS.map((p) => p.clone().add(new Vector3(0, -0.42, 0)))
    const ends = [pts[0].clone().add(new Vector3(-0.35, -0.1, 0.12)), pts[pts.length - 1].clone().add(new Vector3(0.35, -0.1, 0.12))]
    return new TubeGeometry(new CatmullRomCurve3([ends[0], ...pts, ends[1]]), 120, 0.022, 8)
  }, [])

  return (
    <group>
      <mesh geometry={lathe} position={[DECK.x, DECK.y + 0.07, DECK.z - 0.35]}>
        <meshPhysicalMaterial color="#fff4f8" roughness={0.25} metalness={0.05} clearcoat={0.8} emissive="#4a2a40" emissiveIntensity={0.4} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[DECK.x, DECK.y + 1.24, DECK.z - 0.35]}>
        <torusGeometry args={[0.34, 0.018, 8, 64]} />
        <meshBasicMaterial color={[3.2, 2.2, 1.0]} toneMapped={false} />
      </mesh>
      <mesh geometry={rail}>
        <meshBasicMaterial color={[2.4, 1.9, 1.5]} toneMapped={false} />
      </mesh>
      {CORE_SLOTS.map((p, i) => (
        <mesh key={i} position={[p.x, p.y - 0.42, p.z]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.11, 0.012, 8, 32]} />
          <meshBasicMaterial color={[2.8, 2.4, 2.0]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function CoreOrbs() {
  const geo = useMemo(() => new SphereGeometry(0.28, 48, 32), [])
  const mats = useMemo(
    () => CORE_MEMORIES.map((m) => makeOrbMaterial(emotionColour(m.emotion), 'shipped', memoryTexture(m.title, emotionColour(m.emotion)))),
    [],
  )
  const refs = useRef<(Mesh | null)[]>([])
  const lift = useRef(new Float32Array(CORE_MEMORIES.length))
  const world = useMemo(() => CORE_SLOTS.map((p) => p.clone()), [])

  useLayoutEffect(() => {
    CORE_MEMORIES.forEach((m, i) => rt.orbWorld.set(m.id, world[i]))
  }, [world])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 1 / 20)
    const { hovered, selected } = useMind.getState()
    refs.current.forEach((mesh, i) => {
      if (!mesh) return
      const id = CORE_MEMORIES[i].id
      const l = (lift.current[i] = MathUtils.damp(lift.current[i], id === hovered || id === selected ? 1 : 0, 7, dt))
      mesh.position.set(CORE_SLOTS[i].x, CORE_SLOTS[i].y + Math.sin(t * 0.9 + i * 1.3) * 0.05 + l * 0.32, CORE_SLOTS[i].z + l * 0.25)
      mesh.rotation.y += dt * (0.25 + l * 2.4)
      mesh.scale.setScalar(1 + l * 0.35)
      mats[i].uniforms.uHover.value = l
      const f = useMind.getState().filter
      mats[i].uniforms.uDim.value = MathUtils.damp(mats[i].uniforms.uDim.value, f === null || f === EMOTION_INDEX[CORE_MEMORIES[i].emotion] ? 1 : 0.1, 5, dt)
      world[i].copy(mesh.position)
      if (id === hovered && rt.hoverOwner === 'core') {
        rt.hoverWorld.copy(mesh.position)
        rt.hoverRadius = 0.28 * mesh.scale.x
      }
    })
  })

  return (
    <group>
      {CORE_MEMORIES.map((m, i) => (
        <mesh
          key={m.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          geometry={geo}
          material={mats[i]}
          position={CORE_SLOTS[i]}
          onPointerOver={(e) => {
            if (!orbsInteractive() || e.nativeEvent.pointerType === 'touch') return
            e.stopPropagation()
            rt.hoverOwner = 'core'
            useMind.getState().setHovered(m.id)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={(e) => {
            if (e.nativeEvent.pointerType === 'touch') return
            if (useMind.getState().hovered === m.id) useMind.getState().setHovered(null)
            document.body.style.cursor = ''
          }}
          onClick={(e) => {
            if (!orbsInteractive() || rt.dragMoved) return
            e.stopPropagation()
            if ((e.nativeEvent as PointerEvent).pointerType === 'touch' && useMind.getState().hovered !== m.id) {
              useMind.getState().setHovered(m.id)
              return
            }
            // core memories are portals: ride the cable out to their district
            useMind.getState().setHovered(null)
            travelFromCore(i)
          }}
        />
      ))}
    </group>
  )
}

/** Neural cables from each core memory to its district on the horizon. */
export const CORE_CABLES = CORE_MEMORIES.map((m, i) => {
  const d = districtById[m.district]
  const s = CORE_SLOTS[i].clone().add(new Vector3(0, -0.45, 0))
  const a = new Vector3(...d.anchor)
  const lerp = (k: number, y: number) => new Vector3(s.x + (a.x - s.x) * k, y, s.z + (a.z - s.z) * k)
  const points = [
    s,
    s.clone().add(new Vector3(0, -0.5, -0.4)),
    new Vector3(s.x * 1.5, DECK.y - 0.4, DECK.z - DECK_R - 0.6),
    lerp(0.25, -6.5 + i * 0.4),
    lerp(0.65, Math.min(a.y, 0) - 3),
    lerp(0.92, a.y - 1.5),
    a,
  ]
  return { memory: m, district: m.district, points, curve: new CatmullRomCurve3(points, false, 'centripetal') }
})

/** Ride a core memory's cable out to its district. */
export function travelFromCore(index: number) {
  const c = CORE_CABLES[index]
  flyToDistrict(c.district, c.points.slice(2, -1))
}

function CoreCables() {
  const cables = useMemo(
    () =>
      CORE_CABLES.map((c) => {
        const len = c.curve.getLength()
        return {
          geo: new TubeGeometry(c.curve, Math.ceil(len * 2.2), 0.05, 8),
          hit: new TubeGeometry(c.curve, Math.ceil(len * 0.5), 0.7, 5),
          mat: makeNeuralMaterial(emotionColour(c.memory.emotion), emotionColour(districtById[c.district].emotion), len),
        }
      }),
    [],
  )
  return (
    <group>
      {cables.map((c, i) => (
        <group key={i}>
          <mesh geometry={c.geo} material={c.mat} />
          <mesh
            geometry={c.hit}
            onPointerOver={(e) => {
              if (!orbsInteractive()) return
              e.stopPropagation()
              c.mat.uniforms.uBoost.value = 1
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              c.mat.uniforms.uBoost.value = 0
              document.body.style.cursor = ''
            }}
            onClick={(e) => {
              if (!orbsInteractive() || rt.dragMoved) return
              e.stopPropagation()
              travelFromCore(i)
            }}
          >
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function ControlDeck() {
  return (
    <group>
      <GlassDeck />
      <Pedestal />
      <CoreOrbs />
      <CoreCables />
      <pointLight position={[DECK.x, DECK.y + 2.6, DECK.z + 1]} color="#ffd9b0" intensity={6} distance={14} decay={1.6} />
    </group>
  )
}
