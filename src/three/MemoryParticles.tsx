import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MathUtils,
  PlaneGeometry,
  Raycaster,
  ShaderMaterial,
  Sphere,
  Vector2,
  Vector3,
} from 'three'
import { BASE_FLOW_SPEED, PARTICLE_COUNT, SPHERE_RADIUS } from '../lib/config'
import { buildParticleData } from '../lib/hallLayout'
import { isReservedSlot } from '../lib/memoryLayout'
import { rt } from '../lib/runtime'
import { useMind } from '../store'
import { shared } from './shared'
import { particleFragment, particleVertex } from './shaders/particles'

const ray = new Raycaster()
const hitSphere = new Sphere(new Vector3(), SPHERE_RADIUS * 1.04)
const hit = new Vector3()

export function MemoryParticles() {
  const camera = useThree((s) => s.camera)
  const filter = useRef({ value: -1, mix: 0 })

  useEffect(() => {
    const ndc = new Vector2()
    rt.hitSphere = (x, y) => {
      if (rt.scroll.morph > 0.25) return false
      ray.setFromCamera(ndc.set(x, y), camera)
      return ray.ray.intersectsSphere(hitSphere)
    }
  }, [camera])

  const geometry = useMemo(() => {
    const data = buildParticleData(PARTICLE_COUNT, isReservedSlot)
    const quad = new PlaneGeometry(1, 1)
    const g = new InstancedBufferGeometry()
    g.index = quad.index
    g.setAttribute('position', quad.getAttribute('position'))
    g.setAttribute('aSph', new InstancedBufferAttribute(data.sph, 3))
    g.setAttribute('aShelf', new InstancedBufferAttribute(data.shelf, 4))
    g.setAttribute('aColA', new InstancedBufferAttribute(data.colA, 3))
    g.setAttribute('aColB', new InstancedBufferAttribute(data.colB, 3))
    g.setAttribute('aRnd', new InstancedBufferAttribute(data.rnd, 4))
    g.instanceCount = data.count
    return g
  }, [])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uFlow: { value: 0 },
          uFlowSpeed: { value: BASE_FLOW_SPEED },
          uStreak: { value: 1 },
          uMorph: { value: 0 },
          uAssemble: { value: 0 },
          uRadius: { value: SPHERE_RADIUS },
          uHold: { value: 0 },
          uPointer: { value: new Vector3(0, 0, 100) },
          uPointerAmt: { value: 0 },
          uFilter: { value: -1 },
          uFilterMix: { value: 0 },
          uDensity: { value: Math.pow(60000 / PARTICLE_COUNT, 0.35) },
          uBeaconPos: shared.uBeaconPos,
          uBeaconAngle: shared.uBeaconAngle,
          uBeaconPower: shared.uBeaconPower,
        },
      }),
    [],
  )

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20)
    const u = material.uniforms
    const s = rt.scroll

    // spin: eased towards the target direction; scrolling in slows it down
    const target = rt.spinDir * BASE_FLOW_SPEED * (1 - s.slow)
    rt.flowSpeed = MathUtils.damp(rt.flowSpeed, target, rt.holding ? 2.4 : 1.4, dt)
    u.uFlow.value += rt.flowSpeed * dt
    u.uFlowSpeed.value = rt.flowSpeed
    u.uTime.value = state.clock.elapsedTime
    u.uStreak.value = s.streak
    u.uMorph.value = s.morph
    u.uAssemble.value = rt.assemble
    u.uHold.value = MathUtils.damp(u.uHold.value, rt.holding ? 1 : 0, 6, dt)

    // pointer → sphere surface, for the curl warp + hold hit-testing
    let over = false
    if (s.morph < 0.25 && rt.pointerActive) {
      ray.setFromCamera(rt.pointer, camera)
      if (ray.ray.intersectSphere(hitSphere, hit)) {
        over = true
        u.uPointer.value.lerp(hit, 1 - Math.exp(-dt * 10))
      }
    }
    rt.overSphere = over
    u.uPointerAmt.value = MathUtils.damp(u.uPointerAmt.value, over ? 1 : 0, 3, dt)

    // emotion filter (driven by the legend)
    const f = useMind.getState().filter
    const fi = f === null ? -1 : f
    if (fi !== filter.current.value && fi !== -1) filter.current.value = fi
    filter.current.mix = MathUtils.damp(filter.current.mix, fi === -1 ? 0 : 1, 5, dt)
    if (filter.current.mix < 0.002 && fi === -1) filter.current.value = -1
    u.uFilter.value = filter.current.value
    u.uFilterMix.value = filter.current.mix
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={2} />
}
