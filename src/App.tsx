import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { MAX_DPR } from './lib/config'
import { initPointer } from './lib/interaction'
import { initScroll } from './lib/scroll'
import { Scene } from './three/Scene'
import { HallNav } from './ui/HallNav'
import { HoverCard } from './ui/HoverCard'
import { MemoryProjection } from './ui/MemoryProjection'
import { Overlay } from './ui/Overlay'
import { WorldLabels } from './ui/WorldLabels'
import { Legend } from './ui/Legend'
import { Minimap } from './ui/Minimap'
import { Search } from './ui/Search'
import { SoundToggle } from './ui/SoundToggle'
import { Toast } from './ui/Toast'
import { DistrictSheet } from './ui/DistrictSheet'
import { MorseCaption } from './ui/MorseCaption'
import { initEggs } from './lib/eggs'
import { rt } from './lib/runtime'
import { useMind } from './store'

export default function App() {
  const [fonts, setFonts] = useState(false)
  useEffect(() => {
    // canvas-drawn text (memory glyphs, signs, the counter) needs the real faces loaded
    const done = () => setFonts(true)
    const t = setTimeout(done, 2500)
    Promise.all([document.fonts.load('600 84px "Space Grotesk"'), document.fonts.load('400 16px Inter')]).then(done, done)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    const a = initScroll()
    const b = initPointer()
    const c = initEggs()
    // one animation loop for every DOM overlay that tracks the scene
    let raf = 0
    const loop = () => {
      rt.domTicks.forEach((f) => f())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      c()
      a()
      b()
    }
  }, [])

  return (
    <>
      <div className="fixed inset-0" style={{ touchAction: 'pan-y' }}>
        <Canvas
          flat
          dpr={[1, MAX_DPR]}
          gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: import.meta.env.DEV }}
          camera={{ fov: 40, near: 0.05, far: 900, position: [0, -0.8, 17] }}
          style={{ touchAction: 'pan-y' }}
          onPointerMissed={() => useMind.getState().setHovered(null)}
        >
          {fonts && <Scene />}
        </Canvas>
      </div>
      <Overlay />
      <WorldLabels />
      <HallNav />
      <Search />
      <Legend />
      <Minimap />
      <SoundToggle />
      <Toast />
      <DistrictSheet />
      <MorseCaption />
      <HoverCard />
      <MemoryProjection />
      <div id="veil" className="pointer-events-none fixed inset-0 z-50 bg-black opacity-0" />
      {/* scroll track: its height is the length of the journey */}
      <div id="scroll-track" className="pointer-events-none relative h-[700vh] w-full" aria-hidden />
    </>
  )
}
