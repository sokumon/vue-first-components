// node compare.cjs <rawDir> tagA tagB ...  -> compact js-median table + counts/memory
const fs = require('fs'), path = require('path')
const [dir, ...tags] = process.argv.slice(2)
const load = (f) => { const p = path.join(dir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : null }
const med = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const f = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2))
const st = (a) => `${f(med(a))} [${f(Math.min(...a))}–${f(Math.max(...a))}]`
const T = tags.map((t) => load(`${t}-prod-timing.json`)), M = tags.map((t) => load(`${t}-prod-memory.json`)), C = tags.map((t) => load(`${t}-count-counts.json`)), R = tags.map((t) => load(`${t}-dev-rerenders.json`))
const keys = ['mount_1_desk:cold', 'mount_25_desk:cold', 'mount_100_desk:cold', 'mount_100_desk:warm', 'mount_300_desk:cold', 'mount_300_desk:warm', 'mount_100_opts20:cold', 'mount_300_opts20:warm', 'unmount_100_desk:warm', 'options20_arrive_closed', 'first_open_opts20', 'first_close_opts20', 'second_open_opts20', 'open_other_opts20', 'open_filterable_20', 'open_filterable_500', 'update100_query', 'update100_options20', 'update100_query_again', 'update100_placeholder', 'update1_query', 'update1_options20']
let o = `| scenario (js ms) | ${tags.join(' | ')} |\n|---|${tags.map(() => '---:').join('|')}|\n`
for (const k of keys) o += `| ${k} | ${T.map((t) => (t && t.data[k] ? st(t.data[k].map((x) => x.tick)) : '–')).join(' | ')} |\n`
for (const n of [20, 500]) o += `| type_${n} per key (median of run medians) | ${T.map((t) => { const r = t && t.data['type_' + n]; return r ? st(r.map((x) => med(x.keys.map((k) => k.tick)))) : '–' }).join(' | ')} |\n`
o += `\n| per closed control | ${tags.join(' | ')} |\n|---|${tags.map(() => '---:').join('|')}|\n`
const tot = (c, k) => { if (!c) return '–'; const t = c.data.desk.totalsAllCells; return f((t[k] || 0) / c.data.desk.n) }
o += `| instances | ${C.map((c) => (c ? c.data.desk.tree.length : '–')).join(' | ')} |\n`
for (const k of ['effect', 'watch', 'computed', 'ref', 'objectRef', 'customRef', 'dep']) o += `| ${k} | ${C.map((c) => tot(c, k)).join(' | ')} |\n`
o += `| instances open (20 opts) | ${C.map((c) => (c ? c.data.desk_open1.tree.length : '–')).join(' | ')} |\n`
o += `| DOM nodes in control (all/el/text/comment) | ${C.map((c) => (c ? Object.values(c.data.desk.dom).join('/') : '–')).join(' | ')} |\n`
o += `| JS heap KB/control | ${M.map((m) => (m ? st(m.data.desk.map((x) => x.heapPerKB)) : '–')).join(' | ')} |\n`
o += `| Blink DOM nodes/control | ${M.map((m) => (m ? f(med(m.data.desk.map((x) => x.domNodesPer))) : '–')).join(' | ')} |\n`
o += `| JS listeners/control | ${M.map((m) => (m ? f(med(m.data.desk.map((x) => x.jsListenersPer))) : '–')).join(' | ')} |\n`
const rr = (r, ph) => { if (!r) return '–'; const u = r.data[ph].updated; return Object.values(u).reduce((a, b) => a + b, 0) / 10 }
for (const ph of ['mount', 'query', 'placeholder', 'options', 'open', 'close']) o += `| re-renders per control: ${ph} (dev, 10 controls) | ${R.map((r) => rr(r, ph)).join(' | ')} |\n`
console.log(o)
