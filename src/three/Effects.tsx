import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ChromaticAberrationEffect, DepthOfFieldEffect, ToneMappingMode } from 'postprocessing'
import { useRef } from 'react'
import { HalfFloatType, Vector2 } from 'three'
import { IS_MOBILE } from '../lib/config'
import { rt } from '../lib/runtime'

export function Effects() {
  const ca = useRef<ChromaticAberrationEffect>(null)
  const dof = useRef<DepthOfFieldEffect>(null)
  const offset = useRef(new Vector2(0.0004, 0.0004))

  useFrame(() => {
    // depth of field only once we are inside the hall
    if (dof.current) {
      dof.current.bokehScale = rt.lowQuality ? 0 : rt.scroll.hall * 2.4
      // overview: wide focus band; browsing a shelf: focus on what is in front of you
      const k = rt.nav.k
      const near = rt.camera ? rt.camera.position.distanceTo(rt.camTarget) : 16
      dof.current.cocMaterial.focusDistance = 17 * (1 - k) + near * k
      dof.current.cocMaterial.focusRange = 46 * (1 - k) + 16 * k
    }
    if (!ca.current) return
    const a = 0.0004 + rt.scroll.aberration * 0.006
    offset.current.set(a, a * 0.7)
    ca.current.offset = offset.current
  })

  return (
    <EffectComposer multisampling={IS_MOBILE ? 0 : 4} frameBufferType={HalfFloatType}>
      {IS_MOBILE ? <></> : <DepthOfField ref={dof} focusDistance={17} focusRange={46} bokehScale={0} />}
      <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.16} luminanceSmoothing={0.3} radius={0.78} />
      <ChromaticAberration
        ref={ca}
        offset={offset.current}
        radialModulation
        modulationOffset={0.25}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette offset={0.28} darkness={0.72} />
      <Noise opacity={0.045} blendFunction={BlendFunction.SOFT_LIGHT} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
