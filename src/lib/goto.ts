import { memoryById } from '../data/mind'
import { useMind } from '../store'
import { closeMemory, openMemory } from './memoryActions'
import { flyToDistrict, flyToSection } from './nav'
import { rt } from './runtime'
import { scrollToHall } from './scroll'

/** Make sure we are inside the hall (scrolling there first if needed), then act. */
function inHall(then: () => void) {
  if (useMind.getState().selected) closeMemory()
  if (useMind.getState().inHall) then()
  else scrollToHall(then)
}

/** Fly to a memory's district and project it out of its orb there. */
export function goToMemory(id: string) {
  const m = memoryById[id]
  if (!m) return
  inHall(() =>
    flyToDistrict(m.district, undefined, () => {
      // the district's orbs mount once the camera is near: wait for this one to register
      let tries = 0
      const open = () => {
        const w = rt.districtOrbWorld.get(id)
        if (w || tries++ > 40) openMemory(id, 0.6, w)
        else setTimeout(open, 50)
      }
      setTimeout(open, 120)
    }),
  )
}

export function goToDistrict(id: string) {
  inHall(() => flyToDistrict(id))
}

export function goToSection(id: string) {
  inHall(() => flyToSection(id))
}
