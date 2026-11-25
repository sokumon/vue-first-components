import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
const r = (p) => fileURLToPath(new URL(p, import.meta.url))
export default defineConfig({
  root: r('.'),
  plugins: [vue({ customElement: false })],
  resolve: { alias: { 'frappe-ui': r('../../../node_modules/frappe-ui'), vue: r('../../../node_modules/vue') }, dedupe: ['vue'] },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: { lib: { entry: r('entry-lazy.js'), formats: ['es'], fileName: () => 'lazy.js' }, cssCodeSplit: true, outDir: r('dist'), emptyOutDir: true, reportCompressedSize: false },
})
