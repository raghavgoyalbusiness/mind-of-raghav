import { Color } from 'three'
import { EMOTIONS } from './emotions'
import { hash4, mulberry32, shuffle } from './random'

/**
 * The Memory Hall is a canyon of curved shelf walls that rise away from the
 * valley floor in stadium-like layers and stretch towards the horizon (-Z).
 */
export type Layer = {
  w: number // half-width of the canyon at this layer
  y0: number // first tier height
  tiers: number
  h: number // tier spacing
  z0: number
  z1: number
  spacing: number // orb spacing along a shelf
  top: string
  lip: string
  wall: string
  pillar: string
}

export const LAYERS: Layer[] = [
  { w: 18, y0: -9, tiers: 9, h: 2.0, z0: 40, z1: -240, spacing: 0.72, top: '#f7b6d2', lip: '#ffcf9e', wall: '#a8517f', pillar: '#a8ecdc' },
  { w: 31, y0: 2, tiers: 12, h: 2.0, z0: 40, z1: -250, spacing: 0.86, top: '#cdb8ff', lip: '#ffaed6', wall: '#7f4a9e', pillar: '#ffc9a8' },
  { w: 45, y0: 11, tiers: 14, h: 2.1, z0: 40, z1: -260, spacing: 1.0, top: '#ffc9a8', lip: '#b3eeff', wall: '#9c5a7a', pillar: '#f7b2d9' },
  { w: 60, y0: 21, tiers: 16, h: 2.2, z0: 40, z1: -270, spacing: 1.2, top: '#a8e8d8', lip: '#ffdc9c', wall: '#5e4a8c', pillar: '#d6c4ff' },
]

export const SHELF_DROP = 0.3
export const FLOOR_Y = -11

export const canyonX = (z: number) => 12 * Math.sin(Math.min(0, z + 20) * 0.011)

export const shelfX = (layer: number, side: number, z: number) =>
  canyonX(z) + side * (LAYERS[layer].w + 2.2 * Math.sin(z * 0.045 + side * 1.3 + layer * 0.7))

export type ParticleData = {
  count: number
  sph: Float32Array // unit sphere position
  shelf: Float32Array // xyz target, w emotion index (-1 = dust)
  colA: Float32Array // colour on the outer sphere
  colB: Float32Array // colour in the hall
  rnd: Float32Array // speed, size, phase, delay
}

const SPHERE_PALETTE: [string, number][] = [
  ['#ff4fb8', 0.26],
  ['#14d9c4', 0.25],
  ['#ffb52e', 0.19],
  ['#9a7bff', 0.22],
  ['#ffffff', 0.08],
]

const DUST_PALETTE = ['#ffd9a8', '#ffb8dc', '#fff1d6']

function pickWeighted(r: number) {
  let acc = 0
  for (const [c, w] of SPHERE_PALETTE) {
    acc += w
    if (r <= acc) return c
  }
  return SPHERE_PALETTE[SPHERE_PALETTE.length - 1][0]
}

type Slot = { x: number; y: number; z: number; emo: number; az: number }

export type ReservedFn = (layer: number, side: number, tier: number, z: number) => boolean

function buildSlots(rnd: () => number, reserved: ReservedFn): Slot[][] {
  return LAYERS.map((L, li) => {
    const out: Slot[] = []
    for (const side of [-1, 1]) {
      for (let t = 0; t < L.tiers; t++) {
        const y = L.y0 + t * L.h
        for (let z = L.z0; z > L.z1; z -= L.spacing) {
          if (rnd() < 0.08) continue // organic gaps
          const zz = z + (rnd() - 0.5) * L.spacing * 0.3
          if (reserved(li, side, t, zz)) continue
          const x = shelfX(li, side, zz) + side * (rnd() - 0.5) * 0.12
          const chunk = Math.floor((L.z0 - zz) / 9)
          let emo = Math.floor(hash4(li, side + 3, t >> 2, chunk) * EMOTIONS.length)
          if (rnd() < 0.22) emo = Math.floor(rnd() * EMOTIONS.length)
          out.push({ x, y, z: zz, emo, az: Math.atan2(y - 6, x - canyonX(zz)) })
        }
      }
    }
    return out
  })
}

export function buildParticleData(count: number, reserved: ReservedFn = () => false): ParticleData {
  const rnd = mulberry32(1909)
  const sph = new Float32Array(count * 3)
  const shelf = new Float32Array(count * 4)
  const colA = new Float32Array(count * 3)
  const colB = new Float32Array(count * 3)
  const rndA = new Float32Array(count * 4)
  const c = new Color()

  // 1. Fibonacci sphere, jittered
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) / count) * 2
    const r = Math.sqrt(1 - y * y)
    const th = i * golden + (rnd() - 0.5) * 0.02
    sph[i * 3] = Math.cos(th) * r
    sph[i * 3 + 1] = y
    sph[i * 3 + 2] = Math.sin(th) * r
    c.set(pickWeighted(rnd()))
    colA.set([c.r, c.g, c.b], i * 3)
    const sz = sph[i * 3 + 2]
    rndA[i * 4] = rnd()
    rndA[i * 4 + 1] = rnd()
    rndA[i * 4 + 2] = rnd()
    // front of the sphere (towards the camera on +Z) leaves first
    rndA[i * 4 + 3] = ((1 - sz) / 2) * 0.78 + rnd() * 0.22
  }

  // 2. Shelf slots, nearest layers get priority on low particle budgets
  const layers = buildSlots(rnd, reserved)
  const orbBudget = Math.round(count * 0.64)
  const slots: Slot[] = []
  for (const layer of layers) {
    const remaining = orbBudget - slots.length
    if (remaining <= 0) break
    if (layer.length <= remaining) slots.push(...layer)
    else slots.push(...shuffle(layer.slice(), rnd).slice(0, remaining))
  }

  // 3. Coherent pairing: sphere azimuth (around view axis) -> slot azimuth
  //    (around canyon axis); within a band, front particles -> near slots.
  const order = shuffle(Array.from({ length: count }, (_, i) => i), rnd)
  const orbIdx = order.slice(0, slots.length)
  const dustIdx = order.slice(slots.length)

  const sAz = (i: number) => Math.atan2(sph[i * 3 + 1], sph[i * 3])
  orbIdx.sort((a, b) => sAz(a) - sAz(b))
  slots.sort((a, b) => a.az - b.az)

  const BANDS = 72
  const per = Math.ceil(slots.length / BANDS)
  for (let b = 0; b < BANDS; b++) {
    const pi = orbIdx.slice(b * per, (b + 1) * per).sort((a, c2) => sph[c2 * 3 + 2] - sph[a * 3 + 2])
    const si = slots.slice(b * per, (b + 1) * per).sort((a, c2) => c2.z - a.z)
    for (let k = 0; k < pi.length; k++) {
      const i = pi[k]
      const s = si[k]
      shelf.set([s.x, s.y, s.z, s.emo], i * 4)
      c.set(EMOTIONS[s.emo].colour)
      colB.set([c.r, c.g, c.b], i * 3)
    }
  }

  // 4. The rest become dust motes drifting in the canyon air
  for (const i of dustIdx) {
    const z = 30 - rnd() * 230
    const x = canyonX(z) + (rnd() * 2 - 1) * (6 + rnd() * 34)
    const y = -10 + rnd() * 42
    shelf.set([x, y, z, -1], i * 4)
    c.set(DUST_PALETTE[Math.floor(rnd() * DUST_PALETTE.length)])
    colB.set([c.r, c.g, c.b], i * 3)
  }

  return { count, sph, shelf, colA, colB, rnd: rndA }
}
