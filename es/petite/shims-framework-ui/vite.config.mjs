// Same reference plumbing as ../vite.config.mjs; only root, port and entries differ.
import base from '../vite.config.mjs'
import fs from 'node:fs'
const HERE = '/home/claude/vue-first-components/wc/petite-all/shims-framework-ui'
const rows = JSON.parse(fs.readFileSync(HERE + '/../analysis.json', 'utf8')).filter(r => r.file.startsWith('frappe/'))
export default {
  ...base,
  root: HERE,
  publicDir: HERE + '/../public',
  cacheDir: HERE + '/.vite',
  server: { ...base.server, port: 5297 },
  optimizeDeps: { ...base.optimizeDeps, entries: ['index.html', ...rows.map(r => r.abs)] },
}
