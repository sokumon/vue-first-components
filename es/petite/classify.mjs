// Joins the static analysis (analysis.json) with the browser results
// (raw-results.json) into results.json: one row per component file.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const { isHTMLTag, isSVGTag } = createRequire(import.meta.url)('@vue/shared')
const HERE = '/home/claude/vue-first-components/wc/petite-all'
const A = JSON.parse(fs.readFileSync(HERE + '/analysis.json', 'utf8'))
const R = JSON.parse(fs.readFileSync(HERE + '/raw-results.json', 'utf8'))

const cut = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '')
const list = (a, n = 6) => a.length > n ? a.slice(0, n).join(', ') + ` (+${a.length - n})` : a.join(', ')

const rows = A.map(a => {
  const r = R[a.idx] || null
  const b = [] // blockers, each "category: detail"
  const add = (cat, detail) => b.push(detail ? `${cat}: ${detail}` : cat)
  const s = a.script || {}, t = a.tpl || {}
  if (!a.template) add('no <template> (render function via defineComponent/h)')
  else if (a.templateLang !== 'html') add('template lang=' + a.templateLang)

  if (s.importsReka) add('reka-ui import', list(s.rekaImports))
  const comps = Object.keys(t.componentTags || {})
  if (comps.length) add('child components rendered as unknown tags', list(comps))
  const clash = comps.filter(c => isHTMLTag(c.toLowerCase()) || isSVGTag(c.toLowerCase()))
  if (clash.length) add('component name parsed as native HTML element', list(clash))
  if (t.slotOutlets) add('<slot> outlet', `${t.slotOutlets}`)
  if (t.vSlot) add('v-slot / #slot templates', `${t.vSlot}`)
  for (const m of ['$slots', '$attrs', '$emit', '$props', '$el', '$parent', '$route', '$router', '$t', '$dialog', '$resources', '$socket'])
    if (t.magic?.[m]) add(`${m} in template`, `${t.magic[m]}x`)
  for (const [k, v] of Object.entries(t.builtins || {})) {
    if (k === 'component') add('<component :is>', `${v}`)
    else if (k !== 'slot') add(`<${k[0].toUpperCase() + k.slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase())}>`, `${v}`)
  }
  if (t.vModelOnComponent) add('v-model on component', `${t.vModelOnComponent}`)
  if (t.objectBind) add('v-bind="obj" spread', `${t.objectBind}`)
  if (t.objectOn) add('v-on="obj" spread', `${t.objectOn}`)
  if (t.selfClosingNonVoid) add('self-closing non-void tags re-nested by HTML parser', `${t.selfClosingNonVoid}`)
  if (t.camelCaseBindOnElement) add('camelCase :bindings lowercased by HTML parser', `${t.camelCaseBindOnElement}`)
  if (t.vMemo) add('v-memo', `${t.vMemo}`)

  // script state the template reads that petite cannot have (only props are in scope)
  const scopeKeys = new Set(r?.scopeKeys || Object.keys(r?.propDefs || {}))
  const bnd = a.bindings || {}
  const fromSetup = (bnd.setupRefs || []).filter(x => !scopeKeys.has(x))
  const fromCtx = (bnd.ctxRefs || []).filter(x => !scopeKeys.has(x) && !x.startsWith('$'))
  const fromOpts = [...(bnd.dataRefs || []), ...(bnd.optRefs || [])]
  const pvRefErr = [...new Set((r?.pv?.errors || []).map(e => (e.match(/ReferenceError: (\S+) is not defined/) || [])[1]).filter(Boolean))]
  const missing = [...new Set([...fromSetup, ...fromCtx, ...fromOpts, ...pvRefErr.filter(x => !x.startsWith('$'))])]
  if (missing.length) add('script state missing', list(missing, 8))
  if (s.provideInject) add('provide/inject (context)')
  if (s.emits && a.template) add('emits events (no emit in petite)')
  if (s.defineModel) add('defineModel')
  if ((s.computedWatch || s.lifecycle) && a.template) add('<script> logic not run (computed/watch/lifecycle)')
  if (s.resourceCalls) add('backend/resource calls in script (stubbed in reference)')

  // unhandled rejections can come from reference-side async work finishing late; not attributed to petite
  const pvErrs = (r?.pv?.errors || []).filter(e => !e.startsWith('unhandledrejection'))
  const tsErr = pvErrs.filter(e => /^(Unexpected (identifier|token)|missing \) after)/.test(e))
  if (tsErr.length) add('TypeScript syntax in template expressions (petite uses new Function)', `${tsErr.length}`)
  const other = pvErrs.filter(e => !/ReferenceError: \S+ is not defined/.test(e) && !tsErr.includes(e))
  if (other.length) add('petite runtime errors', cut([...new Set(other.map(e => e.replace(/\s+in expression:[\s\S]*/, '')))].slice(0, 3).join(' | '), 240))
  if ((r?.pv?.html || '').includes('animVal baseVal')) add('petite-vue :class on <svg> writes SVGAnimatedString (petite bug)')
  if (r?.ref && r.ref.teleported) add('Teleport content outside container (reference)', `${r.ref.teleported} node(s)`)
  if (r?.ref && r.ref.mounted === false) add('reference failed to mount', cut(r.ref.errors[0], 160))

  // ---- verdict ----
  let verdict, diff = ''
  if (!a.template || a.templateLang !== 'html') { verdict = 'no_template'; diff = 'nothing for petite-vue to mount: component renders via h()/render function' }
  else if (!r || r.harnessError) { verdict = 'not_attempted'; diff = 'harness error: ' + (r?.harnessError || 'no result') + (r?.phase ? ' (phase ' + r.phase + ')' : '') }
  else {
    const it = r.interaction || {}
    const interErr = false
    const pvFailed = r.pv.mounted === false || pvErrs.length > 0
    if (pvFailed) verdict = 'errors'
    else if (r.identical && it.propChange?.identical !== false && it.click?.identical !== false) verdict = 'runs_identical'
    else verdict = 'runs_with_diff'
    const parts = []
    if (r.identical) {
      parts.push(`first render identical (${r.ref.len} chars)` + (r.ref.len === 0 ? ' [VACUOUS: both render nothing with minimal props]' : '') + (missing.length ? ' [paths reading script state not reached]' : ''))
      if (it.propChange) parts.push(it.propChange.skipped ? `prop change skipped (${it.propChange.skipped})` : `after ${it.propChange.prop} -> ${cut(it.propChange.to, 40)}: ${it.propChange.identical ? 'identical' : 'DIVERGED (ref ' + cut(it.propChange.ref, 120) + ' | petite ' + cut(it.propChange.pv, 120) + ')'}`)
      if (it.click) parts.push(it.click.skipped ? `click skipped (${it.click.skipped})` : `after click on <${it.click.target}>: ${it.click.identical ? 'identical' : 'DIVERGED (ref ' + cut(it.click.ref, 100) + ' | petite ' + cut(it.click.pv, 100) + ')'}`)
      if (it.propChange && it.propChange.identical === false) add('diverges after prop change', it.propChange.prop)
      if (it.click && it.click.identical === false) add('diverges after click')
      if (pvErrs.length) parts.push('identical output despite petite errors')
    } else {
      parts.push(`ref ${r.ref.len} chars vs petite ${r.pv.len} chars; first divergence at ${r.diffAt}: ref «${cut(r.diffCtx?.ref, 140)}» | petite «${cut(r.diffCtx?.pv, 140)}»`)
    }
    if (pvErrs.length) parts.push(`${pvErrs.length} petite console error(s), first: ${cut(pvErrs[0], 140)}`)
    if (r.ref.errors?.length) parts.push(`${r.ref.errors.length} reference error(s), first: ${cut(r.ref.errors[0], 120)}`)
    const unk = Object.keys(r.pv.unknownTags || {})
    if (unk.length) parts.push(`petite DOM unknown tags: ${list(unk, 5)}`)
    diff = parts.join('; ')
  }
  if (a.kind === 'playground') diff = '[playground demo file] ' + diff
  const vacuous = verdict === 'runs_identical' && (r.ref.len === 0 || missing.length > 0)
  return { file: a.file, package: a.pkg, verdict, blockers: b, diff_summary: diff, kind: a.kind, vacuous }
})

const totals = {}
for (const r of rows) {
  totals[r.package] ||= { total: 0 }
  totals[r.package].total++
  totals[r.package][r.verdict] = (totals[r.package][r.verdict] || 0) + 1
}
for (const r of rows) if (r.verdict === 'runs_identical') { const t = totals[r.package]; t.runs_identical_vacuous = (t.runs_identical_vacuous || 0) + (r.vacuous ? 1 : 0) }
const byVerdict = {}
for (const r of rows) byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1
const cat = {}
for (const r of rows) for (const x of new Set(r.blockers.map(y => y.split(': ')[0]))) cat[x] = (cat[x] || 0) + 1
const topBlockers = Object.entries(cat).sort((a, b) => b[1] - a[1])
fs.writeFileSync(HERE + '/results.json', JSON.stringify({ generated: new Date().toISOString(), totals, byVerdict, topBlockers, rows }, null, 1))
console.log(JSON.stringify({ totals, byVerdict }, null, 1))
console.log(topBlockers.map(([k, v]) => `${v}\t${k}`).join('\n'))
