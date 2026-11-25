// Runs one jQuery-driven page from sweep-inputs/pages on wc/jq/dist (served by ../test/lib.cjs as http://jq.test).
const { open } = require('../test/lib.cjs')
const fs = require('fs')
module.exports = async function run(page, fn, opts = {}) {
  const { b, p, errs } = await open(opts)
  if (process.env.PROTO) await p.route('http://jq.test/dist/es-ui.iife.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/proto/dist/es-ui.iife.js') }))
  p.on('console', (m) => m.type() === 'warning' && errs.push('warn: ' + m.text().slice(0, 300)))
  let fails = 0, n = 0
  const results = []
  const r = (k, v, extra) => {
    n++; if (!v) fails++
    results.push({ k, ok: !!v, extra: extra === undefined ? undefined : String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300) })
    console.log((v ? 'PASS ' : 'FAIL ') + k + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).replace(/\n/g, ' / ').slice(0, 240) : ''))
  }
  const txt = (s) => p.$eval(s, (e) => e.innerText.trim()).catch(() => 'ERR')
  const st = () => p.evaluate(() => JSON.parse(JSON.stringify(window.S)))
  const ev = (f, a) => p.evaluate(f, a)
  const W = (ms = 120) => p.waitForTimeout(ms)
  try {
    await p.goto('http://jq.test/sweep-inputs/pages/' + page)
    await p.waitForFunction(() => window.ES && window.jQuery && window.S && window.READY, null, { timeout: 8000 })
    await W(200)
    await fn({ p, r, txt, st, ev, W })
  } catch (e) { fails++; console.log('FAIL exception', e.message.slice(0, 400)); results.push({ k: 'exception', ok: false, extra: e.message.slice(0, 300) }) }
  console.log('console errors/warnings:', errs.length); errs.slice(0, 25).forEach((e) => console.log('  ' + e))
  await b.close()
  console.log(fails ? fails + ' FAILED of ' + n : 'ALL PASS (' + n + ')')
  fs.writeFileSync(__dirname + '/results-' + (process.env.PROTO ? 'proto-' : '') + require('path').basename(process.argv[1], '.cjs').replace(/^t-/, '') + '.json', JSON.stringify({ page, fails, n, results, errs }, null, 1))
  process.exitCode = fails ? 1 : 0
}
