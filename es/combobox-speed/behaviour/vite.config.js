// Behaviour harness for Combobox (Playwright, see check.cjs).
//   FUI=/abs/frappe-ui-checkout TAG=name MODE=dev|prod npx --no-install vite build
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const WC = path.resolve(here, '../..')
const FUI_ENV = process.env.FUI || 'clone'
const FUI = FUI_ENV === 'npm' ? path.join(WC, 'node_modules/frappe-ui') : FUI_ENV === 'clone' ? path.resolve(WC, '../frappe-ui') : path.resolve(FUI_ENV)
const MODE = process.env.MODE || 'dev'
const tag = (process.env.TAG || path.basename(FUI)) + '-' + MODE
const MAIN = path.join(here, 'src/main.js')
function cloneDeps() {
  return {
    name: 'clone-deps', enforce: 'pre',
    async resolveId(id, importer, opts) {
      if (!importer || !importer.startsWith(FUI + path.sep) || FUI.startsWith(path.join(WC, 'node_modules'))) return
      if (/^[./\0#]/.test(id) || id.startsWith('virtual:') || path.isAbsolute(id)) return
      return this.resolve(id, MAIN, { ...opts, skipSelf: true })
    },
  }
}
export default defineConfig({
  root: here, base: './',
  mode: MODE === 'dev' ? 'development' : 'production',
  plugins: [cloneDeps(), vue()],
  resolve: { alias: { 'fui-src': path.join(FUI, 'src'), vue: path.join(WC, 'node_modules/vue') }, dedupe: ['vue', 'reka-ui'] },
  define: { 'process.env.NODE_ENV': JSON.stringify(MODE === 'dev' ? 'development' : 'production') },
  css: { postcss: path.join(here, '../bench') },
  build: { outDir: path.join(here, 'dist', tag), emptyOutDir: true, minify: false, modulePreload: false },
})
