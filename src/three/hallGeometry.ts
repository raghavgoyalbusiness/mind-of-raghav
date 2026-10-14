import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three'
import { LAYERS, SHELF_DROP, shelfX } from '../lib/hallLayout'

type Builder = { pos: number[]; nor: number[]; col: number[]; idx: number[] }
const mk = (): Builder => ({ pos: [], nor: [], col: [], idx: [] })

function toGeometry(b: Builder) {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(b.pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(b.nor, 3))
  g.setAttribute('color', new Float32BufferAttribute(b.col, 3))
  g.setIndex(b.idx)
  g.computeBoundingSphere()
  return g
}

/**
 * Extrude a strip along -Z. `edge(z)` returns the two edge points for a slice.
 */
function strip(
  b: Builder,
  z0: number,
  z1: number,
  step: number,
  edge: (z: number) => [Vector3, Vector3],
  normal: Vector3,
  colA: Color,
  colB: Color = colA,
) {
  const start = b.pos.length / 3
  let n = 0
  for (let z = z0; z >= z1 - 1e-6; z -= step) {
    const [a, c] = edge(z)
    b.pos.push(a.x, a.y, a.z, c.x, c.y, c.z)
    b.nor.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z)
    b.col.push(colA.r, colA.g, colA.b, colB.r, colB.g, colB.b)
    n++
  }
  for (let i = 0; i < n - 1; i++) {
    const a = start + i * 2
    b.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

export function buildHallGeometry() {
  const boards = mk()
  const lips = mk()
  const walls = mk()
  const step = 1.6
  const up = v(0, 1, 0)

  LAYERS.forEach((L, li) => {
    const top = new Color(L.top)
    const lip = new Color(L.lip).multiplyScalar(1.5)
    const wall = new Color(L.wall)
    const wallTop = new Color(L.wall).lerp(new Color(L.top), 0.35)
    const yBottom = L.y0 - 1.4
    const yTop = L.y0 + (L.tiers - 1) * L.h + 1.2

    for (const side of [-1, 1]) {
      const toValley = v(-side, 0, 0)
      for (let t = 0; t < L.tiers; t++) {
        const y = L.y0 + t * L.h - SHELF_DROP
        const inner = (z: number) => shelfX(li, side, z) - side * 0.42
        const outer = (z: number) => shelfX(li, side, z) + side * 0.62
        // board top
        strip(boards, L.z0, L.z1, step, (z) => (side < 0 ? [v(outer(z), y, z), v(inner(z), y, z)] : [v(inner(z), y, z), v(outer(z), y, z)]), up, top)
        // glowing lip on the valley-facing edge
        strip(lips, L.z0, L.z1, step, (z) => (side < 0 ? [v(inner(z), y, z), v(inner(z), y - 0.13, z)] : [v(inner(z), y - 0.13, z), v(inner(z), y, z)]), toValley, lip)
      }

      // back wall behind this layer, with a vertical gradient
      const wx = (z: number) => shelfX(li, side, z) + side * 0.62
      strip(walls, L.z0, L.z1, step, (z) => (side < 0 ? [v(wx(z), yTop, z), v(wx(z), yBottom, z)] : [v(wx(z), yBottom, z), v(wx(z), yTop, z)]), toValley, side < 0 ? wallTop : wall, side < 0 ? wall : wallTop)
      // glowing crown along the top of the wall
      strip(lips, L.z0, L.z1, step, (z) => (side < 0 ? [v(wx(z), yTop + 0.18, z), v(wx(z), yTop, z)] : [v(wx(z), yTop, z), v(wx(z), yTop + 0.18, z)]), toValley, lip)

      // terrace floor joining this layer to the previous wall
      if (li > 0) {
        const prev = (z: number) => shelfX(li - 1, side, z) + side * 0.62
        strip(walls, L.z0, L.z1, step, (z) => (side < 0 ? [v(wx(z), yBottom, z), v(prev(z), yBottom, z)] : [v(prev(z), yBottom, z), v(wx(z), yBottom, z)]), up, wall)
      }
    }
  })

  return { boards: toGeometry(boards), lips: toGeometry(lips), walls: toGeometry(walls) }
}

export function buildPillarTransforms() {
  const out: { matrix: Matrix4; colour: Color }[] = []
  const q = new Quaternion()
  LAYERS.forEach((L, li) => {
    const yBottom = L.y0 - 1.4
    const yTop = L.y0 + (L.tiers - 1) * L.h + 1.2
    const h = yTop - yBottom
    for (const side of [-1, 1]) {
      for (let z = L.z0 - 6; z > L.z1; z -= 14 + li * 2) {
        const x = shelfX(li, side, z) + side * 0.5
        const m = new Matrix4().compose(v(x, yBottom + h / 2, z), q, v(1, h, 1))
        out.push({ matrix: m, colour: new Color(L.pillar) })
      }
    }
  })
  return out
}
