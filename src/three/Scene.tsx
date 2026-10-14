import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { Color, FogExp2, type Group, MathUtils } from 'three'
import { rt } from '../lib/runtime'
import { useMind } from '../store'
import { CameraRig } from './CameraRig'
import { ControlDeck } from './ControlDeck'
import { Districts } from './Districts'
import { Effects } from './Effects'
import { Hall } from './Hall'
import { MemoryOrbs } from './MemoryOrbs'
import { MorseEyes } from './MorseEyes'
import { Performance } from './Performance'
import { MemoryParticles } from './MemoryParticles'
import { HALL_FOG_DENSITY, shared } from './shared'

const BLACK = new Color('#000000')
const HALL_FOG = new Color('#4a1f3c')
const NIGHT_FOG = new Color('#0b0b26')
const tmpFog = new Color()

export function Scene() {
  const scene = useThree((s) => s.scene)
  const started = useRef<number | null>(null)
  const world = useRef<Group>(null)

  const get = useThree((s) => s.get)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    // dev hook: render frames on demand (the preview pane throttles rAF when hidden)
    ;(window as unknown as Record<string, unknown>).__mind = {
      rt,
      get,
      store: useMind,
      async shot(name: string, w = 1024) {
        const c = get().gl.domElement
        const k = Math.min(1, w / c.width)
        const off = document.createElement('canvas')
        off.width = c.width * k
        off.height = c.height * k
        off.getContext('2d')!.drawImage(c, 0, 0, off.width, off.height)
        await fetch('/__shot?name=' + name, { method: 'POST', body: off.toDataURL('image/png') })
      },
      run(seconds: number, fps = 30) {
        const s = get()
        const start = performance.now()
        let t = start
        while (t - start < seconds * 1000) {
          const next = t + 1000 / fps
          while (performance.now() < next) {
            /* spin */
          }
          t = performance.now()
          gsap.ticker.tick()
          s.advance(t)
          rt.domTicks.forEach((f) => f())
        }
      },
    }
  }, [get])

  useEffect(() => {
    scene.background = BLACK.clone()
    scene.fog = new FogExp2('#000000', 0.3)
  }, [scene])

  useFrame((state) => {
    // loading: the sphere assembles itself from nothing
    if (started.current === null) started.current = state.clock.elapsedTime
    if (rt.assemble < 1) {
      const dur = rt.reducedMotion ? 0.4 : 2.6
      const x = Math.min((state.clock.elapsedTime - started.current) / dur, 1)
      rt.assemble = x
      if (x >= 1) useMind.getState().setPhase('ready')
    }

    // fog hides the hall at level 0 and reveals it as we break the surface
    const h = rt.scroll.hall
    shared.uTime.value = state.clock.elapsedTime
    shared.uHall.value = h
    if (world.current) world.current.visible = h > 0.002
    const fog = scene.fog as FogExp2 | null
    if (fog) {
      fog.density = Math.exp(Math.log(0.3) * (1 - h) + Math.log(HALL_FOG_DENSITY) * h)
      shared.uNight.value = MathUtils.damp(shared.uNight.value, useMind.getState().night ? 1 : 0, 0.8, 1 / 60)
      fog.color.copy(BLACK).lerp(tmpFog.copy(HALL_FOG).lerp(NIGHT_FOG, shared.uNight.value), h)
    }
  })

  return (
    <>
      <CameraRig />
      <Performance />
      <group ref={world} visible={false}>
        <Hall />
        <ControlDeck />
        <Districts />
        <MemoryOrbs />
      </group>
      <MemoryParticles />
      <MorseEyes />
      <Effects />
    </>
  )
}
