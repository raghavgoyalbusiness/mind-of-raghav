import { type Camera, Vector2, Vector3 } from 'three'
import { PREFERS_REDUCED_MOTION } from './config'

/**
 * Mutable per-frame state shared between the DOM layer and the WebGL layer.
 * Read inside useFrame / rAF loops; never drives React renders directly.
 */
export const rt = {
  /** values scrubbed by the scroll timeline */
  scroll: {
    camT: 0,
    streak: 1,
    slow: 0,
    morph: 0,
    hall: 0,
    title: 1,
    fov: 40,
    aberration: 0,
  },
  /** raw timeline progress 0..1 */
  progress: 0,
  pointer: new Vector2(0, 0),
  pointerActive: false,
  holding: false,
  overSphere: false,
  /** +1 forward, -1 reversed */
  spinDir: 1 as 1 | -1,
  /** current signed flow speed (eased) */
  flowSpeed: 0,
  assemble: 0,
  reducedMotion: PREFERS_REDUCED_MOTION,
  /** set by CameraRig, used by DOM overlays to project world → screen */
  camera: null as Camera | null,
  /** where the camera is currently looking */
  camTarget: new Vector3(),
  /** world position + radius of the hovered orb, for the glass card */
  hoverWorld: new Vector3(),
  hoverRadius: 0.4,
  /** which orb instance owns the hover (the same memory can appear on a shelf and in its district) */
  hoverOwner: '',
  /** world positions of every interactive orb by memory id (updated per frame) */
  orbWorld: new Map<string, Vector3>(),
  /** the same memories, as they appear inside their districts */
  districtOrbWorld: new Map<string, Vector3>(),
  /** live world position of the orb the projection grew out of */
  projWorld: null as Vector3 | null,
  projRadius: 0.42,
  /** drag-to-look */
  look: { yaw: 0, pitch: 0, yawT: 0, pitchT: 0 },
  dragMoved: false,
  /** camera navigation inside the hall: blend k from scroll camera → nav camera */
  nav: { k: 0, pos: new Vector3(), tgt: new Vector3() },
  /** set by the adaptive quality controller when the device is struggling */
  lowQuality: false,
  /** letter of the tagline currently being blinked in Morse (-1 = none) */
  morseLetter: -1,
  /** DOM overlays that track the 3D scene; ticked once per animation frame */
  domTicks: new Set<() => void>(),
  /** synchronous ray test against the outer sphere, set by MemoryParticles */
  hitSphere: (() => false) as (ndcX: number, ndcY: number) => boolean,
}
