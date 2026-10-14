import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useMind } from '../store'
import { flyHome } from './nav'
import { rt } from './runtime'

gsap.registerPlugin(ScrollTrigger)

export let lenis: Lenis | null = null

/**
 * One scrubbed timeline drives every scroll-linked value. Durations sum to 1,
 * so timeline time == scroll progress.
 */
function buildTimeline() {
  const P = rt.scroll
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
  tl.to(P, { title: 0, duration: 0.07 }, 0.01)
  tl.to(P, { camT: 1, duration: 0.92, ease: 'power2.inOut' }, 0.06)
  tl.to(P, { streak: 0.25, slow: 0.82, duration: 0.32, ease: 'power2.inOut' }, 0.08)
  tl.to(P, { streak: 0, slow: 1, duration: 0.12, ease: 'power1.out' }, 0.4)
  tl.to(P, { morph: 1, duration: 0.44, ease: 'power1.inOut' }, 0.42)
  tl.to(P, { hall: 1, duration: 0.4, ease: 'power2.inOut' }, 0.5)
  tl.to(P, { fov: 58, duration: 0.5, ease: 'power3.inOut' }, 0.35)
  tl.to(P, { aberration: 1, duration: 0.14, ease: 'power2.in' }, 0.42)
  tl.to(P, { aberration: 0, duration: 0.22, ease: 'power2.out' }, 0.56)
  tl.set({}, {}, 1)
  return tl
}

export function initScroll() {
  const reduced = rt.reducedMotion
  lenis = new Lenis({ lerp: reduced ? 1 : 0.085, smoothWheel: !reduced })
  lenis.on('scroll', ScrollTrigger.update)
  const tick = (t: number) => lenis?.raf(t * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  const tl = buildTimeline()
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__mindTimeline = tl
    ;(window as unknown as Record<string, unknown>).__mindSetProgress = (p: number) => {
      tl.progress(p)
      rt.progress = p
      useMind.getState().setInHall(p > 0.93)
    }
  }
  const st = ScrollTrigger.create({
    trigger: '#scroll-track',
    start: 'top top',
    end: 'bottom bottom',
    scrub: reduced ? true : 1.1,
    animation: tl,
    onUpdate: () => {
      rt.progress = tl.progress()
      const inHall = rt.progress > 0.93
      if (inHall !== useMind.getState().inHall) useMind.getState().setInHall(inHall)
      // scrolling back out of the hall releases any in-hall camera flight
      if (!inHall && rt.nav.k > 0 && (useMind.getState().section || useMind.getState().district)) flyHome(1.2)
    },
  })

  return () => {
    st.kill()
    tl.kill()
    gsap.ticker.remove(tick)
    lenis?.destroy()
    lenis = null
  }
}

export function scrollToStart() {
  lenis?.scrollTo(0, { duration: rt.reducedMotion ? 0 : 3.2, easing: (x) => 1 - Math.pow(1 - x, 3) })
}

export function scrollToHall(onSettled?: () => void) {
  if (onSettled) {
    // the scrubbed timeline lags the scroll a little: wait until we are really inside
    const wait = () => (useMind.getState().inHall ? onSettled() : setTimeout(wait, 80))
    setTimeout(wait, 200)
  }
  lenis?.scrollTo('bottom', { duration: rt.reducedMotion ? 0 : 4.5, easing: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) })
}
