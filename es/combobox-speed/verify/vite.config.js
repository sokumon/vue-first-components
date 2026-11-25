// Independent verify harness. FUI=/abs/frappe-ui-checkout TAG=name MODE=dev|prod npx --no-install vite build
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const here = path.dirname(fileURLToPath(import.meta.url))
const WC = path.resolve(here, '../..')
const FUI = path.resolve(process.env.FUI)
const MODE = process.env.MODE || 'dev'
const tag = process.env.TAG + '-' + MODE
const MAIN = path.join(here, 'src/main.js')
function cloneDeps() {
  return { name: 'clone-deps', enforce: 'pre',
    async resolveId(id, importer, opts) {
      if (!importer || !importer.startsWith(FUI + path.sep)) return
      if (/^[./\0#]/.test(id) || id.startsWith('virtual:') || path.isAbsolute(id)) return
      return this.resolve(id, MAIN, { ...opts, skipSelf: true })
    } }
}
export default defineConfig({
  root: here, base: './', mode: MODE === 'dev' ? 'development' : 'production',
  plugins: [cloneDeps(), vue()],
  resolve: { alias: { 'fui-src': path.join(FUI, 'src'), vue: path.join(WC, 'node_modules/vue') }, dedupe: ['vue', 'reka-ui'] },
  define: { 'process.env.NODE_ENV': JSON.stringify(MODE === 'dev' ? 'development' : 'production'), __TAG__: JSON.stringify(tag) },
  css: { postcss: here },
  build: { outDir: path.join(here, 'dist', tag), emptyOutDir: true, minify: MODE === 'prod' ? 'esbuild' : false, modulePreload: false },
})
