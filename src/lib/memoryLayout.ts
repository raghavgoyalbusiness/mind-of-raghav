import { Vector3 } from 'three'
import { MEMORIES, type Memory } from '../data/mind'
import { canyonX, LAYERS, SHELF_DROP, shelfX } from './hallLayout'

/**
 * Real memories live on the nearest shelf wall, grouped into one labelled
 * section per district (a library index for the mind). Core memories sit on
 * the pedestal instead.
 */
const SIDES: Record<-1 | 1, string[]> = {
  [-1]: ['workshop', 'atelier', 'atlas', 'long-game'],
  [1]: ['founder-hq', 'dream-factory', 'roots', 'studio', 'track'],
}
const TIERS = [7, 6, 5, 4] // top row first, on layer 0
const SPACING = 1.2
const GAP = 2.6
const START_Z = -14
export const MEMORY_ORB_R = 0.42

export type Placement = {
  memory: Memory
  index: number // index into PLACEMENTS
  side: -1 | 1
  position: Vector3
}

export type Section = {
  district: string
  side: -1 | 1
  z0: number
  z1: number
  centre: Vector3
  /** where the camera stands to browse this section */
  view: { position: Vector3; target: Vector3 }
}

function build() {
  const placements: Placement[] = []
  const sections: Section[] = []
  const L = LAYERS[0]
  for (const side of [-1, 1] as const) {
    let z = START_Z
    for (const district of SIDES[side]) {
      const items = MEMORIES.filter((m) => m.district === district && !m.isCore)
      if (!items.length) continue
      const cols = Math.ceil(items.length / TIERS.length)
      items.forEach((memory, k) => {
        const col = Math.floor(k / TIERS.length)
        const row = k % TIERS.length
        const zz = z - col * SPACING
        const y = L.y0 + TIERS[row] * L.h - SHELF_DROP + MEMORY_ORB_R
        const x = shelfX(0, side, zz) - side * 0.08
        placements.push({ memory, index: placements.length, side, position: new Vector3(x, y, zz) })
      })
      const z0 = z + SPACING * 0.6
      const z1 = z - (cols - 1) * SPACING - SPACING * 0.6
      const zc = (z0 + z1) / 2
      const yc = L.y0 + 5.5 * L.h
      const wallX = shelfX(0, side, zc)
      const centre = new Vector3(wallX, yc, zc)
      const span = z0 - z1
      sections.push({
        district,
        side,
        z0,
        z1,
        centre,
        view: {
          position: new Vector3(canyonX(zc) - side * 1.5, yc + 0.6, zc + 4 + span * 0.25),
          target: new Vector3(wallX, yc - 0.3, zc - 0.8),
        },
      })
      z = z1 - GAP
    }
  }
  return { placements, sections }
}

export const { placements: PLACEMENTS, sections: SECTIONS } = build()

/** Shelf slots taken by real memories, so decorative orbs leave them empty. */
export function isReservedSlot(layer: number, side: number, tier: number, z: number) {
  if (layer !== 0 || tier < 4 || tier > 7) return false
  return SECTIONS.some((s) => s.side === side && z <= s.z0 + 0.2 && z >= s.z1 - 0.2)
}
