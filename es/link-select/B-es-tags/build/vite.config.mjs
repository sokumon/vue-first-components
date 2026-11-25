// ES module of the wc/jq runtime with only es-combobox and es-select. `vue` stays a bare import,
// so Frappe's esbuild (one-vue plugin) resolves it to Desk's one Vue (frappe.Vue).
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { lucideIconsPlugin } from 'frappe-ui/vite/lucideIconsPlugin'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
// [sweep-shell fix 5] keep runtime prop types (a production compileScript drops all but Boolean/Function)
const vuePlugin = vue({ customElement: false })
const keepPropTypes = { name: 'keep-prop-types', configResolved() { vuePlugin.api.options = { ...vuePlugin.api.options, isProduction: false } } }
export default defineConfig({
  root: here('.'),
  plugins: [{ ...lucideIconsPlugin(), enforce: 'pre' }, vuePlugin, keepPropTypes],
  css: { postcss: { plugins: [] } },
  resolve: { dedupe: ['vue'] },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
  publicDir: false,
  build: {
    lib: { entry: here('src/entry.js'), formats: ['es'], fileName: () => 'es-link.js' },
    rollupOptions: { external: [/^vue$/] },
    cssCodeSplit: false,
    outDir: here('dist'),
    emptyOutDir: true,
    assetsInlineLimit: 100000,
    minify: 'esbuild',
    target: 'es2020',
  },
})
