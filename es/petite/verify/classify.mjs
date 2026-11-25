// Same verdict rule as ../shims-frappe-ui/compare.mjs, applied to my re-run; plus
// a stricter check: does the template contain a <slot> (fails as soon as a parent
// passes content) or a PascalCase/kebab child component tag (never rendered)?
import fs from 'node:fs'
const A = JSON.parse(fs.readFileSync('../analysis.json', 'utf8')).filter(a => a.pkg === 'frappe-ui')
const prior = JSON.parse(fs.readFileSync('../shims-frappe-ui/results.json', 'utf8'))
function verdict(a, r) {
  if (!a.template || a.templateLang !== 'html') return 'no_template'
  if (!r || r.harnessError) return 'not_attempted'
  const errs = (r.pv.errors || []).filter(e => !e.startsWith('unhandledrejection'))
  if (r.pv.mounted === false || errs.length) return 'errors'
  const it = r.interaction || {}
  if (r.identical && it.propChange?.identical !== false && it.click?.identical !== false) return 'runs_identical'
  return 'runs_with_diff'
}
for (const L of ['c5-aliases', 'c6-setup']) {
  const R = JSON.parse(fs.readFileSync(`sweep-${L}.json`, 'utf8'))
  const t = {}, real = [], vac = []
  for (const a of A) { const r = R[a.idx], v = verdict(a, r); t[v] = (t[v] || 0) + 1
    if (v === 'runs_identical') (r.ref.len === 0 ? vac : real).push(a) }
  const P = prior.configs[L]
  const { identical_real, identical_vacuous, total, ...pc } = P
  console.log(L, 'mine', JSON.stringify(t), '| prior', JSON.stringify(pc))
  const mineSet = new Set(real.map(a => a.file.replace('frappe-ui/src/', '')))
  console.log('  real mine', real.length, 'prior', identical_real.length, 'symdiff', [...mineSet].filter(x => !identical_real.includes(x)), identical_real.filter(x => !mineSet.has(x)))
  for (const a of real) {
    const tpl = a.template, r = R[a.idx]
    const slot = /<slot\b/.test(tpl), child = /<([A-Z][\w.]*|[a-z]+-[a-z-]+)[\s>\/]/.exec(tpl)
    const it = r.interaction || {}
    console.log(`   ${a.file.replace('frappe-ui/src/', '').padEnd(62)} refLen=${String(r.ref.len).padStart(4)} slot=${slot} child=${child ? child[1] : '-'} prop=${it.propChange?.prop || it.propChange?.skipped} click=${it.click?.skipped ? 'none' : it.click?.target}`)
  }
}
