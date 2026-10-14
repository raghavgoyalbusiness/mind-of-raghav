import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

/** Dev-only: POST a canvas dataURL to /__shot?name=x → .shots/x.png (for automated visual checks). */
function shots(): Plugin {
  return {
    name: 'dev-shots',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name')?.replace(/[^a-z0-9-_]/gi, '') || 'shot'
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          mkdirSync('.shots', { recursive: true })
          writeFileSync(`.shots/${name}.png`, Buffer.from(body.replace(/^data:image\/\w+;base64,/, ''), 'base64'))
          res.end('ok')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), shots()],
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        // split heavy vendors into long-lived, separately cached chunks
        codeSplitting: {
          groups: [
            { name: (id: string) => (/node_modules[\\/]three[\\/]/.test(id) ? 'three' : null) },
            { name: (id: string) => (/node_modules[\\/](postprocessing|@react-three)[\\/]/.test(id) ? 'render' : null) },
            { name: (id: string) => (/node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/.test(id) ? 'react' : null) },
            { name: (id: string) => (/node_modules[\\/](gsap|lenis|fuse\.js)[\\/]/.test(id) ? 'motion' : null) },
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/postprocessing', 'postprocessing', 'gsap', 'gsap/ScrollTrigger', 'lenis', 'zustand', 'fuse.js'],
  },
})
