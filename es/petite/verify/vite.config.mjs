// Reuses the parent run's reference-side plumbing (module resolution/stubs only);
// only root, port and dep-scan entries differ. No component source is transformed
// other than by @vitejs/plugin-vue for the Vue reference.
import base from '../vite.config.mjs'
import fs from 'node:fs'
const cases = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url), 'utf8'))
export default { ...base, root: new URL('.', import.meta.url).pathname,
  server: { ...base.server, port: 5299 },
  optimizeDeps: { ...base.optimizeDeps, entries: ['index.html', ...Object.values(cases).map(c => c.abs)], include: [...base.optimizeDeps.include, 'echarts/core', 'echarts/charts', 'echarts/components', 'echarts/features', 'echarts/renderers'] } }
