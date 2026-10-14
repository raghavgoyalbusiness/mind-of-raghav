import { Color, ShaderMaterial, UniformsLib, UniformsUtils } from 'three'
import { shared } from './shared'

/** A tube that carries travelling pulses of light from uv.x = 0 → 1. */
export function makeNeuralMaterial(from: string, to: string, length: number, speed = 9) {
  const u = UniformsUtils.merge([
    UniformsLib.fog,
    {
      uA: { value: new Color(from) },
      uB: { value: new Color(to) },
      uLen: { value: length },
      uSpeed: { value: speed },
      uSeed: { value: Math.random() * 10 },
      uBoost: { value: 0 },
    },
  ])
  u.uTime = shared.uTime
  u.uHall = shared.uHall
  return new ShaderMaterial({
    fog: true,
    uniforms: u,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform vec3 uA;
      uniform vec3 uB;
      uniform float uLen;
      uniform float uSpeed;
      uniform float uSeed;
      uniform float uTime;
      uniform float uHall;
      uniform float uBoost;
      varying vec2 vUv;
      void main() {
        vec3 c = mix(uA, uB, vUv.x);
        float d = vUv.x * uLen - uTime * uSpeed + uSeed * 7.0;
        float p = fract(d / 14.0);
        float pulse = exp(-pow((p - 0.5) * 18.0, 2.0)) + 0.35 * exp(-pow((fract(d / 5.0) - 0.5) * 30.0, 2.0));
        float side = 0.55 + 0.45 * sin(vUv.y * 6.2831 * 2.0);
        vec3 col = c * (0.22 + side * 0.12) + c * pulse * (2.6 + uBoost * 3.0);
        gl_FragColor = vec4(col * uHall, 1.0);
        #include <fog_fragment>
      }`,
  })
}
