import { addMemory, type Memory } from '../data/mind'
import { useMind } from '../store'
import { goToDistrict } from './goto'
import { mulberry32 } from './random'
import { sound } from './sound'

/* ---------- 3 AM: night mode ---------- */

export const isNightNow = () => new URLSearchParams(location.search).has('night') || new Date().getHours() === 3

/* ---------- the Dream Factory's idea machine (Konami code) ---------- */

const SYL = ['ka', 'lu', 'vo', 'mi', 'ra', 'ze', 'no', 'ti', 'sa', 'fe', 'qu', 'do']
const END = ['ly', 'io', 'ra', 'ix', 'en', 'o', 'a', 'um']
const WHAT = ['An AI diary', 'A tiny radio station', 'A pocket marketplace', 'A co-pilot', 'A vending machine', 'A newsletter', 'A living map', 'A pop-up museum', 'An alarm clock', 'A rooftop greenhouse', 'A robot tailor', 'A midnight bookshop', 'A habit casino', 'A voice-first CRM']
const FOR = ['for founders', 'for night owls', 'for marathon runners', 'for grandparents', 'for first-time travellers', 'for small shops in Delhi', 'for London commuters', 'for podcasters', 'for hackathon teams', 'that pays you to sleep', 'that only works at 3 AM', 'for people who hate apps']

let ideaN = 0
const rnd = mulberry32(Date.now() & 0xffff)
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]

function inventIdea(): Memory {
  const name = (pick(SYL) + pick(SYL) + pick(END)).replace(/^./, (c) => c.toUpperCase())
  ideaN++
  return {
    id: `invented-${Date.now().toString(36)}-${ideaN}`,
    title: name,
    oneLiner: `${pick(WHAT)} ${pick(FOR)}.`,
    district: 'dream-factory',
    emotion: 'curiosity',
    isCore: false,
    year: null,
    status: 'idea',
    tags: ['idea', 'invented on the spot', 'konami'],
    links: [],
    image: null,
  }
}

export function spawnIdea() {
  const m = inventIdea()
  addMemory(m)
  const st = useMind.getState()
  if (st.focus) st.toggleFocus() // ideas need the factory open
  const firstTime = st.extraIdeas.length === 0
  st.addIdea(m.id)
  st.say(`New idea: ${m.title}`, m.oneLiner)
  sound.swell(true)
  if (firstTime || st.district !== 'dream-factory') goToDistrict('dream-factory')
}

/* ---------- key sequences ---------- */

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']

export function initEggs() {
  let typed = ''
  let konami = 0
  const key = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable]')) return
    const k = e.key.toLowerCase()
    // Konami code: the Dream Factory spits out a brand new idea
    konami = k === KONAMI[konami] ? konami + 1 : k === KONAMI[0] ? 1 : 0
    if (konami === KONAMI.length) {
      konami = 0
      spawnIdea()
    }
    // "weongo": the tagline, blinked in Morse by a pair of eyes in the sky
    if (k.length === 1) {
      typed = (typed + k).slice(-6)
      if (typed === 'weongo') {
        typed = ''
        useMind.getState().blinkMorse()
      }
    }
  }
  window.addEventListener('keydown', key)

  // night mode follows the clock
  const check = () => {
    const n = isNightNow()
    const st = useMind.getState()
    if (n !== st.night) {
      st.setNight(n)
      if (n) st.say('3 AM. The Studio is live.', 'The hall dims; the stars come out.')
    }
  }
  check()
  const iv = setInterval(check, 60_000)
  return () => {
    window.removeEventListener('keydown', key)
    clearInterval(iv)
  }
}
