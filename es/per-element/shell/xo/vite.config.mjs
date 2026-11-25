import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'
const wc = (p) => fileURLToPath(new URL('../../../' + p, import.meta.url))
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
export default defineConfig({
  root: here('.'),
  plugins: [vue({ customElement: false })],
  css: { postcss: { plugins: [tailwind({ config: here('tailwind.config.js') }), autoprefixer()] } },
  resolve: { alias: { 'frappe-ui': wc('node_modules/frappe-ui'), vue: wc('node_modules/vue'), '@framework/ui': wc('../frappe/ui/src') }, dedupe: ['vue'] },
  define: { 'process.env.NODE_ENV': '"production"' },
  publicDir: false,
  build: {
    lib: { entry: here('src/entry.js'), formats: ['iife'], name: 'ES', fileName: () => 'es-components.js' },
    cssCodeSplit: false, minify: process.env.MIN !== '0', outDir: here(process.env.OUT || 'build'), emptyOutDir: true,
  },
})
