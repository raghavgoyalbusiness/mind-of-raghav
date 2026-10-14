import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, ConeGeometry, DoubleSide, DynamicDrawUsage, type Group, type InstancedMesh, MathUtils, Matrix4, type Mesh, ShaderMaterial, Vector3 } from 'three'
import { type District, MEMORIES } from '../../data/mind'
import { emotionColour } from '../../lib/emotions'
import { useMind } from '../../store'
import { shared } from '../shared'
import { DistrictOrb, hdr, ringPlace, useNear } from './common'

const BEACON_Y = 6.3 // relative to the anchor: inside the lantern room

const beamMaterial = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  side: DoubleSide,
  uniforms: { uHall: shared.uHall, uPower: shared.uBeaconPower },
  vertexShader: /* glsl */ `
    varying float vAlong;
    varying float vEdge;
    void main() {
      vAlong = 1.0 - uv.y; // 0 at the lamp, 1 at the far end
      vec3 n = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vEdge = abs(dot(n, normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uHall;
    uniform float uPower;
    varying float vAlong;
    varying float vEdge;
    void main() {
      float a = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.6) * pow(clamp(vEdge, 0.001, 1.0), 1.8) * 0.4 * uPower * uHall;
      gl_FragColor = vec4(vec3(1.0, 0.78, 0.4) * a, 1.0);
    }`,
})

function Tower({ colour }: { colour: string }) {
  const rib = hdr(colour, 4.5)
  return (
    <group position-y={-16}>
      <mesh position-y={8}>
        <cylinderGeometry args={[1.6, 2.9, 16, 6]} />
        <meshStandardMaterial color="#1e1208" roughness={0.3} metalness={0.8} emissive={colour} emissiveIntensity={0.05} flatShading />
      </mesh>
      <mesh position-y={18.5}>
        <cylinderGeometry args={[1.05, 1.6, 5, 6]} />
        <meshStandardMaterial color="#2a180a" roughness={0.3} metalness={0.8} emissive={colour} emissiveIntensity={0.12} flatShading />
      </mesh>
      {/* glowing ribs up the tower */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6
        return (
          <mesh key={i} position={[Math.cos(a) * 2.2, 8, Math.sin(a) * 2.2]} rotation={[0, -a, Math.atan2(1.3, 16)]}>
            <boxGeometry args={[0.06, 16.1, 0.06]} />
            <meshBasicMaterial color={rib} toneMapped={false} />
          </mesh>
        )
      })}
      {[3, 7, 11, 15, 17, 20].map((y) => (
        <mesh key={y} position-y={y} rotation-x={Math.PI / 2}>
          <torusGeometry args={[y <= 16 ? 2.75 - y * 0.075 : 1.5 - (y - 16) * 0.09, 0.05, 6, 6]} />
          <meshBasicMaterial color={rib} toneMapped={false} />
        </mesh>
      ))}
      {/* lantern room */}
      <mesh position-y={22.2}>
        <cylinderGeometry args={[1.0, 1.0, 1.8, 6, 1, true]} />
        <meshPhysicalMaterial color="#fff2cf" transparent opacity={0.25} roughness={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position-y={23.6}>
        <coneGeometry args={[1.25, 1.4, 6]} />
        <meshStandardMaterial color="#2a1a0c" metalness={0.7} roughness={0.3} emissive={colour} emissiveIntensity={0.3} flatShading />
      </mesh>
    </group>
  )
}

function Beacon({ d }: { d: District }) {
  const head = useRef<Group>(null)
  const lamp = useRef<Mesh>(null)
  const beamGeo = useMemo(() => {
    const g = new ConeGeometry(9, 130, 32, 1, true)
    g.translate(0, -65, 0) // apex at the origin
    g.rotateZ(Math.PI / 2) // beam points along +X
    return g
  }, [])
  const angle = useRef(0)
  const anchor = useMemo(() => new Vector3(...d.anchor), [d])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const focus = useMind.getState().focus
    // concentration of forces: the beacon brightens and steadies when ideas are put away
    shared.uBeaconPower.value = MathUtils.damp(shared.uBeaconPower.value, focus ? 2.6 : 1, 2, dt)
    angle.current += dt * (focus ? 0.32 : 0.45)
    if (head.current) head.current.rotation.y = angle.current
    // world-space sweep direction for the shaders: +X rotated by angle about Y
    shared.uBeaconAngle.value = Math.atan2(-Math.sin(angle.current), Math.cos(angle.current))
    shared.uBeaconPos.value.set(anchor.x, anchor.y + BEACON_Y, anchor.z)
    if (lamp.current) lamp.current.scale.setScalar(0.8 + 0.25 * shared.uBeaconPower.value)
  })

  return (
    <group position-y={BEACON_Y}>
      <mesh ref={lamp}>
        <sphereGeometry args={[0.7, 24, 16]} />
        <meshBasicMaterial color={hdr(emotionColour('ambition'), 6)} toneMapped={false} />
      </mesh>
      <group ref={head}>
        <mesh geometry={beamGeo} material={beamMaterial} renderOrder={4} raycast={() => null} />
      </group>
    </group>
  )
}

/** Anton Group: ~49 ventures, as tiny satellites circling the crown. */
function Ventures({ colour }: { colour: string }) {
  const ref = useRef<InstancedMesh>(null)
  const N = 49
  const seeds = useMemo(() => Array.from({ length: N }, (_, i) => ({ r: 3.2 + (i % 5) * 0.35, a: (i / N) * Math.PI * 2, y: 9 + ((i * 7) % 11) * 0.12, s: 0.12 + (i % 3) * 0.05 })), [])
  const m4 = useMemo(() => new Matrix4(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const mesh = ref.current
    if (!mesh) return
    seeds.forEach((s, i) => {
      const a = s.a + t * (0.12 + (i % 4) * 0.02)
      m4.makeTranslation(Math.cos(a) * s.r, s.y + Math.sin(t + i) * 0.1, Math.sin(a) * s.r)
      mesh.setMatrixAt(i, m4)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(DynamicDrawUsage)
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <sphereGeometry args={[0.07, 8, 6]} />
      <meshBasicMaterial color={hdr(colour, 4)} toneMapped={false} />
    </instancedMesh>
  )
}

export function FounderHQ({ d }: { d: District }) {
  const colour = emotionColour(d.emotion)
  const near = useNear(d)
  const memories = useMemo(() => MEMORIES.filter((m) => m.district === d.id), [d])
  return (
    <group>
      <Tower colour={colour} />
      <Beacon d={d} />
      <Ventures colour={colour} />
      {near &&
        memories.map((m, i) => (
          <DistrictOrb
            key={m.id}
            memory={m}
            radius={m.isCore ? 0.7 : 0.5}
            place={ringPlace(m.isCore ? 4.2 : 5.6, m.isCore ? 2.5 : -1 + (i % 3) * 1.6, m.isCore ? 0.16 : 0.1, (i / memories.length) * Math.PI * 2)}
          />
        ))}
    </group>
  )
}
