// Runs one jQuery-driven page from sweep-shell/pages on wc/jq/dist (served by ../test/lib.cjs as http://jq.test).
// PROTO=1 swaps in sweep-shell/proto/dist/es-ui.iife.js (a prototype fix); wc/jq/dist is never touched.
const { open } = require('../test/lib.cjs')
const fs = require('fs')
module.exports = async function run(page, fn, opts = {}) {
  const { b, p, errs } = await open(opts)
  if (opts.viewport) await p.setViewportSize(opts.viewport)
  if (process.env.PROTO) {
    const d = __dirname + '/proto/' + (process.env.PROTO === '1' ? 'dist' : process.env.PROTO)
    await p.route('http://jq.test/dist/es-ui.iife.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(d + '/es-ui.iife.js') }))
    await p.route('http://jq.test/dist/es-ui.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(d + '/es-wc-spike.css') }))
  }
  p.on('pageerror', (e) => console.log('   !! pageerror: ' + e.message.slice(0, 200) + ' @ ' + (e.stack || '').split('\n').slice(1, process.env.DEEP ? 14 : 4).join(' | ').slice(0, process.env.DEEP ? 3000 : 300)))
  p.on('console', (m) => m.type() === 'warning' && errs.push('warn: ' + m.text().slice(0, 300)))
  let fails = 0, n = 0
  const results = []
  const r = (tag, k, v, extra) => {
    n++; if (!v) fails++
    const x = extra === undefined ? undefined : String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300)
    results.push({ tag, k, ok: !!v, extra: x })
    console.log((v ? 'PASS ' : 'FAIL ') + tag + ' | ' + k + (x !== undefined ? ' :: ' + x.replace(/\n/g, ' / ').slice(0, 240) : ''))
  }
  const txt = (s) => p.$eval(s, (e) => e.innerText.trim()).catch(() => 'ERR')
  const st = () => p.evaluate(() => JSON.parse(JSON.stringify(window.S)))
  const ev = (f, a) => p.evaluate(f, a)
  p.setDefaultTimeout(4000)
  const W = (ms = 150) => p.waitForTimeout(ms)
  const vis = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') }).catch(() => false)
  const rect = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }).catch(() => null)
  const inside = (c, a) => p.evaluate(([c, a]) => { const x = document.querySelector(c), y = document.querySelector(a); return !!(x && y && y.contains(x)) }, [c, a])
  const log = () => p.evaluate(() => window.S.log.join(','))
  const errCount = () => errs.length
  const safe = async (tag, name, f) => { try { await f() } catch (e) { r(tag, name + ' (threw)', false, e.message.split('\n')[0]) } }
  try {
    await p.goto('http://jq.test/sweep-shell/pages/' + page)
    await p.waitForFunction(() => window.ES && window.jQuery && window.S && window.READY, null, { timeout: 8000 })
    await W(300)
    await fn({ p, r, txt, st, ev, W, vis, rect, inside, log, safe, errs, errCount })
  } catch (e) { fails++; console.log('FAIL exception', e.message.slice(0, 400)); results.push({ tag: 'harness', k: 'exception', ok: false, extra: e.message.slice(0, 300) }) }
  await p.screenshot({ path: __dirname + '/shot-' + (process.env.PROTO ? 'proto-' : '') + page.replace('.html', '') + '.png', fullPage: true }).catch(() => {})
  console.log('console errors/warnings:', errs.length); errs.slice(0, 25).forEach((e) => console.log('  ' + e))
  await b.close()
  console.log(fails ? fails + ' FAILED of ' + n : 'ALL PASS (' + n + ')')
  fs.writeFileSync(__dirname + '/results-' + (process.env.PROTO ? 'proto-' : '') + page.replace(/\.html.*/, '') + '.json', JSON.stringify({ page, fails, n, results, errs }, null, 1))
  process.exitCode = fails ? 1 : 0
}
