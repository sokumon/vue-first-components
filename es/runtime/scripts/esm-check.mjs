// Bundles a tiny Desk-style entry with Frappe's own esbuild and build options
// (nodePaths = the bench apps' node_modules, the same defines), the way
// frappe/esbuild/esbuild.js builds an app bundle. The entry imports Desk's
// Vue (as vue_global.js does) and dist/esm/es-ui.js, which leaves `vue` bare.
// The bundle must contain exactly one Vue: the one in frappe's node_modules.
// Output: dist/check/desk-esm.js (loaded by test/pages/esm.html).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const BENCH_FRAPPE = path.join(os.homedir(), 'fb/frappe-bench/apps/frappe')
const require = createRequire(BENCH_FRAPPE + '/package.json')
const esbuild = require('esbuild')
const here = path.dirname(new URL(import.meta.url).pathname)
const dist = path.join(here, '../dist')
// A directory with no node_modules above it, so `vue` resolves only through nodePaths (as for an app's public/js).
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'es-esm-check-'))
fs.cpSync(path.join(dist, 'esm'), path.join(work, 'esm'), { recursive: true })
fs.writeFileSync(path.join(work, 'entry.js'), `import * as Vue from "vue";
import { ES } from "./esm/es-ui.js";
window.__deskVue = Vue; // what vue_global.js hands out as frappe.Vue
window.ES = ES;
`)
const deskPkg = JSON.parse(fs.readFileSync('/home/claude/vue-first-components/frappe/package.json', 'utf8'))
const r = await esbuild.build({
  entryPoints: [path.join(work, 'entry.js')], bundle: true, format: 'iife', minify: true, metafile: true,
  target: ['es2020'], outfile: path.join(dist, 'check/desk-esm.js'),
  nodePaths: [path.join(BENCH_FRAPPE, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false' },
  logLevel: 'warning',
})
const vueInputs = Object.keys(r.metafile.inputs).filter((f) => /node_modules\/@?vue\//.test(f) && /runtime-core/.test(f))
const resolvedVue = JSON.parse(fs.readFileSync(path.join(BENCH_FRAPPE, 'node_modules/vue/package.json'), 'utf8')).version
const out = { esbuild: esbuild.version, frappeWants: deskPkg.dependencies?.vue || deskPkg.devDependencies?.vue, resolvedVue, runtimeCoreCopies: vueInputs.length, runtimeCore: vueInputs.map((f) => path.relative(os.homedir(), path.resolve(f))), bytes: fs.statSync(path.join(dist, 'check/desk-esm.js')).size }
fs.writeFileSync(path.join(dist, 'check/esm-check.json'), JSON.stringify(out, null, 1))
fs.rmSync(work, { recursive: true, force: true })
console.log('esm-check:', JSON.stringify(out))
if (out.runtimeCoreCopies !== 1 || !out.runtimeCore[0].startsWith('fb/frappe-bench/apps/frappe/node_modules')) process.exit(1)
