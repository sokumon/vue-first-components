// Classifies each raw/<label>.json with the same verdict rules as ../classify.mjs
// (errors / runs_with_diff / runs_identical, VACUOUS when ref renders nothing) and
// writes results.json with per-config totals and per-file transitions.
import fs from 'node:fs'
const HERE = '/home/claude/vue-first-components/wc/petite-all/shims-frappe-ui'
const A = JSON.parse(fs.readFileSync(HERE + '/../analysis.json', 'utf8')).filter(a => a.pkg === 'frappe-ui')
const labels = fs.readdirSync(HERE + '/raw').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()
function verdict(a, r) {
  if (!a.template || a.templateLang !== 'html') return 'no_template'
  if (!r || r.harnessError) return 'not_attempted'
  const errs = (r.pv.errors || []).filter(e => !e.startsWith('unhandledrejection'))
  if (r.pv.mounted === false || errs.length) return 'errors'
  const it = r.interaction || {}
  if (r.identical && it.propChange?.identical !== false && it.click?.identical !== false) return 'runs_identical'
  return 'runs_with_diff'
}
const out = { configs: {}, files: {} }
for (const L of labels) {
  const R = JSON.parse(fs.readFileSync(`${HERE}/raw/${L}.json`, 'utf8'))
  const t = { total: 0 }
  const ident = [], vac = []
  for (const a of A) {
    const r = R[a.idx]; const v = verdict(a, r)
    t.total++; t[v] = (t[v] || 0) + 1
    const vacuous = v === 'runs_identical' && (r.ref.len === 0)
    if (v === 'runs_identical') (vacuous ? vac : ident).push(a.file.replace('frappe-ui/src/', ''))
    ;(out.files[a.file] ||= {})[L] = v + (vacuous ? ' (vacuous)' : '') + (v === 'errors' ? ': ' + ((r.pv.errors || [])[0] || '').slice(0, 90) : v === 'runs_with_diff' && !r.identical ? ': ' + (r.diffCtx?.ref || '').slice(40, 120).replace(/\s+/g, ' ') + ' || ' + (r.diffCtx?.pv || '').slice(40, 120).replace(/\s+/g, ' ') : '')
  }
  t.identical_real = ident; t.identical_vacuous = vac
  out.configs[L] = t
}
fs.writeFileSync(HERE + '/results.json', JSON.stringify(out, null, 1))
for (const [L, t] of Object.entries(out.configs)) console.log(L, JSON.stringify({ ...t, identical_real: t.identical_real.length + ' ' + t.identical_real.join(','), identical_vacuous: t.identical_vacuous.length }))
