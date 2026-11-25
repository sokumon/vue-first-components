// Builds mobile_nav_es.bundle.js the way Frappe's esbuild builds an app bundle:
// frappe's own esbuild + its frappe-vue plugin (every `vue` import -> frappe.vue_modules shim) + nodePaths.
import path from 'node:path'; import os from 'node:os'; import fs from 'node:fs'
import { createRequire } from 'node:module'
const F = path.join(os.homedir(), 'fb/frappe-bench/apps/frappe')
const require = createRequire(F + '/package.json')
const esbuild = require('esbuild')
// copy of frappe/esbuild/frappe-vue.js (from the repo clone) with its 3 paths pointed at the bench
const frappe_vue = require(path.join(path.dirname(new URL(import.meta.url).pathname), 'frappe-vue.copy.cjs'))
const here = path.dirname(new URL(import.meta.url).pathname)
for (const extra of ['other_app.bundle.js']) await esbuild.build({ entryPoints: [path.join(here, extra)], bundle: true, format: 'iife', minify: true, target: ['es2020'], outfile: path.join(here, 'out', extra), plugins: [frappe_vue.plugin], nodePaths: [path.join(F, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false' }, logLevel: 'error', loader: { '.css': 'empty' } })
const r = await esbuild.build({
  entryPoints: [path.join(here, 'mobile_nav_es.bundle.js')], bundle: true, format: 'iife', minify: true, metafile: true,
  target: ['es2020'], outfile: path.join(here, 'out/mobile_nav_es.bundle.js'), plugins: [frappe_vue.plugin],
  nodePaths: [path.join(F, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false' },
  logLevel: 'warning', loader: { '.css': 'empty' },
})
const ins = Object.keys(r.metafile.inputs)
const out = {
  esbuild: esbuild.version, bytes: fs.statSync(path.join(here, 'out/mobile_nav_es.bundle.js')).size,
  vueRuntimeCopies: ins.filter((f) => /node_modules\/@vue\/runtime-(core|dom)/.test(f)).length,
  shimmed: ins.filter((f) => f.startsWith('frappe-vue:')),
  requiresVueBundle: frappe_vue.get_vue_requires(r.metafile),
}
fs.writeFileSync(path.join(here, 'out/build.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out))
