import { create } from 'zustand'

type Phase = 'loading' | 'ready'

export type ProjectionOrigin = { x: number; y: number; r: number }

type MindState = {
  phase: Phase
  /** emotion index currently isolated by the legend, null = all */
  filter: number | null
  /** how many times the visitor has reversed the spin */
  reversals: number
  /** true once the camera has settled inside the Memory Hall */
  inHall: boolean
  /** memory under the pointer (or tapped once on touch) */
  hovered: string | null
  /** memory open in the Memory Projection */
  selected: string | null
  origin: ProjectionOrigin | null
  /** shelf section the camera has flown to, null = overlooking from the deck */
  section: string | null
  /** district the camera has flown to */
  district: string | null
  /** the Dream Factory's FOCUS lever */
  focus: boolean
  /** 3–4 AM local time (or ?night) */
  night: boolean
  /** a passing message at the bottom of the screen */
  toast: { id: number; text: string; sub?: string } | null
  /** bumps each time someone types "weongo" */
  morse: number
  /** ideas the Dream Factory invented on the spot (Konami code) */
  extraIdeas: string[]
  setPhase: (p: Phase) => void
  setFilter: (f: number | null) => void
  addReversal: () => void
  setInHall: (v: boolean) => void
  setHovered: (id: string | null) => void
  open: (id: string, origin: ProjectionOrigin | null) => void
  close: () => void
  setSection: (id: string | null) => void
  setDistrict: (id: string | null) => void
  toggleFocus: () => void
  setNight: (v: boolean) => void
  say: (text: string, sub?: string) => void
  blinkMorse: () => void
  addIdea: (id: string) => void
}

export const useMind = create<MindState>((set) => ({
  phase: 'loading',
  filter: null,
  reversals: 0,
  inHall: false,
  hovered: null,
  selected: null,
  origin: null,
  section: null,
  district: null,
  focus: false,
  night: false,
  toast: null,
  morse: 0,
  extraIdeas: [],
  setPhase: (phase) => set({ phase }),
  setFilter: (filter) => set({ filter }),
  addReversal: () => set((s) => ({ reversals: s.reversals + 1 })),
  setInHall: (inHall) => set(inHall ? { inHall } : { inHall, hovered: null }),
  setHovered: (hovered) => set({ hovered }),
  open: (selected, origin) => set({ selected, origin, hovered: null }),
  close: () => set({ selected: null }),
  setSection: (section) => set({ section, district: null }),
  setDistrict: (district) => set({ district, section: null }),
  toggleFocus: () => set((s) => ({ focus: !s.focus })),
  setNight: (night) => set({ night }),
  say: (text, sub) => set((s) => ({ toast: { id: (s.toast?.id ?? 0) + 1, text, sub } })),
  blinkMorse: () => set((s) => ({ morse: s.morse + 1 })),
  addIdea: (id) => set((s) => ({ extraIdeas: [...s.extraIdeas, id] })),
}))
