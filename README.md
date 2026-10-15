# The Mind of Raghav

An immersive 3D website: a walkable model of Raghav Goyal's mind. From far away it is a
spinning sphere of 60,000 streaks of light; scroll in and it becomes a canyon of glowing
memory orbs, organised into nine districts.

Built with React, TypeScript, Vite, Tailwind, three.js via @react-three/fiber,
@react-three/postprocessing, GSAP + ScrollTrigger, Lenis and zustand.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Live at https://mind-of-raghav.netlify.app. Every push to `main` rebuilds and redeploys it on Netlify.

## Adding a memory

Everything lives in [`src/data/mind.json`](src/data/mind.json). Add an entry to `memories`:

```json
{
  "id": "jarvis",
  "title": "Jarvis",
  "oneLiner": "Personal AI assistant on Telegram with voice, memory and sub-agents",
  "district": "workshop",
  "emotion": "craft",
  "isCore": false,
  "year": 2026,
  "status": "shipped",
  "tags": ["ai", "telegram", "assistant"],
  "links": ["https://example.com"],
  "image": null
}
```

- `district`: one of the ids in `districts` (founder-hq, workshop, dream-factory, atelier,
  roots, atlas, studio, track, long-game). The memory appears on that district's shelf in
  the Memory Hall and inside the district itself.
- `emotion`: ambition, curiosity, craft, grit, roots or wonder (sets the orb's colour).
- `status`: `shipped` (solid glow), `building` (pulsing) or `idea` (translucent bubble).
- `isCore`: core memories sit on the pedestal on the Control Deck and act as portals.
- `links` show as buttons in the Memory Projection.

## Where things are

| | |
|---|---|
| `src/three/MemoryParticles.tsx` + `shaders/particles.ts` | the sphere → shelves particle system (one draw call) |
| `src/three/Hall.tsx`, `hallGeometry.ts`, `lib/hallLayout.ts` | the canyon of shelves, sky, god-rays |
| `src/three/ControlDeck.tsx` | glass deck, pedestal, core memories, neural cables |
| `src/three/districts/*` | the nine districts and their interactions |
| `src/ui/*` | search, legend, minimap, projection, sheets, toasts |
| `src/lib/sound.ts` | synthesised ambient pad and chimes (no audio files) |
| `src/lib/eggs.ts` | easter eggs |

## Easter eggs

- Visit between 3:00 and 4:00 AM (or add `?night` to the URL): night mode, and the Studio goes LIVE.
- Type `weongo` anywhere: the tagline, blinked in Morse by a pair of eyes in the sky.
- Konami code (↑ ↑ ↓ ↓ ← → ← → B A): the Dream Factory invents a new idea.
- Click and hold the sphere: reverse the spin.

Deep links: `#m/<memory-id>` opens a memory directly.
