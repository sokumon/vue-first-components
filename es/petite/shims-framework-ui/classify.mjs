// Per-level verdicts with the parent harness's rules (errors > identical > differs).
import fs from 'node:fs'
const HERE = '/home/claude/vue-first-components/wc/petite-all/shims-framework-ui'
const R = JSON.parse(fs.readFileSync(HERE + '/raw.json', 'utf8'))
const A = JSON.parse(fs.readFileSync(HERE + '/../analysis.json', 'utf8')).filter(r => r.file.startsWith('frappe/'))
const levels = ['L0-none', 'L1-template-text', 'L2-instance-globals', 'L3-builtins', 'L4-lenient-scope']
const out = { levels: {}, rows: [] }
for (const L of levels) out.levels[L] = { identical: 0, identical_nonvacuous: 0, differs: 0, errors: 0, harness: 0, identicalFiles: [] }
for (const a of A) {
  const r = R[a.idx], row = { file: a.file, verdicts: {} }
  for (const L of levels) {
    const v = r?.levels?.[L]
    let verdict
    if (!r || r.harnessError || !v) verdict = 'harness_error'
    else {
      const errs = v.errors.filter(e => !e.startsWith('unhandledrejection'))
      if (v.mounted === false || errs.length) verdict = 'errors'
      else if (v.identical && v.propChange?.identical !== false && v.click?.identical !== false) verdict = 'identical'
      else verdict = 'differs'
      row.errors ||= {}; if (errs.length) row.errors[L] = [...new Set(errs.map(e => e.replace(/\s+in expression:[\s\S]*/, '').slice(0, 140)))].slice(0, 4)
      if (!v.identical) (row.diff ||= {})[L] = v.diffCtx
    }
    row.verdicts[L] = verdict
    const s = out.levels[L]
    if (verdict === 'identical') { s.identical++; s.identicalFiles.push(a.file.split('/').pop() + (r.ref.len === 0 ? ' (vacuous: ref renders nothing)' : '')); if (r.ref.len > 0) s.identical_nonvacuous++ }
    else if (verdict === 'differs') s.differs++; else if (verdict === 'errors') s.errors++; else s.harness++
  }
  row.refLen = r?.ref?.len
  out.rows.push(row)
}
fs.writeFileSync(HERE + '/results.json', JSON.stringify(out, null, 1))
for (const [L, s] of Object.entries(out.levels)) console.log(L, JSON.stringify({ ...s, identicalFiles: undefined }), '\n   ', s.identicalFiles.join(', '))
