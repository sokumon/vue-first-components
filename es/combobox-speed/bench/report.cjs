// Markdown tables from raw/*.json.  node report.cjs <rawDir> <tagA> [tagB ...]
// tags are build names without the -mode suffix (npm, clone, ...): reads <tag>-prod-timing.json,
// <tag>-prod-memory.json, <tag>-count-counts.json when present.
const fs = require('fs')
const path = require('path')
const [rawDir, ...tags] = process.argv.slice(2)
const load = (f) => { const p = path.join(rawDir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null }
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const f1 = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2))
const stat = (arr) => (arr && arr.length ? `${f1(median(arr))} [${f1(Math.min(...arr))}–${f1(Math.max(...arr))}]` : '–')

const T = Object.fromEntries(tags.map((t) => [t, load(`${t}-prod-timing.json`)]))
const M = Object.fromEntries(tags.map((t) => [t, load(`${t}-prod-memory.json`)]))
const C = Object.fromEntries(tags.map((t) => [t, load(`${t}-count-counts.json`)]))
let out = ''
const runs = (t) => T[t]?.meta.runs
out += `Runs per cell: ${tags.map((t) => `${t}=${runs(t)}`).join(', ')}. Cells: median [min–max] in ms.\n`
out += `\`js\` = in-page time from the state change through Vue's scheduler flush (sync + nextTick): the scripting cost. \`painted\` = until 2 rAFs after (frame-quantized, ~16.7 ms steps). \`task\` = CDP Performance TaskDuration delta: all main-thread work in the step incl. style/layout/paint.\n`

function timingTable(title, keys, per) {
  out += `\n### ${title}\n\n| scenario | ${tags.map((t) => `${t} js | ${t} painted | ${t} task`).join(' | ')}${per ? ' | ' + tags.map((t) => `${t} js per control`).join(' | ') : ''} |\n|---|${tags.map(() => '---:|---:|---:').join('|')}|${per ? tags.map(() => '---:').join('|') + '|' : ''}\n`
  for (const [k, n] of keys) {
    const cells = tags.map((t) => {
      const r = T[t]?.data[k]
      if (!r) return '– | – | –'
      return `${stat(r.map((x) => x.tick))} | ${stat(r.map((x) => x.painted))} | ${stat(r.map((x) => x.cdpTask))}`
    })
    const perc = per ? ' | ' + tags.map((t) => { const r = T[t]?.data[k]; return r && n ? f1(median(r.map((x) => x.tick)) / n) : '–' }).join(' | ') : ''
    out += `| ${k} | ${cells.join(' | ')}${perc} |\n`
  }
}
const mountKeys = []
for (const temp of ['cold', 'warm']) for (const [base, n] of [['mount_1_desk', 1], ['mount_25_desk', 25], ['mount_100_desk', 100], ['mount_300_desk', 300], ['mount_1_opts20', 1], ['mount_25_opts20', 25], ['mount_100_opts20', 100], ['mount_300_opts20', 300], ['ref_100_input', 100], ['ref_300_input', 300], ['ref_100_mini', 100], ['ref_300_mini', 300]]) mountKeys.push([`${base}:${temp}`, n])
timingTable('Mount (cold = first mount in a fresh page; warm = 4th mount in the same page)', mountKeys, true)
timingTable('Unmount (warm)', [['unmount_100_desk:warm', 100], ['unmount_100_opts20:warm', 100], ['unmount_ref_100_input:warm', 100], ['unmount_ref_100_mini:warm', 100]], true)
timingTable('Open / close (25 Desk-like mounted; 20 options set on #0 while closed, then open by prop)', [['options20_arrive_closed'], ['first_open_opts20'], ['first_close_opts20'], ['second_open_opts20'], ['open_other_opts20'], ['open_filterable_20'], ['open_filterable_500']], false)
timingTable('Prop updates on 100 mounted closed Desk-like Comboboxes (one tick)', [['update100_query', 100], ['update100_options20', 100], ['update100_query_again', 100], ['update100_placeholder', 100], ['update1_query', 1], ['update1_options20', 1], ['ref_mini_update100_query', 100]], true)

// typing
out += `\n### Typing "Customer 001" into one open filterable Combobox (per keystroke; median of the per-run medians [min–max of per-run medians]; max = slowest single keystroke over all runs)\n\n| options | ${tags.map((t) => `${t} js/key | ${t} painted/key | ${t} max js`).join(' | ')} | rows after |\n|---|${tags.map(() => '---:|---:|---:').join('|')}|---:|\n`
for (const n of [20, 500]) {
  const k = `type_${n}`
  const cells = tags.map((t) => {
    const r = T[t]?.data[k]
    if (!r) return '– | – | –'
    const js = r.map((x) => median(x.keys.map((y) => y.tick)))
    const pa = r.map((x) => median(x.keys.map((y) => y.painted)))
    const mx = Math.max(...r.flatMap((x) => x.keys.map((y) => y.tick)))
    return `${stat(js)} | ${stat(pa)} | ${f1(mx)}`
  })
  const rows = T[tags[0]]?.data[k]?.[0].keys.map((y) => y.rows).join('→')
  out += `| ${n} | ${cells.join(' | ')} | ${rows} |\n`
}

// counts
out += `\n### Per closed Combobox (count build: @vue/reactivity constructors instrumented; one cell's subtree, BenchCell wrapper excluded)\n\n| per control | ${tags.map((t) => t).join(' | ')} |\n|---|${tags.map(() => '---:').join('|')}|\n`
const countRow = (label, fn) => { out += `| ${label} | ${tags.map((t) => { try { return fn(t) } catch { return '–' } }).join(' | ')} |\n` }
const sumFx = (tree, k) => tree.slice(1).reduce((a, n) => a + (n.fx[k] || 0), 0)
for (const variant of ['desk', 'opts20']) {
  countRow(`**${variant}** component instances`, (t) => C[t].data[variant].tree.length - 1)
  for (const k of ['effect', 'watch', 'computed', 'ref', 'objectRef', 'customRef', 'proxy', 'dep', 'scope'])
    countRow(`${variant} ${k === 'effect' ? 'ReactiveEffects (render + watch)' : k === 'scope' ? 'EffectScopes (non-instance)' : k}`, (t) => sumFx(C[t].data[variant].tree, k))
  countRow(`${variant} DOM nodes in the control (el/text/comment)`, (t) => { const d = C[t].data[variant].dom; return `${d.all - 1} (${d.el - 1}/${d.text}/${d.comment})` })
}
countRow('**mini** reference instances / effects / computeds / DOM nodes', (t) => { const c = C[t].data.mini; return `${c.tree.length - 1} / ${sumFx(c.tree, 'effect')} / ${sumFx(c.tree, 'computed')} / ${c.dom.all - 1}` })
countRow('open (20 options): instances', (t) => C[t].data.desk_open1.tree.length - 1)

// memory
out += `\n### Memory and listeners per control (100 mounted, CDP after 2x GC; median [min–max] of ${M[tags[0]]?.meta.runs} runs)\n\n| per control | ${tags.map((t) => t).join(' | ')} |\n|---|${tags.map(() => '---:').join('|')}|\n`
for (const [label, kind] of [['Combobox desk', 'desk'], ['Combobox opts20', 'opts20'], ['mini Vue input', 'mini'], ['plain <input>', 'input']]) {
  for (const [m, name] of [['heapPerKB', 'JS heap KB'], ['domNodesPer', 'DOM nodes (Blink counter)'], ['jsListenersPer', 'JS event listeners (Blink counter)']])
    countRow(`${label}: ${name}`, (t) => stat(M[t].data[kind].map((x) => x[m])))
  countRow(`${label}: listeners on one control's subtree`, (t) => { const l = M[t].data[kind][0].cellListeners; const c = {}; for (const x of l) c[x] = (c[x] || 0) + 1; return `${l.length}: ` + Object.entries(c).map(([k, v]) => `${k}×${v}`).join(' ') })
}
countRow('document listeners after 100 Comboboxes', (t) => M[t].data.desk[0].docListeners.length + ': ' + [...new Set(M[t].data.desk[0].docListeners)].join(' '))
countRow('window listeners after 100 Comboboxes', (t) => M[t].data.desk[0].winListeners.length + ': ' + [...new Set(M[t].data.desk[0].winListeners)].join(' '))
// dev-mode per-component split
for (const t of tags) {
  const D = load(`${t}-dev-dev.json`)
  if (!D) continue
  const names = Object.keys(D.data[0].measures)
  const rows = names.map((n) => {
    const g = (k) => median(D.data.map((r) => r.measures[n]?.[k] || 0))
    return { n, mounts: g('mounts'), init: g('init'), render: g('render'), renders: g('renders'), self: g('mountSelf'), incl: g('mountIncl') }
  }).sort((a, b) => b.self - a.self)
  const tot = rows.reduce((a, r) => a + r.self, 0)
  out += `\n### ${t}: per-component split of mounting 100 Desk-like Comboboxes (Vue DEV build, app.config.performance; median of ${D.data.length} runs; dev mode is ~1.7x slower than prod, use the shares)\n\nmountSelf = the component's own 'mount' measure minus nested child mounts (includes its setup and first render). renders > mounts means it re-rendered right after mounting.\n\n| component | instances | setup ms | render ms | renders | mountSelf ms | share | mount incl. children ms |\n|---|---:|---:|---:|---:|---:|---:|---:|\n`
  for (const r of rows) out += `| ${r.n} | ${r.mounts} | ${f1(r.init)} | ${f1(r.render)} | ${r.renders} | ${f1(r.self)} | ${((100 * r.self) / tot).toFixed(1)}% | ${f1(r.incl)} |\n`
  out += `| sync mount / js / painted | | | | | ${stat(D.data.map((r) => r.timing.sync))} / ${stat(D.data.map((r) => r.timing.tick))} / ${stat(D.data.map((r) => r.timing.painted))} | | |\n`
}
process.stdout.write(out)
