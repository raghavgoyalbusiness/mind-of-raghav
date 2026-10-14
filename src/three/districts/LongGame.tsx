import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, Float32BufferAttribute, type Group, type LineSegments, MathUtils, ShaderMaterial, Vector3 } from 'three'
import { SKY_GLSL } from '../Hall'
import { shared } from '../shared'
import { type District, memoryById } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { mulberry32 } from '../../lib/random'
import { DistrictOrb, hdr, useNear } from './common'

const W = 6 // door opening

/** The end wall wears the sky itself, so only the doorway reads. */
const skyWall = new ShaderMaterial({
  fog: false,
  uniforms: { uHall: shared.uHall, uNight: shared.uNight },
  vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `uniform float uHall; varying vec3 vW; ${SKY_GLSL} void main(){ gl_FragColor = vec4(skyColour(normalize(vW - cameraPosition)) * uHall, 1.0); }`,
})
const H = 14

/** The decade plan, as three constellations behind the door. */
export const CHAPTERS = [
  { id: 'decade-anton', label: 'Now → 25', text: 'Build Anton', at: new Vector3(-3.2, 2.8, -12), stars: [[0, 0], [1.4, 0.8], [2.6, 0.2], [3.4, 1.6], [2.2, 2.6], [1.0, 2.0]] },
  { id: 'decade-capital', label: 'After 25', text: 'Capital-intensive ventures', at: new Vector3(1.2, -1.2, -18), stars: [[0, 0], [1.2, -0.9], [2.8, -0.6], [3.6, 0.8], [2.4, 1.8], [0.8, 1.4], [1.8, 0.4]] },
  { id: 'decade-book', label: 'After 28', text: 'Write the book', at: new Vector3(-1.4, 6.4, -24), stars: [[0, 0], [1.6, 0.3], [2.2, 1.8], [0.6, 2.2], [-0.4, 1.2]] },
]

function Starfield() {
  const geo = useMemo(() => {
    const rnd = mulberry32(28)
    const pos: number[] = []
    for (let i = 0; i < 900; i++) pos.push((rnd() - 0.5) * 44, (rnd() - 0.4) * 34, -4 - rnd() * 40)
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    return g
  }, [])
  return (
    <points geometry={geo} raycast={() => null}>
      <pointsMaterial size={0.09} color={hdr('#f3eeff', 2.4)} toneMapped={false} sizeAttenuation />
    </points>
  )
}

function Constellation({ c, reveal }: { c: (typeof CHAPTERS)[number]; reveal: () => number }) {
  const lines = useRef<LineSegments>(null)
  const { geo, segs } = useMemo(() => {
    const pos: number[] = []
    for (let i = 0; i < c.stars.length - 1; i++) {
      const [ax, ay] = c.stars[i]
      const [bx, by] = c.stars[i + 1]
      pos.push(ax, ay, 0, bx, by, 0)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    return { geo: g, segs: c.stars.length - 1 }
  }, [c])
  const stars = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(c.stars.flatMap(([x, y]) => [x, y, 0]), 3))
    return g
  }, [c])
  useFrame(() => {
    // constellations draw themselves, segment by segment
    const n = Math.floor(reveal() * segs * 2 + 0.0001)
    geo.setDrawRange(0, Math.min(n, segs) * 2)
  })
  const m = memoryById[c.id]
  return (
    <group position={c.at}>
      <points geometry={stars}>
        <pointsMaterial size={0.32} color={hdr('#ffffff', 4)} toneMapped={false} />
      </points>
      <lineSegments ref={lines} geometry={geo}>
        <lineBasicMaterial color={hdr('#c9b8ff', 2.2)} toneMapped={false} transparent opacity={0.8} />
      </lineSegments>
      <DistrictOrb memory={m} radius={0.42} position={[c.stars[0][0], c.stars[0][1], 0]} />
    </group>
  )
}

export function LongGame({ d }: { d: District }) {
  const colour = emotionColour(d.emotion)
  const near = useNear(d, 60)
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const open = useRef(0)
  const reveal = useRef(0)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    open.current = MathUtils.damp(open.current, near ? 1 : 0, 1.2, dt)
    // constellations begin drawing once the doors are mostly open
    reveal.current = near ? Math.min(reveal.current + dt * (open.current > 0.6 ? 0.22 : 0), 1) : Math.max(reveal.current - dt * 0.5, 0)
    if (left.current) left.current.rotation.y = -open.current * 1.75
    if (right.current) right.current.rotation.y = open.current * 1.75
  })
  const frame = hdr(colour, 2.6)
  return (
    <group>
      {/* the canyon's end wall, with the doorway cut out */}
      {[
        [-(W / 2 + 45), 0, 90, 140],
        [W / 2 + 45, 0, 90, 140],
        [0, H / 2 + 35, W, 70],
        [0, -(H / 2 + 35), W, 70],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, -0.4]} material={skyWall}>
          <planeGeometry args={[w, h]} />
        </mesh>
      ))}
      {[
        [-W / 2, 0, 0.3, H],
        [W / 2, 0, 0.3, H],
        [0, H / 2, W + 0.3, 0.3],
        [0, -H / 2, W + 0.3, 0.3],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <boxGeometry args={[w, h, 0.4]} />
          <meshBasicMaterial color={frame} toneMapped={false} />
        </mesh>
      ))}
      {/* the doors, hinged at each side */}
      <group ref={left} position={[-W / 2, 0, 0.1]}>
        <mesh position={[W / 4, 0, 0]}>
          <boxGeometry args={[W / 2 - 0.05, H - 0.2, 0.18]} />
          <meshStandardMaterial color="#120a1c" roughness={0.4} metalness={0.3} emissive={colour} emissiveIntensity={0.08} />
        </mesh>
      </group>
      <group ref={right} position={[W / 2, 0, 0.1]}>
        <mesh position={[-W / 4, 0, 0]}>
          <boxGeometry args={[W / 2 - 0.05, H - 0.2, 0.18]} />
          <meshStandardMaterial color="#120a1c" roughness={0.4} metalness={0.3} emissive={colour} emissiveIntensity={0.08} />
        </mesh>
      </group>
      {/* beyond the door: deep space */}
      <mesh position={[0, 0, -45]}>
        <planeGeometry args={[70, 60]} />
        <meshBasicMaterial color="#03020a" />
      </mesh>
      <Starfield />
      {near && CHAPTERS.map((c) => <Constellation key={c.id} c={c} reveal={() => reveal.current} />)}
    </group>
  )
}
