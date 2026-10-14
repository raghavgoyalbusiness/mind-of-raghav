import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CatmullRomCurve3, type Group, TubeGeometry, Vector3 } from 'three'
import { type District, MEMORIES } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { makeNeuralMaterial } from '../neuralMaterial'
import { DistrictOrb, hdr, useNear } from './common'

const R = 4
const CITIES: [string, number, number][] = [
  ['Delhi', 28.6, 77.2],
  ['London', 51.5, -0.13],
  ['Bangalore', 12.97, 77.6],
]

const latLon = (lat: number, lon: number, r = R) => {
  const phi = ((90 - lat) * Math.PI) / 180
  const th = ((lon + 180) * Math.PI) / 180
  return new Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)).multiplyScalar(r)
}

/** Great-circle arc lifted off the surface. */
function arc(a: Vector3, b: Vector3) {
  const pts: Vector3[] = []
  const ua = a.clone().normalize()
  const ub = b.clone().normalize()
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    const p = ua.clone().lerp(ub, t).normalize()
    pts.push(p.multiplyScalar(R + 0.05 + Math.sin(t * Math.PI) * 1.4))
  }
  return new CatmullRomCurve3(pts)
}

const RINGS = [
  { r: 6.2, tilt: 0.35, spin: 0.12, ids: ['young-founders-london', 'bombay-founders-club', 'genz-vc', 'founder-communities'] },
  { r: 8.4, tilt: -0.28, spin: -0.07, ids: ['three-cities', 'hackathons-and-startup-events', 'applications-sprint', 'first-class'] },
]

export function Atlas({ d }: { d: District }) {
  const colour = emotionColour(d.emotion)
  const near = useNear(d)
  const globe = useRef<Group>(null)
  const memories = useMemo(() => MEMORIES.filter((m) => m.district === d.id), [d])
  const cities = useMemo(() => CITIES.map(([, la, lo]) => latLon(la, lo)), [])
  const arcs = useMemo(
    () =>
      [
        [0, 1],
        [1, 2],
        [2, 0],
      ].map(([i, j]) => {
        const c = arc(cities[i], cities[j])
        return { geo: new TubeGeometry(c, 60, 0.04, 6), mat: makeNeuralMaterial('#ffd28a', '#f1ebff', c.getLength(), 3) }
      }),
    [cities],
  )
  useFrame((_, dt) => {
    if (globe.current) globe.current.rotation.y += Math.min(dt, 0.05) * 0.07
  })

  return (
    <group>
      <group ref={globe}>
        <mesh>
          <sphereGeometry args={[R, 64, 40]} />
          <meshPhysicalMaterial color="#d8e8ff" roughness={0.04} metalness={0} clearcoat={1} transparent opacity={0.14} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[R * 1.004, 24, 16]} />
          <meshBasicMaterial color={hdr(colour, 0.45)} wireframe transparent opacity={0.22} />
        </mesh>
        {cities.map((p, i) => (
          <group key={i} position={p}>
            <mesh>
              <sphereGeometry args={[0.16, 12, 8]} />
              <meshBasicMaterial color={hdr('#ffd28a', 7)} toneMapped={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.42, 12, 8]} />
              <meshBasicMaterial color={hdr('#ffd28a', 0.8)} transparent opacity={0.35} depthWrite={false} />
            </mesh>
          </group>
        ))}
        {arcs.map((a, i) => (
          <mesh key={i} geometry={a.geo} material={a.mat} />
        ))}
      </group>
      {RINGS.map((ring, ri) => (
        <mesh key={ri} rotation={[Math.PI / 2 + ring.tilt, 0, 0]}>
          <torusGeometry args={[ring.r, 0.015, 6, 160]} />
          <meshBasicMaterial color={hdr(colour, 1.2)} transparent opacity={0.5} toneMapped={false} />
        </mesh>
      ))}
      {near &&
        RINGS.flatMap((ring) =>
          ring.ids.map((id, k) => {
            const m = memories.find((x) => x.id === id) ?? MEMORIES.find((x) => x.id === id)
            if (!m) return null
            const phase = (k / ring.ids.length) * Math.PI * 2
            return (
              <DistrictOrb
                key={id}
                memory={m}
                radius={m.isCore ? 0.62 : 0.45}
                place={(t, out) => {
                  const a = phase + t * ring.spin
                  // orbit in the ring's tilted plane
                  out.set(Math.cos(a) * ring.r, 0, Math.sin(a) * ring.r)
                  const y = -out.z * Math.sin(ring.tilt)
                  out.z = out.z * Math.cos(ring.tilt)
                  out.y = y
                }}
              />
            )
          }),
        )}
    </group>
  )
}
