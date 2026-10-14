import { useEffect, useMemo, useRef } from 'react'
import { DISTRICTS } from '../data/mind'
import { EMOTIONS, EMOTION_INDEX } from '../lib/emotions'
import { goToDistrict } from '../lib/goto'
import { flyHome } from '../lib/nav'
import { rt } from '../lib/runtime'
import { useMind } from '../store'

const W = 132
const H = 176
// world → map: x across, z (the hall runs towards -z) up the page
const X0 = -42
const X1 = 42
const Z0 = 28
const Z1 = -268
const mx = (x: number) => 8 + ((x - X0) / (X1 - X0)) * (W - 16)
const mz = (z: number) => H - 8 - ((z - Z0) / (Z1 - Z0)) * (H - 16)

/** One hemisphere, with a wavy edge that suggests folds. */
function lobe(side: -1 | 1) {
  const pts: string[] = []
  const cx = W / 2 + side * 3
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI
    const rx = 54 * (1 + 0.03 * Math.sin(a * 11))
    const ry = 80 * (1 + 0.025 * Math.sin(a * 9 + 1))
    const bulge = 1 - 0.12 * Math.pow(Math.cos(a), 2) * (a < Math.PI / 2 ? 1.4 : 0.8) // narrower at the front, fuller behind
    pts.push(`${(cx + side * Math.sin(a) * rx * bulge).toFixed(1)},${(H / 2 - Math.cos(a) * ry).toFixed(1)}`)
  }
  return `M${pts.join(' L')} Z`
}

const GYRI = [
  'M30 46 q12 6 2 16 q-10 10 4 18',
  'M102 46 q-12 6 -2 16 q10 10 -4 18',
  'M22 96 q14 4 6 16 q-8 12 8 18',
  'M110 96 q-14 4 -6 16 q8 12 -8 18',
  'M44 30 q8 10 18 6',
  'M88 30 q-8 10 -18 6',
  'M40 146 q10 -8 20 0',
  'M92 146 q-10 -8 -20 0',
]

/** A small 2D brain showing where in the mind you are. */
export function Minimap() {
  const inHall = useMind((s) => s.inHall)
  const selected = useMind((s) => s.selected)
  const district = useMind((s) => s.district)
  const me = useRef<SVGGElement>(null)
  const paths = useMemo(() => [lobe(-1), lobe(1)], [])

  useEffect(() => {
    const tick = () => {
      const g = me.current
      const cam = rt.camera
      if (!g || !cam) return
      const dx = rt.camTarget.x - cam.position.x
      const dz = rt.camTarget.z - cam.position.z
      const ang = (Math.atan2(dx, -dz) * 180) / Math.PI
      g.setAttribute('transform', `translate(${mx(cam.position.x).toFixed(1)} ${mz(cam.position.z).toFixed(1)}) rotate(${ang.toFixed(1)})`)
    }
    rt.domTicks.add(tick)
    return () => void rt.domTicks.delete(tick)
  }, [])

  const show = inHall && !selected
  return (
    <div data-ui className={`fixed right-4 bottom-16 z-20 hidden transition-all duration-700 md:block ${show ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}>
      <div className="rounded-2xl border border-white/12 bg-black/30 p-2 backdrop-blur-xl">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Map of the mind">
          <defs>
            <radialGradient id="mm-glow" cx="50%" cy="40%" r="60%">
              <stop offset="0" stopColor="#ffb4d0" stopOpacity="0.16" />
              <stop offset="1" stopColor="#ffb4d0" stopOpacity="0" />
            </radialGradient>
          </defs>
          {paths.map((d, i) => (
            <path key={i} d={d} fill="url(#mm-glow)" stroke="rgba(255,255,255,0.32)" strokeWidth="1" />
          ))}
          {GYRI.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeLinecap="round" />
          ))}
          {/* the deck */}
          <g onClick={() => flyHome()} className="cursor-pointer">
            <title>The Control Deck</title>
            <circle cx={mx(0)} cy={mz(-8)} r="3.2" fill="none" stroke="#bff6ff" strokeWidth="1.2" />
          </g>
          {DISTRICTS.map((d) => {
            const c = EMOTIONS[EMOTION_INDEX[d.emotion]].colour
            const here = district === d.id
            return (
              <g key={d.id} onClick={() => goToDistrict(d.id)} className="cursor-pointer">
                <title>{d.name}</title>
                {here && <circle cx={mx(d.anchor[0])} cy={mz(d.anchor[2])} r="7" fill="none" stroke={c} strokeOpacity="0.7" className="mm-pulse" />}
                <circle cx={mx(d.anchor[0])} cy={mz(d.anchor[2])} r={here ? 3.8 : 2.8} fill={c} style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
                <circle cx={mx(d.anchor[0])} cy={mz(d.anchor[2])} r="8" fill="transparent" />
              </g>
            )
          })}
          {/* you are here */}
          <g ref={me}>
            <path d="M0 -6 L4 4 L0 2 L-4 4 Z" fill="#ffffff" />
          </g>
        </svg>
        <p className="mt-1 truncate text-center font-display text-[9px] tracking-[0.28em] text-white/45 uppercase">
          {district ? DISTRICTS.find((d) => d.id === district)?.name : 'the memory hall'}
        </p>
      </div>
    </div>
  )
}
