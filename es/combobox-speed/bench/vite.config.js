// Combobox mount/update benchmark.
//   FUI=npm    -> wc/node_modules/frappe-ui (npm 1.2.0)          [default]
//   FUI=clone  -> ../../../frappe-ui (the clone; whatever branch is checked out)
//   FUI=/abs/path -> any frappe-ui checkout (e.g. a patched copy)
//   MODE=prod (default, minified) | prof (prod, unminified + sourcemaps) | count (prod + reactivity counters)
//        | dev (Vue dev build, app.config.performance marks)
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const WC = path.resolve(here, '../..')
const FUI_ENV = process.env.FUI || 'npm'
const FUI =
  FUI_ENV === 'npm' ? path.join(WC, 'node_modules/frappe-ui')
  : FUI_ENV === 'clone' ? path.resolve(WC, '../frappe-ui')
  : path.resolve(FUI_ENV)
const MODE = process.env.MODE || 'prod'
const tag = (process.env.TAG || (FUI_ENV === 'npm' || FUI_ENV === 'clone' ? FUI_ENV : path.basename(FUI))) + '-' + MODE
const MAIN = path.join(here, 'src/main.js')

// Bare imports from a checkout without its own node_modules (the clone) resolve from wc/node_modules,
// as if the bench had imported them. The npm copy already lives in wc/node_modules.
function cloneDeps() {
  return {
    name: 'clone-deps',
    enforce: 'pre',
    async resolveId(id, importer, opts) {
      if (!importer || !importer.startsWith(FUI + path.sep) || FUI.startsWith(path.join(WC, 'node_modules'))) return
      if (/^[./\0#]/.test(id) || id.startsWith('virtual:') || path.isAbsolute(id)) return
      return this.resolve(id, MAIN, { ...opts, skipSelf: true })
    },
  }
}

// MODE=count: counters in @vue/reactivity's constructors. Each creation is logged with the effect scope
// that was active (a component's setup/render run with its instance scope active), so main.js can
// attribute effects/computeds/refs to component instances.
function countReactivity() {
  const hook = (kind) => `globalThis.__fx && globalThis.__fx(${JSON.stringify(kind)}, activeEffectScope);`
  const marks = [
    ['class ReactiveEffect {\n  constructor(fn) {', 'effect'],
    ['class ComputedRefImpl {\n  constructor(fn, setter, isSSR) {', 'computed'],
    ['class RefImpl {\n  constructor(value, isShallow2) {', 'ref'],
    ['class ObjectRefImpl {\n  constructor(_object, key, _defaultValue) {', 'objectRef'],
    ['class GetterRefImpl {\n  constructor(_getter) {', 'getterRef'],
    ['class CustomRefImpl {\n  constructor(factory) {', 'customRef'],
    ['class EffectScope {\n  // TODO isolatedDeclarations "__v_skip"\n  constructor(detached = false) {', 'scope'],
    ['class Dep {\n  // TODO isolatedDeclarations "__v_skip"\n  constructor(computed) {', 'dep'],
    ['  const proxy = new Proxy(\n    target,', 'proxy', true],
  ]
  return {
    name: 'count-reactivity',
    transform(code, id) {
      if (!id.includes('reactivity.esm-bundler.js')) return
      for (const [m, kind, before] of marks) {
        if (!code.includes(m)) throw new Error('count-reactivity: marker not found: ' + m)
        code = code.replace(m, before ? hook(kind) + '\n' + m : m + '\n' + hook(kind))
      }
      // watch() (also what runtime-core's watch/watchEffect call)
      const w = 'function watch(source, cb, options = EMPTY_OBJ) {'
      if (!code.includes(w)) throw new Error('count-reactivity: watch marker not found')
      code = code.replace(w, w + '\n' + hook('watch'))
      return { code, map: null }
    },
  }
}

export default defineConfig({
  root: here,
  base: './',
  mode: MODE === 'dev' ? 'development' : 'production',
  plugins: [cloneDeps(), vue(), ...(MODE === 'count' ? [countReactivity()] : [])],
  resolve: {
    alias: {
      'fui-src': path.join(FUI, 'src'),
      vue: path.join(WC, 'node_modules/vue'),
    },
    dedupe: ['vue', 'reka-ui'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(MODE === 'dev' ? 'development' : 'production'),
    __FUI__: JSON.stringify(FUI_ENV),
    __FUI_PATH__: JSON.stringify(FUI),
    __MODE__: JSON.stringify(MODE),
  },
  css: { postcss: path.join(here) },
  build: {
    outDir: path.join(here, 'dist', tag),
    emptyOutDir: true,
    minify: MODE === 'prod' || MODE === 'count' ? 'esbuild' : false,
    sourcemap: MODE === 'prof' || MODE === 'dev',
    modulePreload: false,
  },
})
