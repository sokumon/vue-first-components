// Same reference build as ../vite.config.mjs, rooted here on a different port.
import path from 'node:path'
import base from '../vite.config.mjs'
const HERE = '/home/claude/vue-first-components/wc/petite-all/shims-frappe-ui'
export default {
  ...base,
  root: HERE,
  publicDir: path.join(HERE, '../public'),
  cacheDir: path.join(HERE, '.vite'),
  server: { ...base.server, port: 5293 },
  optimizeDeps: { ...base.optimizeDeps, entries: ['index.html', ...base.optimizeDeps.entries.slice(1)] },
}
