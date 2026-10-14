import { Vector3 } from 'three'

/** Uniform objects shared by reference across every custom hall material. */
export const shared = {
  uTime: { value: 0 },
  uHall: { value: 0 },
  /** Founder HQ beacon: world position, sweep angle in the XZ plane, power */
  uBeaconPos: { value: new Vector3(-12, 16.3, -150) },
  uBeaconAngle: { value: 0 },
  uBeaconPower: { value: 1 },
  /** 0..1: the 3 AM night mode */
  uNight: { value: 0 },
}

export const HALL_FOG_DENSITY = 0.006
