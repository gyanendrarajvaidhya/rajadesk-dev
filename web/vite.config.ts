import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The running Raja Desk Dev server (`rajadesk --dev`).
const SERVER = `http://127.0.0.1:${process.env.RAJADESK_DEV_PORT ?? 4646}`

// Dev only: POSTs need the server's per-run token, which it injects into the page it serves. Read it from there.
function rajaToken(): Plugin {
  return {
    name: 'raja-token',
    apply: 'serve',
    async transformIndexHtml(html) {
      const page = await fetch(`${SERVER}/`).then((r) => r.text()).catch(() => '')
      const token = page.match(/"([0-9a-f]{48})"/)?.[1]
      if (!token) console.warn(`[raja-token] Raja Desk Dev is not running at ${SERVER}; start it for writes to work.`)
      return token ? html.replace('__RAJA_TOKEN__', token) : html
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), rajaToken()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // The build goes into the npm package (../public), which the server serves. It is committed, so installs need no build.
  build: { outDir: '../public', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { host: '127.0.0.1', port: 5175, proxy: { '/api': { target: SERVER, changeOrigin: true } } },
})
