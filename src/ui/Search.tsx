import Fuse from 'fuse.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CORE_MEMORIES, DISTRICTS, districtById, MEMORIES } from '../data/mind'
import { EMOTIONS, EMOTION_INDEX } from '../lib/emotions'
import { goToDistrict, goToMemory } from '../lib/goto'
import { useMind } from '../store'
import { STATUS_LABEL } from './HoverCard'

type Item = { kind: 'memory' | 'district'; id: string; title: string; sub: string; colour: string; text: string; tags: string[]; status?: string }

const ITEMS: Item[] = [
  ...MEMORIES.map((m) => ({
    kind: 'memory' as const,
    id: m.id,
    title: m.title,
    sub: districtById[m.district]?.name ?? '',
    colour: EMOTIONS[EMOTION_INDEX[m.emotion]].colour,
    text: m.oneLiner,
    tags: [...m.tags, m.emotion, m.status],
    status: STATUS_LABEL[m.status],
  })),
  ...DISTRICTS.map((d) => ({
    kind: 'district' as const,
    id: d.id,
    title: d.name,
    sub: 'District',
    colour: EMOTIONS[EMOTION_INDEX[d.emotion]].colour,
    text: d.blurb,
    tags: [d.emotion],
  })),
]

const SUGGESTED = CORE_MEMORIES.map((m) => ITEMS.find((i) => i.id === m.id)!)

/** "search my mind…" — fuzzy search over every memory and district; picking one flies there. */
export function Search() {
  const phase = useMind((s) => s.phase)
  const selected = useMind((s) => s.selected)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const fuse = useMemo(
    () =>
      new Fuse(ITEMS, {
        keys: [
          { name: 'title', weight: 0.6 },
          { name: 'tags', weight: 0.2 },
          { name: 'text', weight: 0.15 },
          { name: 'sub', weight: 0.05 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [],
  )
  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return SUGGESTED
    // literal matches first (title, then anywhere), then fuzzy ones for typos
    const hay = (it: Item) => `${it.title} ${it.text} ${it.tags.join(' ')} ${it.sub}`.toLowerCase()
    const rank = (it: Item) => {
      const t = it.title.toLowerCase()
      if (t === query) return 0
      if (t.startsWith(query)) return 1
      if (t.split(/[\s/,.-]+/).some((w) => w.startsWith(query))) return 2
      return t.includes(query) ? 3 : 4
    }
    const exact = ITEMS.filter((it) => hay(it).includes(query)).sort((a, b) => rank(a) - rank(b))
    const fuzzy = fuse.search(query, { limit: 10 }).map((r) => r.item)
    return [...new Set([...exact, ...fuzzy])].slice(0, 7)
  }, [q, fuse])

  // ⌘K / Ctrl+K or "/" focuses the search
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea')
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const pick = (it: Item) => {
    setOpen(false)
    setQ('')
    input.current?.blur()
    if (it.kind === 'memory') goToMemory(it.id)
    else goToDistrict(it.id)
  }

  return (
    <div data-ui className={`fixed top-4 right-4 z-30 w-[min(320px,calc(100vw-80px))] transition-opacity duration-700 ${phase === 'ready' && !selected ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      <div className={`flex items-center gap-2 rounded-full border bg-black/30 px-4 py-2 backdrop-blur-xl transition-colors ${open ? 'border-white/40' : 'border-white/15'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-white/50" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)))
            else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)))
            else if (e.key === 'Enter' && results[active]) pick(results[active])
            else if (e.key === 'Escape') (setQ(''), input.current?.blur())
          }}
          placeholder="search my mind…"
          aria-label="Search memories and districts"
          className="w-full bg-transparent font-sans text-[13px] text-white placeholder:text-white/40 focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded border border-white/15 px-1.5 font-display text-[9px] text-white/35 sm:block">⌘K</kbd>
      </div>

      {open && (
        <div className="card-in mt-2 overflow-hidden rounded-2xl border border-white/15 bg-black/45 p-1.5 shadow-2xl backdrop-blur-xl">
          <p className="px-3 pt-2 pb-1 font-display text-[9px] tracking-[0.3em] text-white/35 uppercase">{q.trim() ? `${results.length || 'no'} result${results.length === 1 ? '' : 's'}` : 'core memories'}</p>
          {results.map((it, i) => (
            <button
              key={it.kind + it.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(it)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${i === active ? 'bg-white/10' : ''}`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${it.kind === 'district' ? 'rounded-sm' : ''}`}
                style={it.status === 'Idea' ? { border: `1px solid ${it.colour}` } : { background: it.colour, boxShadow: `0 0 8px ${it.colour}` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-white/90">{it.title}</span>
                <span className="block truncate text-[11px] text-white/45">
                  {it.sub}
                  {it.status ? ` · ${it.status}` : ''}
                </span>
              </span>
              <span className="text-xs text-white/30" aria-hidden>
                ↗
              </span>
            </button>
          ))}
          {q.trim() && results.length === 0 && <p className="px-3 py-3 text-[13px] text-white/50">Nothing in here by that name… yet.</p>}
        </div>
      )}
    </div>
  )
}
