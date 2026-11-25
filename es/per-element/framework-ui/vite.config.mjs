// Private build for the @framework/ui sweep. Bare imports made from frappe/ui
// sources are resolved from this folder (its node_modules holds the deps
// wc/ lacks: vuedraggable, @vue-flow, leaflet, cropperjs, codemirror langs),
// falling back to wc/node_modules.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { lucideIconsPlugin } from 'frappe-ui/vite/lucideIconsPlugin'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const FW = fileURLToPath(new URL('../../../frappe/ui/', import.meta.url))
const WC = fileURLToPath(new URL('../../', import.meta.url))
import { existsSync } from 'node:fs'
// @framework/ui package.json "exports": subpath -> components/<X>/index.ts, else src/*.
const fwExports = {
  name: 'fw-exports', enforce: 'pre',
  resolveId(id) {
    if (!id.startsWith('@framework/ui')) return null
    const sub = id.slice('@framework/ui'.length).replace(/^\//, '')
    if (!sub) return FW + 'src/index.ts'
    if (sub === 'fields') return FW + 'src/components/Fields/index.ts'
    if (sub === 'utils') return FW + 'src/utils/index.ts'
    if (sub === 'experimental/List') return FW + 'src/experimental/List/index.ts'
    if (existsSync(FW + 'src/components/' + sub + '/index.ts')) return FW + 'src/components/' + sub + '/index.ts'
    return this.resolve(FW + 'src/' + sub, undefined, { skipSelf: true })
  },
}
const redirect = {
  name: 'fw-bare-from-sweep', enforce: 'pre',
  async resolveId(id, importer, opts) {
    if (id.startsWith('@codemirror/lang-') && importer && !importer.startsWith(here('.'))) return this.resolve(id, here('src/entry.js'), { ...opts, skipSelf: true })
    if (!importer || !importer.startsWith(FW) || /^[./\0~]/.test(id) || id.startsWith('@framework/') || id === 'vue') return null
    return this.resolve(id, here('src/entry.js'), { ...opts, skipSelf: true })
  },
}
export default defineConfig({
  root: here('.'),
  plugins: [{ ...lucideIconsPlugin(), enforce: 'pre' }, fwExports, redirect, vue({ customElement: false })],
  css: { postcss: { plugins: [tailwind({ config: here('tailwind.config.js') }), autoprefixer()] } },
  resolve: { alias: [{ find: /^vue$/, replacement: WC + 'node_modules/vue' }, ...(process.env.FIX ? [{ find: /^\.\/define-es\.js$/, replacement: here('src-fix/define-es.js') }] : [])], dedupe: ['vue'] },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' },
  publicDir: false,
  build: {
    lib: { entry: here(process.env.SHARED ? 'src-fix/entry-shared.js' : 'src/entry.js'), formats: ['iife'], name: 'ES', fileName: () => 'es-components.js' },
    cssCodeSplit: false, outDir: here(process.env.OUT || 'build'), emptyOutDir: true,
    assetsInlineLimit: 100000, minify: false,
  },
})
