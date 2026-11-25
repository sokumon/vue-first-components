// MODE=iife  -> dist/es-ui.iife.js   (Vue bundled; for plain test pages)
// MODE=esm   -> dist/esm/es-ui.js    (vue external; Frappe's esbuild resolves Desk's own Vue)
// CSS comes out of the iife build as dist/es-ui.raw.css; build.sh derives the two shipped sheets.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { lucideIconsPlugin } from 'frappe-ui/vite/lucideIconsPlugin'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const WC = here('../')
const FW = here('../../frappe/ui/')
const SWEEP = here('../sweep/framework-ui/') // its node_modules holds the deps @framework/ui needs beyond wc/ (read only)
const MODE = process.env.MODE || 'iife'

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
// Bare imports from frappe/ui sources resolve from the sweep's node_modules, then wc/node_modules.
const redirect = {
  name: 'fw-bare', enforce: 'pre',
  async resolveId(id, importer, opts) {
    if (id === 'vue' || id.startsWith('vue/')) return null
    if (id.startsWith('@codemirror/lang-') && importer && !importer.startsWith(SWEEP)) return this.resolve(id, SWEEP + 'src/entry.js', { ...opts, skipSelf: true })
    if (!importer || !importer.startsWith(FW) || /^[./\0~]/.test(id) || id.startsWith('@framework/')) return null
    return this.resolve(id, SWEEP + 'src/entry.js', { ...opts, skipSelf: true })
  },
}
const vueAlias = MODE === 'iife' ? [{ find: /^vue$/, replacement: WC + 'node_modules/vue' }] : []
export default defineConfig({
  root: here('.'),
  plugins: [{ ...lucideIconsPlugin(), enforce: 'pre' }, fwExports, redirect, vue({ customElement: false })],
  css: { postcss: { plugins: [tailwind({ config: here('tailwind.config.js') }), autoprefixer()] } },
  resolve: { alias: vueAlias, dedupe: ['vue'] },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
  publicDir: false,
  build: {
    lib: MODE === 'iife'
      ? { entry: here('src/iife.js'), formats: ['iife'], name: 'ESUI', fileName: () => 'es-ui.iife.js' }
      : { entry: here('src/entry.js'), formats: ['es'], fileName: () => 'es-ui.js' },
    rollupOptions: MODE === 'esm' ? { external: [/^vue$/] } : {},
    // CJS deps that require('vue') (vuedraggable) import it as a namespace, not a default
    commonjsOptions: { esmExternals: true },
    cssCodeSplit: false,
    outDir: here(MODE === 'iife' ? 'dist' : 'dist/esm'),
    emptyOutDir: !process.env.KEEP,
    assetsInlineLimit: 100000,
    minify: process.env.NOMIN ? false : 'esbuild',
    target: 'es2020',
  },
})
