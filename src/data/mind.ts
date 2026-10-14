import type { EmotionId } from '../lib/emotions'
import raw from './mind.json'

export type MemoryStatus = 'shipped' | 'building' | 'idea'

export type Memory = {
  id: string
  title: string
  oneLiner: string
  district: string
  emotion: EmotionId
  isCore: boolean
  year: number | null
  status: MemoryStatus
  tags: string[]
  links: string[]
  image: string | null
}

export type District = {
  id: string
  name: string
  emotion: EmotionId
  blurb: string
  anchor: [number, number, number]
}

const mind = raw as unknown as { districts: District[]; memories: Memory[] }

export const DISTRICTS = mind.districts
export const MEMORIES = mind.memories
export const CORE_MEMORIES = MEMORIES.filter((m) => m.isCore)
export const districtById = Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<string, District>
export const memoryById = Object.fromEntries(MEMORIES.map((m) => [m.id, m])) as Record<string, Memory>

/** Add a memory at runtime (e.g. an idea the Dream Factory just invented). */
export function addMemory(m: Memory) {
  if (memoryById[m.id]) return
  MEMORIES.push(m)
  memoryById[m.id] = m
}
