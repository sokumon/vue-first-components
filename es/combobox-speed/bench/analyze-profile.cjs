// Attribute CPU profiles of a MODE=prof build (unminified, sourcemapped) to original sources.
//   node analyze-profile.cjs <distTag> <profile.cpuprofile...>  > out.md
// Self time: by source group and by function. Inclusive: a sample counts once for every distinct
// group / function on its stack. "Nearest owner": each sample charged to the innermost frame that is
// frappe-ui / reka / vueuse / floating-ui / bench code (Vue's own machinery under a component's
// setup/render goes to that component; Vue work under no such frame stays "vue (no owner)").
const fs = require('fs')
const path = require('path')
const { SourceMapConsumer } = require(path.join(__dirname, '../../node_modules/source-map-js'))

const [tag, ...files] = process.argv.slice(2)
const assets = path.join(__dirname, 'dist', tag, 'assets')
const mapFile = fs.readdirSync(assets).find((f) => f.endsWith('.js.map'))
const smc = new SourceMapConsumer(JSON.parse(fs.readFileSync(path.join(assets, mapFile), 'utf8')))
const jsName = mapFile.replace(/\.map$/, '')

function group(src) {
  if (!src) return null
  src = src.replace(/\\/g, '/')
  let m
  if ((m = /@vue\/(runtime-core|reactivity|runtime-dom|shared)\//.exec(src))) return 'vue:' + m[1]
  if ((m = /reka-ui\/dist\/(.+?)\.js$/.exec(src))) return 'reka:' + m[1]
  if ((m = /@vueuse\/([^/]+)\//.exec(src))) return 'vueuse:' + m[1]
  if ((m = /@floating-ui\/([^/]+)\//.exec(src))) return 'floating-ui:' + m[1]
  if ((m = /frappe-ui\/src\/(.+)$/.exec(src))) return 'fui:' + m[1].replace(/\?.*$/, '')
  if (/(^|\/)src\/(main\.js|MiniInput\.vue)/.test(src)) return 'bench (B.mount: Vue mount/patch with no component frame on stack)'
  return 'other:' + src.split('node_modules/').pop()
}
const OWNER = (g) => g && !g.startsWith('vue:') && !g.startsWith('native')

const cache = new Map()
function frameInfo(cf) {
  const key = cf.url + ':' + cf.lineNumber + ':' + cf.columnNumber + ':' + cf.functionName
  if (cache.has(key)) return cache.get(key)
  let info
  if (cf.url && cf.url.endsWith(jsName) && cf.lineNumber >= 0) {
    const o = smc.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber })
    const g = group(o.source) || 'unmapped'
    info = { g, fn: `${cf.functionName || '(anon)'} @${(o.source || '?').split('/').slice(-1)[0]}:${o.line}` }
  } else if (['(program)', '(idle)', '(garbage collector)', '(root)'].includes(cf.functionName)) {
    info = { g: 'native:' + cf.functionName, fn: cf.functionName }
  } else {
    info = { g: 'native:builtin/dom', fn: (cf.functionName || '(anon)') + (cf.url ? ' ' + cf.url.split('/').pop() : '') }
  }
  cache.set(key, info)
  return info
}

const self = {}, incl = {}, fself = {}, fincl = {}, owner = {}
let total = 0, nprof = 0
for (const f of files) {
  const prof = JSON.parse(fs.readFileSync(f, 'utf8'))
  nprof++
  const byId = new Map(prof.nodes.map((n) => [n.id, n]))
  const parent = new Map()
  for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id)
  // the mount window: samples whose stack contains B.mount's call (bench `mount`) or a rAF/microtask
  // continuation of it. Simplest robust choice: drop (idle) and (program) outside JS and count the rest.
  for (let i = 0; i < prof.samples.length; i++) {
    const dt = (prof.timeDeltas[i + 1] ?? prof.timeDeltas[i]) / 1000 // ms
    const leaf = byId.get(prof.samples[i])
    const li = frameInfo(leaf.callFrame)
    if (li.g === 'native:(idle)') continue
    total += dt
    self[li.g] = (self[li.g] || 0) + dt
    fself[li.g + ' | ' + li.fn] = (fself[li.g + ' | ' + li.fn] || 0) + dt
    const seenG = new Set(), seenF = new Set()
    let own = null
    for (let id = leaf.id; id != null; id = parent.get(id)) {
      const fi = frameInfo(byId.get(id).callFrame)
      if (fi.g === 'native:(root)') continue
      if (!own && OWNER(fi.g)) own = fi.g
      seenG.add(fi.g)
      seenF.add(fi.g + ' | ' + fi.fn)
    }
    for (const g of seenG) incl[g] = (incl[g] || 0) + dt
    for (const k of seenF) fincl[k] = (fincl[k] || 0) + dt
    const ok = own || (li.g.startsWith('vue:') ? 'vue (no owner)' : li.g)
    owner[ok] = (owner[ok] || 0) + dt
  }
}
const per = (x) => (x / nprof).toFixed(2)
const pct = (x) => ((100 * x) / total).toFixed(1) + '%'
const table = (title, obj, n, extra) => {
  const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
  let s = `\n### ${title}\n\n| | ms per 100-mount (mean of ${nprof}) | share |\n|---|---:|---:|\n`
  for (const [k, v] of rows) s += `| ${k.replace(/\|/g, '\\|').replace(/\\\| /, '| ')} | ${per(v)} | ${pct(v)} |\n`
  return s
}
let out = `## CPU profile attribution: ${tag}, mount 100 Desk-like closed Comboboxes\n\nProfiles: ${files.map((f) => path.basename(f)).join(', ')}\n\nNon-idle sampled time: ${per(total)} ms per run (50 us sampling).\n`
out += table('Self time by source group', self, 40)
out += table('Nearest owner (Vue machinery charged to the innermost frappe-ui/reka/vueuse/bench frame)', owner, 40)
out += table('Inclusive time by source group', incl, 40)
out += table('Self time by function (top 50)', fself, 50)
out += table('Inclusive time by function (top 70)', fincl, 70)
const libOnly = Object.fromEntries(Object.entries(fincl).filter(([k]) => /^(fui:|reka:|vueuse:|unmapped)/.test(k)))
out += table('Inclusive time by function, frappe-ui / reka / vueuse frames only (top 80)', libOnly, 80)
const fuiOnly = Object.fromEntries(Object.entries(fincl).filter(([k]) => /^(fui:|unmapped)/.test(k)))
out += table('Inclusive time by function, frappe-ui frames only (computeds/watchers show as anon @file:line)', fuiOnly, 60)
process.stdout.write(out)
