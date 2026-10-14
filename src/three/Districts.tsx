import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CatmullRomCurve3, Color, type Mesh, type ShaderMaterial, TubeGeometry, Vector3 } from 'three'
import { DISTRICTS, districtById, type District } from '../data/mind'
import { emotionColour } from '../lib/emotions'
import { canyonX, FLOOR_Y } from '../lib/hallLayout'
import { orbsInteractive } from '../lib/memoryActions'
import { flyToDistrict } from '../lib/nav'
import { rt } from '../lib/runtime'
import { useMind } from '../store'
import { Atelier } from './districts/Atelier'
import { Atlas } from './districts/Atlas'
import { DreamFactory } from './districts/DreamFactory'
import { FounderHQ } from './districts/FounderHQ'
import { LongGame } from './districts/LongGame'
import { Roots } from './districts/Roots'
import { Studio } from './districts/Studio'
import { TrackVest } from './districts/TrackVest'
import { Workshop } from './districts/Workshop'
import { makeNeuralMaterial } from './neuralMaterial'

const hdr = (hex: string, k: number) => new Color(hex).multiplyScalar(k)

const BUILDS: Record<string, (p: { d: District }) => React.JSX.Element> = {
  'founder-hq': FounderHQ,
  workshop: Workshop,
  'dream-factory': DreamFactory,
  atelier: Atelier,
  roots: Roots,
  atlas: Atlas,
  studio: Studio,
  track: TrackVest,
  'long-game': LongGame,
}

/* ---------- the Track: a long loop along the valley floor ---------- */

export const TRACK_CURVE = (() => {
  const pts: Vector3[] = []
  const cz = -95
  const rz = 115
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2
    const z = cz + Math.sin(a) * rz
    pts.push(new Vector3(canyonX(z) + Math.cos(a) * 9.5, FLOOR_Y + 2, z))
  }
  return new CatmullRomCurve3(pts, true, 'centripetal')
})()

function Track() {
  const colour = emotionColour('grit')
  const geo = useMemo(() => new TubeGeometry(TRACK_CURVE, 600, 0.12, 6, true), [])
  const mat = useMemo(() => makeNeuralMaterial(colour, '#ffb07a', TRACK_CURVE.getLength(), 14), [colour])
  const runner = useRef<Mesh>(null)
  const t0 = useRef(0)
  useFrame((_, dt) => {
    // the runner speeds up the longer you stay
    t0.current += dt * (0.004 + Math.min(performance.now() / 1000 / 600, 1) * 0.01)
    if (runner.current) TRACK_CURVE.getPointAt(t0.current % 1, runner.current.position).add(new Vector3(0, 0.6, 0))
  })
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      <mesh ref={runner}>
        <sphereGeometry args={[0.45, 16, 12]} />
        <meshBasicMaterial color={hdr('#ffe2c4', 6)} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------- neural pathways between districts ---------- */

const PATHWAYS: [string, string][] = [
  ['founder-hq', 'workshop'],
  ['founder-hq', 'dream-factory'],
  ['founder-hq', 'long-game'],
  ['workshop', 'atelier'],
  ['dream-factory', 'studio'],
  ['atlas', 'studio'],
  ['atlas', 'atelier'],
  ['roots', 'dream-factory'],
]

export type Route = { key: string; from: string; to: string; points: Vector3[]; curve: CatmullRomCurve3 }

export const ROUTES: Route[] = PATHWAYS.map(([a, b]) => {
  const A = new Vector3(...districtById[a].anchor).add(new Vector3(0, 6.5, 0))
  const B = new Vector3(...districtById[b].anchor).add(new Vector3(0, 6.5, 0))
  const mid = A.clone().lerp(B, 0.5)
  mid.y = Math.max(A.y, B.y) + 6 + A.distanceTo(B) * 0.06
  const points = [A, A.clone().lerp(mid, 0.6).setY(mid.y * 0.9), mid, B.clone().lerp(mid, 0.6).setY(mid.y * 0.9), B]
  return { key: a + '>' + b, from: a, to: b, points, curve: new CatmullRomCurve3(points) }
})

/** Click a neural pathway to ride it, from whichever end is nearer to the far one. */
export function ridePath(points: Vector3[], from: string, to: string) {
  const cam = rt.camera?.position ?? new Vector3()
  const forward = cam.distanceTo(points[0]) <= cam.distanceTo(points[points.length - 1])
  const route = forward ? points : [...points].reverse()
  flyToDistrict(forward ? to : from, route.slice(1, -1))
}

function Pathway({ r }: { r: Route }) {
  const { geo, hit, mat } = useMemo(() => {
    const len = r.curve.getLength()
    return {
      geo: new TubeGeometry(r.curve, Math.ceil(len * 1.2), 0.09, 6),
      hit: new TubeGeometry(r.curve, Math.ceil(len * 0.4), 1.1, 5),
      mat: makeNeuralMaterial(emotionColour(districtById[r.from].emotion), emotionColour(districtById[r.to].emotion), len, 7),
    }
  }, [r])
  const boost = useRef(0)
  useFrame((_, dt) => {
    const u = (mat as ShaderMaterial).uniforms.uBoost
    u.value += ((boost.current ? 1 : 0) - u.value) * Math.min(dt * 6, 1)
  })
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      <mesh
        geometry={hit}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          if (!orbsInteractive()) return
          e.stopPropagation()
          boost.current = 1
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          boost.current = 0
          document.body.style.cursor = ''
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!orbsInteractive() || rt.dragMoved) return
          e.stopPropagation()
          ridePath(r.points, r.from, r.to)
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function Districts() {
  return (
    <group>
      {DISTRICTS.map((d) => {
        const Build = BUILDS[d.id]
        return (
          <group
            key={d.id}
            position={d.anchor}
            // clicking a district's structure flies you there
            onClick={(e: ThreeEvent<MouseEvent>) => {
              if (!orbsInteractive() || rt.dragMoved || useMind.getState().district === d.id) return
              e.stopPropagation()
              flyToDistrict(d.id)
            }}
          >
            {Build && <Build d={d} />}
          </group>
        )
      })}
      <Track />
      {ROUTES.map((r) => (
        <Pathway key={r.key} r={r} />
      ))}
    </group>
  )
}
