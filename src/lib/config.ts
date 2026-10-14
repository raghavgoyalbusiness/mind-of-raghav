const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
const narrow = typeof window !== 'undefined' && window.innerWidth < 768

export const IS_MOBILE = coarse || narrow
export const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const PARTICLE_COUNT = IS_MOBILE ? 15000 : 60000
export const SPHERE_RADIUS = 3
export const BASE_FLOW_SPEED = 0.32 // radians / second
export const MAX_DPR = IS_MOBILE ? 1.5 : 1.75
