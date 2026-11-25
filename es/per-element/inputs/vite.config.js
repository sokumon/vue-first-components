// Private experimental build for the inputs sweep: same as wc/vite.config.js,
// entry + define-es copied to sweep/inputs/src, output to sweep/inputs/exp.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
const wc = (p) => fileURLToPath(new URL('../../' + p, import.meta.url))
export default defineConfig({
  root: wc(''),
  plugins: [vue({ customElement: false })],
  resolve: { alias: { 'frappe-ui': wc('node_modules/frappe-ui'), vue: wc('node_modules/vue'), '@framework/ui': fileURLToPath(new URL('../../../frappe/ui/src', import.meta.url)) }, dedupe: ['vue'] },
  define: { 'process.env.NODE_ENV': '"production"' },
  publicDir: false,
  build: {
    lib: { entry: fileURLToPath(new URL('./src/entry.js', import.meta.url)), formats: ['iife'], name: 'ES', fileName: () => 'es-components.js' },
    cssCodeSplit: false, outDir: fileURLToPath(new URL('./exp', import.meta.url)), emptyOutDir: true,
  },
})
