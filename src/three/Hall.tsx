import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  Color,
  CylinderGeometry,
  DoubleSide,
  type DirectionalLight,
  type HemisphereLight,
  type InstancedMesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three'
import { canyonX, FLOOR_Y } from '../lib/hallLayout'
import { rt } from '../lib/runtime'
import { buildHallGeometry, buildPillarTransforms } from './hallGeometry'
import { shared } from './shared'

function Shelves() {
  const { boards, lips, walls } = useMemo(buildHallGeometry, [])
  return (
    <group>
      <mesh geometry={walls}>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0} side={DoubleSide} />
      </mesh>
      <mesh geometry={boards}>
        <meshStandardMaterial vertexColors roughness={0.5} metalness={0.05} side={DoubleSide} />
      </mesh>
      <mesh geometry={lips}>
        <meshBasicMaterial vertexColors side={DoubleSide} />
      </mesh>
    </group>
  )
}

function Pillars() {
  const ref = useRef<InstancedMesh>(null)
  const items = useMemo(buildPillarTransforms, [])
  const geo = useMemo(() => new CylinderGeometry(0.22, 0.26, 1, 12, 1), [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.matrix)
      mesh.setColorAt(i, it.colour)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [items])
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]}>
      <meshStandardMaterial roughness={0.4} emissive="#3a1838" emissiveIntensity={0.6} />
    </instancedMesh>
  )
}

/** The hall's sky gradient, shared so far walls can wear the sky and vanish into it. */
export const SKY_GLSL = /* glsl */ `
  uniform float uNight;
  float skyHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  vec3 skyColour(vec3 d) {
    vec3 deep = vec3(0.02, 0.008, 0.035);
    vec3 horizon = vec3(0.16, 0.055, 0.12);
    vec3 zenith = vec3(0.13, 0.06, 0.12);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(horizon, zenith, smoothstep(0.0, 0.85, h)) : mix(horizon, deep, smoothstep(0.0, -0.35, h));
    float far = pow(max(dot(d, normalize(vec3(-0.05, 0.12, -1.0))), 0.0), 10.0);
    col += vec3(1.0, 0.55, 0.3) * far * 0.32;
    col += vec3(1.0, 0.72, 0.45) * pow(max(h, 0.0), 4.0) * 0.12;
    // 3 AM: the hall goes indigo and the stars come out
    if (uNight > 0.001) {
      vec3 night = h > 0.0 ? mix(vec3(0.03, 0.03, 0.1), vec3(0.008, 0.01, 0.04), smoothstep(0.0, 0.8, h)) : vec3(0.006, 0.006, 0.02);
      night += vec3(0.25, 0.3, 0.9) * far * 0.12;
      vec3 cell = floor(d * 320.0);
      float star = step(0.9975, skyHash(cell)) * smoothstep(-0.05, 0.25, h);
      night += vec3(0.9, 0.92, 1.0) * star * (0.6 + 0.4 * sin(skyHash(cell + 1.0) * 60.0));
      col = mix(col, night, uNight);
    }
    return col;
  }
`

const skyMaterial = new ShaderMaterial({
  side: BackSide,
  depthWrite: false,
  fog: false,
  uniforms: { uHall: shared.uHall, uTime: shared.uTime, uNight: shared.uNight },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uHall;
    uniform float uTime;
    varying vec3 vDir;
    ${SKY_GLSL}
    void main() {
      vec3 col = skyColour(normalize(vDir));
      gl_FragColor = vec4(col * uHall, 1.0);
    }`,
})

function Sky() {
  return (
    <mesh material={skyMaterial} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[600, 48, 24]} />
    </mesh>
  )
}

const floorMaterial = new ShaderMaterial({
  fog: true,
  uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }]),
  vertexShader: /* glsl */ `
    #include <fog_pars_vertex>
    varying vec3 vW;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      vec4 mvPosition = viewMatrix * w;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    #include <fog_pars_fragment>
    uniform float uTime;
    varying vec3 vW;
    float vein(float v, float w) { return smoothstep(w, 0.0, abs(fract(v) - 0.5) * 2.0 - (1.0 - w)) ; }
    void main() {
      vec2 p = vW.xz;
      vec3 col = vec3(0.07, 0.025, 0.08);
      float a = sin(p.x * 0.21 + sin(p.y * 0.035) * 3.0);
      float b = sin(p.y * 0.09 + sin(p.x * 0.06) * 2.0 - uTime * 0.25);
      float lines = smoothstep(0.992, 1.0, abs(a)) * 0.6 + smoothstep(0.996, 1.0, abs(b)) * 0.8;
      col += vec3(1.0, 0.45, 0.6) * lines * 0.1;
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }`,
})

function Floor() {
  useFrame(() => {
    floorMaterial.uniforms.uTime.value = shared.uTime.value
  })
  return (
    <mesh material={floorMaterial} rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, -4]}>
      <planeGeometry args={[700, 508, 1, 1]} />
    </mesh>
  )
}

const rayMaterial = new ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  side: DoubleSide,
  uniforms: { uHall: shared.uHall, uTime: shared.uTime, uNight: shared.uNight },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying float vEdge;
    varying float vDist;
    void main() {
      vUv = uv;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vec3 n = normalize(mat3(modelMatrix) * normal);
      vec3 v = normalize(cameraPosition - w.xyz);
      vEdge = abs(dot(n, v));
      vec4 mv = viewMatrix * w;
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uHall;
    uniform float uTime;
    uniform float uNight;
    varying vec2 vUv;
    varying float vEdge;
    varying float vDist;
    void main() {
      float along = pow(clamp(vUv.y, 0.001, 1.0), 1.6);  // bright at the top
      float soft = pow(clamp(vEdge, 0.001, 1.0), 2.5);   // soft volumetric edges
      float streaks = 0.65 + 0.35 * sin(vUv.x * 60.0 + uTime * 0.15) * sin(vUv.x * 23.0 - uTime * 0.1);
      float near = smoothstep(4.0, 30.0, vDist);
      float a = clamp(along * soft * streaks * near * 0.07 * uHall * (1.0 - uNight * 0.8), 0.0, 1.0);
      if (a != a) a = 0.0;
      gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a, 1.0);
    }`,
})

const RAYS: [number, number, number, number][] = [
  // z, xOffset, tilt, width
  [-12, -4, 0.18, 1.0],
  [-34, 6, -0.12, 1.3],
  [-58, -8, 0.22, 1.1],
  [-86, 3, -0.2, 1.5],
  [-118, -6, 0.15, 1.4],
  [-150, 7, -0.16, 1.6],
  [-190, -3, 0.12, 1.8],
]

function GodRays() {
  const geo = useMemo(() => new CylinderGeometry(2.2, 9, 80, 32, 1, true), [])
  return (
    <group>
      {RAYS.map(([z, dx, tilt, w], i) => (
        <mesh key={i} geometry={geo} material={rayMaterial} position={[canyonX(z) + dx, 26, z]} rotation={[0.08, 0, tilt]} scale={[w, 1, w]} renderOrder={3} />
      ))}
    </group>
  )
}

const DAY_SKY = new Color('#ffd6b0')
const NIGHT_SKY = new Color('#7d8cff')

function Lights() {
  const hemi = useRef<HemisphereLight>(null)
  const sun = useRef<DirectionalLight>(null)
  useFrame(() => {
    const h = rt.scroll.hall
    const n = shared.uNight.value
    if (hemi.current) {
      hemi.current.intensity = (1.6 - n * 0.9) * h
      hemi.current.color.copy(DAY_SKY).lerp(NIGHT_SKY, n)
    }
    if (sun.current) sun.current.intensity = 2.2 * h * (1 - n * 0.85)
  })
  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffd6b0', '#5a2466', 0]} />
      <directionalLight ref={sun} position={[-20, 80, -30]} color="#ffcf99" intensity={0} />
    </>
  )
}

export function Hall() {
  return (
    <group>
      <Sky />
      <Lights />
      <Shelves />
      <Pillars />
      <Floor />
      <GodRays />
    </group>
  )
}
