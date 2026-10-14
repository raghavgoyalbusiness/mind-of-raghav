import { CanvasTexture, Color, ShaderMaterial, SRGBColorSpace, type Texture } from 'three'
import type { MemoryStatus } from '../data/mind'
import { shared } from './shared'

export const STATUS_CODE: Record<MemoryStatus, number> = { shipped: 0, building: 1, idea: 2 }

export function memoryInitials(title: string) {
  return title
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(the|of|and|a)$/i.test(w))
    .slice(0, 2)
    .map((w) => (/^\d+$/.test(w) ? w : w[0]))
    .join('')
    .toUpperCase()
}

/** The faint "memory image": initials inside broken rings. Drawn into any 2D context. */
export function drawMemoryGlyph(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, title: string, colour: string) {
  const k = size / 256
  g.save()
  g.strokeStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < 3; i++) {
    g.lineWidth = (2 - i * 0.5) * k
    g.beginPath()
    g.arc(cx, cy, (70 + i * 22) * k, 0.3 + i, Math.PI * 1.4 + i)
    g.stroke()
  }
  g.fillStyle = '#ffffff'
  g.shadowColor = colour
  g.shadowBlur = 18 * k
  const text = memoryInitials(title)
  g.font = `600 ${(text.length > 2 ? 68 : 84) * k}px "Space Grotesk", sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, cx, cy + 6 * k)
  g.restore()
}

export function memoryTexture(title: string, colour: string): Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  drawMemoryGlyph(c.getContext('2d')!, 128, 128, 256, title, colour)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** All memory glyphs in one texture, so instanced orbs can each show their own. */
export function memoryAtlas(items: { title: string; colour: string }[], cell = 128) {
  const grid = Math.ceil(Math.sqrt(items.length))
  const c = document.createElement('canvas')
  c.width = c.height = grid * cell
  const g = c.getContext('2d')!
  items.forEach((it, i) => {
    drawMemoryGlyph(g, (i % grid) * cell + cell / 2, Math.floor(i / grid) * cell + cell / 2, cell, it.title, it.colour)
  })
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return { texture: tex, grid }
}

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uHall;
  uniform vec3 uColor;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uDim;
  uniform float uPearl;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vObj;
  varying vec2 vCell;
  varying float vStatus;
  varying float vHover;
  varying float vSeed;
  uniform float uGrid;
  uniform vec3 uBeaconPos;
  uniform float uBeaconAngle;
  uniform float uBeaconPower;
  varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vN);
    float ndv = max(dot(n, normalize(vV)), 0.0);
    float fres = pow(1.0 - ndv, 2.4);
    float t = uTime * 0.6 + vSeed;
    vec3 p = normalize(vObj) * 2.4;
    float sw = sin(p.x * 3.1 + t) + sin(p.y * 4.3 - t * 1.3 + p.z * 2.0) + sin((p.x + p.z) * 5.0 + t * 0.7 + sin(p.y * 2.0 + t));
    vec3 col = uColor;
    if (uPearl > 0.5) {
      vec3 iri = 0.62 + 0.38 * cos(6.2831 * (fres * 1.3 + sw * 0.08 + t * 0.05 + vec3(0.0, 0.33, 0.67)));
      col = mix(col, iri, 0.55);
    }
    float pulse = vStatus > 0.5 && vStatus < 1.5 ? 0.7 + 0.3 * sin(uTime * 2.6 + vSeed) : 1.0;
    vec3 inner = col * (0.32 + 0.14 * sw);
    if (uHasMap > 0.5) {
      vec2 muv = n.xy * 0.95 + 0.5 + vec2(sin(t * 0.4), cos(t * 0.3)) * 0.02;
      muv = clamp(muv, 0.02, 0.98);
      vec2 auv = (vCell + vec2(muv.x, 1.0 - muv.y)) / uGrid;
      auv.y = 1.0 - auv.y;
      float img = texture2D(uMap, auv).r * smoothstep(0.15, 0.6, ndv);
      inner += mix(col, vec3(1.0), 0.35) * img * (0.32 + vHover * 0.5);
    }
    vec3 rim = col * fres * 2.6 + vec3(1.0) * pow(fres, 6.0) * 1.2;
    vec3 h = normalize(vec3(-0.4, 0.6, 1.0));
    float spec = pow(max(dot(n, h), 0.0), 60.0) * 1.2;
    vec3 outc = (inner + rim) * pulse * (1.0 + vHover * 0.9) + spec;
    float a = 1.0;
    if (vStatus > 1.5) { outc = col * fres * 2.2 * (1.0 + vHover) + spec + inner * 0.3; a = 0.22 + fres * 0.78; }
    vec2 bd = vWorld.xz - uBeaconPos.xz;
    float bdiff = abs(mod(atan(bd.y, bd.x) - uBeaconAngle + 3.14159, 6.28318) - 3.14159);
    outc *= 1.0 + smoothstep(0.16, 0.0, bdiff) * uBeaconPower * 1.6;
    // filtered-out orbs fade to faint glass ghosts rather than black balls
    gl_FragColor = vec4(outc * uDim * uHall, a * (0.2 + 0.8 * uDim));
  }`

function baseUniforms(colour: string, map: Texture | null, grid: number) {
  return {
    uTime: shared.uTime,
    uHall: shared.uHall,
    uColor: { value: new Color(colour) },
    uMap: { value: map },
    uHasMap: { value: map ? 1 : 0 },
    uGrid: { value: grid },
    uDim: { value: 1 },
    uPearl: { value: colour.toLowerCase() === '#f1ebff' ? 1 : 0 },
    uBeaconPos: shared.uBeaconPos,
    uBeaconAngle: shared.uBeaconAngle,
    uBeaconPower: shared.uBeaconPower,
  }
}

/** Single orb (core memories). */
export function makeOrbMaterial(colour: string, status: MemoryStatus = 'shipped', map: Texture | null = null) {
  return new ShaderMaterial({
    transparent: true,
    uniforms: {
      ...baseUniforms(colour, map, 1),
      uStatus: { value: STATUS_CODE[status] },
      uHover: { value: 0 },
      uSeed: { value: Math.random() * 10 },
    },
    vertexShader: /* glsl */ `
      uniform float uStatus;
      uniform float uHover;
      uniform float uSeed;
      varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec2 vCell;
      varying float vStatus; varying float vHover; varying float vSeed;
      varying vec3 vWorld;
      void main() {
        vObj = position;
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vCell = vec2(0.0); vStatus = uStatus; vHover = uHover; vSeed = uSeed;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: fragment,
  })
}

/** Instanced orbs (one material per emotion). Per instance: aCell, aStatus, aHover, aSeed. */
export function makeInstancedOrbMaterial(colour: string, atlas: Texture, grid: number) {
  return new ShaderMaterial({
    transparent: true,
    uniforms: baseUniforms(colour, atlas, grid),
    vertexShader: /* glsl */ `
      attribute vec2 aCell;
      attribute float aStatus;
      attribute float aHover;
      attribute float aSeed;
      varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec2 vCell;
      varying float vStatus; varying float vHover; varying float vSeed;
      varying vec3 vWorld;
      void main() {
        vObj = position;
        vWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vV = normalize(-mv.xyz);
        vCell = aCell; vStatus = aStatus; vHover = aHover; vSeed = aSeed;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: fragment,
  })
}

