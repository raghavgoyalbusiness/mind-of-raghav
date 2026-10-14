import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferGeometry, CanvasTexture, CatmullRomCurve3, DoubleSide, EdgesGeometry, BoxGeometry, Float32BufferAttribute, ShaderMaterial, SRGBColorSpace, TubeGeometry, Vector3 } from 'three'
import { type District, MEMORIES } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { shared } from '../shared'
import { DistrictOrb, hdr, Platform, useNear } from './common'

/** Rounded-rectangle conveyor loop around the lab. */
function beltCurve(hx: number, hz: number, r: number, y: number) {
  const pts: Vector3[] = []
  const corners = [
    [hx - r, hz - r, 0],
    [-(hx - r), hz - r, Math.PI / 2],
    [-(hx - r), -(hz - r), Math.PI],
    [hx - r, -(hz - r), (3 * Math.PI) / 2],
  ] as const
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2)
      pts.push(new Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r))
    }
  }
  return new CatmullRomCurve3(pts, true, 'centripetal')
}

function ribbon(curve: CatmullRomCurve3, width: number, samples = 240) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const up = new Vector3(0, 1, 0)
  const side = new Vector3()
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const p = curve.getPointAt(u % 1)
    const t = curve.getTangentAt(u % 1)
    side.crossVectors(t, up).normalize().multiplyScalar(width / 2)
    pos.push(p.x - side.x, p.y, p.z - side.z, p.x + side.x, p.y, p.z + side.z)
    uv.push(u, 0, u, 1)
    if (i < samples) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const beltMaterial = (len: number) =>
  new ShaderMaterial({
    side: DoubleSide,
    uniforms: { uTime: shared.uTime, uHall: shared.uHall, uLen: { value: len } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uHall; uniform float uLen; varying vec2 vUv;
      void main() {
        float s = vUv.x * uLen * 1.4 - uTime * 0.85;
        float chevron = step(0.55, fract(s + abs(vUv.y - 0.5) * 0.9));
        float edge = smoothstep(0.42, 0.5, abs(vUv.y - 0.5));
        vec3 base = vec3(0.04, 0.09, 0.12);
        vec3 col = base + vec3(0.1, 0.55, 0.7) * chevron * 0.35 + vec3(0.4, 1.6, 2.0) * edge;
        gl_FragColor = vec4(col * uHall, 1.0);
      }`,
  })

/** "Apps shipped" counter, painted into a texture that ticks up when you arrive. */
function useCounterTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 200
    const tex = new CanvasTexture(c)
    tex.colorSpace = SRGBColorSpace
    const draw = (n: number, done: boolean) => {
      const g = c.getContext('2d')!
      g.clearRect(0, 0, 512, 200)
      g.fillStyle = 'rgba(160,240,255,0.75)'
      g.font = '500 30px "Space Grotesk", sans-serif'
      g.textAlign = 'center'
      g.letterSpacing = '8px'
      g.fillText('APPS SHIPPED', 256, 52)
      g.fillStyle = '#ffffff'
      g.shadowColor = '#38e6ff'
      g.shadowBlur = 24
      g.font = '600 112px "Space Grotesk", sans-serif'
      g.fillText(done ? `${n}+` : String(n), 256, 168)
      tex.needsUpdate = true
    }
    draw(0, false)
    return { tex, draw }
  }, [])
}

export function Workshop({ d }: { d: District }) {
  const colour = emotionColour(d.emotion)
  const near = useNear(d)
  const all = useMemo(() => MEMORIES.filter((m) => m.district === d.id), [d])
  const products = all.filter((m) => !m.tags.includes('toolbelt') && !m.isCore)
  const tools = all.filter((m) => m.tags.includes('toolbelt'))
  const core = all.find((m) => m.isCore)

  const curve = useMemo(() => beltCurve(5.6, 3.6, 1.3, 0.62), [])
  const len = useMemo(() => curve.getLength(), [curve])
  const belt = useMemo(() => ({ geo: ribbon(curve, 0.9), mat: beltMaterial(len), rail: new TubeGeometry(curve, 240, 0.035, 6, true) }), [curve, len])
  const edges = useMemo(() => new EdgesGeometry(new BoxGeometry(7, 3.6, 4.5)), [])

  // counter ticks up the first time you come close
  const counter = useCounterTexture()
  const tick = useRef({ start: -1, last: -1 })
  useEffect(() => {
    if (near && tick.current.start < 0) tick.current.start = performance.now()
  }, [near])
  useFrame(() => {
    const s = tick.current.start
    if (s < 0) return
    const x = Math.min((performance.now() - s) / 2600, 1)
    const n = Math.round(40 * (1 - Math.pow(1 - x, 3)))
    if (n !== tick.current.last) {
      tick.current.last = n
      counter.draw(n, x >= 1)
    }
  })

  const speed = 0.7 / len // belt travel, as a fraction of the loop per second
  return (
    <group>
      <Platform colour={colour} r={7.2} />
      {/* the lab */}
      <mesh position-y={2.05}>
        <boxGeometry args={[7, 3.6, 4.5]} />
        <meshPhysicalMaterial color="#9fefff" transparent opacity={0.13} roughness={0.05} metalness={0.1} depthWrite={false} side={DoubleSide} />
      </mesh>
      <lineSegments geometry={edges} position-y={2.05}>
        <lineBasicMaterial color={hdr(colour, 2.4)} toneMapped={false} />
      </lineSegments>
      {[-2, 0, 2].map((x) => (
        <mesh key={x} position={[x, 0.75, -0.6]}>
          <boxGeometry args={[1.5, 0.7, 1.4]} />
          <meshStandardMaterial color="#10303a" emissive={colour} emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 2.25, 2.27]}>
        <planeGeometry args={[3.4, 1.33]} />
        <meshBasicMaterial map={counter.tex} transparent toneMapped={false} color={[1.6, 1.6, 1.6]} />
      </mesh>
      {/* conveyor belt */}
      <mesh geometry={belt.geo} material={belt.mat} />
      <mesh geometry={belt.rail} position-y={0.08}>
        <meshBasicMaterial color={hdr(colour, 2)} toneMapped={false} />
      </mesh>
      {/* toolbelt shelf along the roof edge */}
      <mesh position={[0, 3.95, 2.55]}>
        <boxGeometry args={[7.2, 0.08, 0.55]} />
        <meshStandardMaterial color="#1d3f4a" emissive={colour} emissiveIntensity={0.3} />
      </mesh>

      {near && (
        <>
          {products.map((m, i) => (
            <DistrictOrb
              key={m.id}
              memory={m}
              radius={0.38}
              liftHeight={1.5}
              place={(t, out) => {
                curve.getPointAt((((i / products.length + t * speed) % 1) + 1) % 1, out)
                out.y += 0.42
              }}
            />
          ))}
          {tools.map((m, i) => (
            <DistrictOrb key={m.id} memory={m} radius={0.2} liftHeight={0.45} position={[-3.25 + i * 0.5, 4.2, 2.55]} />
          ))}
          {core && <DistrictOrb memory={core} radius={0.65} position={[0, 4.4, -0.6]} place={(t, out) => out.set(0, 4.9 + Math.sin(t) * 0.12, -0.6)} />}
        </>
      )}
    </group>
  )
}
