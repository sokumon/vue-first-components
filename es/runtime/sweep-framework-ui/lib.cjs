// jQuery-driven re-run of wc/sweep/framework-ui on wc/jq/dist.
// Serves wc/jq over http://jq.test with the Frappe backend mocks of wc/sweep/framework-ui
// (META / USERS / getdoctype / search_link) plus per-suite api(). /files/* comes from that sweep's fixtures.
// PROTO=1 serves sweep-framework-ui/proto/dist/es-ui.iife.js instead of dist (wc/jq/dist is never touched).
const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright')
const path = require('path'), fs = require('fs')
const JQ = path.join(__dirname, '..')
const FWSWEEP = path.join(__dirname, '../../sweep/framework-ui')
const JQUERY = process.env.HOME + '/fb/frappe-bench/apps/frappe/node_modules/jquery/dist/jquery.min.js'
const { META } = require(FWSWEEP + '/lib.cjs') // reuse the ToDo meta
const USERS = [
  { value: 'ada@example.com', label: 'Ada Lovelace', description: 'ada@example.com' },
  { value: 'grace@example.com', label: 'Grace Hopper', description: 'grace@example.com' },
  { value: 'linus@example.com', label: 'Linus T', description: 'linus@example.com' },
]
function defaultApi(method, body) { // same as wc/sweep/framework-ui/lib.cjs
  if (method === 'frappe.desk.form.load.getdoctype') return { docs: [META], user_settings: '{}' }
  if (method === 'frappe.desk.search.search_link') {
    const q = (body && (body.txt || '')).toLowerCase()
    return USERS.filter((u) => !q || u.value.includes(q) || u.label.toLowerCase().includes(q))
  }
  return undefined
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain', '.png': 'image/png' }
module.exports = async function run(page, fn, opts = {}) {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: opts.viewport || { width: 1280, height: 900 } })
  const errs = [], calls = []
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.type() + ': ' + m.text().slice(0, 300)))
  p.on('pageerror', (e) => { errs.push('pageerror: ' + e.message.slice(0, 300)); if (process.env.STACK) console.log('  [pageerror]', (e.stack || '').slice(0, 900)) })
  p.on('response', (res) => res.status() >= 400 && errs.push('http ' + res.status() + ' ' + res.url().slice(0, 120)))
  await p.route((u) => !u.href.startsWith('http://jq.test/') && !u.href.startsWith('data:') && !u.href.startsWith('blob:'), (r) => r.fulfill({ status: 204, body: '' }))
  const proto = process.env.PROTO && path.join(__dirname, 'proto', process.env.PROTO === '1' ? 'dist' : process.env.PROTO)
  await p.route('http://jq.test/**', async (route) => {
    const req = route.request(), u = new URL(req.url())
    if (u.pathname.startsWith('/api/')) {
      let body = null; try { body = req.postDataJSON() } catch { body = req.postData() }
      if (!body || typeof body !== 'object') body = Object.fromEntries(u.searchParams)
      const method = u.pathname.replace(/^\/api\/method\//, '')
      calls.push({ method, body, verb: req.method() })
      let res = opts.api ? await opts.api(method, body, req) : undefined
      if (res === undefined) res = defaultApi(method, body)
      if (res === undefined) { errs.push('unmocked api: ' + method); return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ exc_type: 'DoesNotExistError', exception: 'unmocked ' + method }) }) }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: res }) })
    }
    let f
    if (u.pathname === '/jquery.js') f = JQUERY
    else if (u.pathname.startsWith('/files/')) f = path.join(FWSWEEP, 'pages', u.pathname)
    else if (proto && u.pathname.startsWith('/dist/') && fs.existsSync(path.join(proto, u.pathname.slice(6)))) f = path.join(proto, u.pathname.slice(6))
    else f = path.join(JQ, u.pathname)
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: 'nf' })
    route.fulfill({ status: 200, contentType: types[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) })
  })
  let fails = 0, n = 0
  const results = []
  const r = (tag, k, v, extra) => {
    n++; if (!v) fails++
    const x = extra === undefined ? undefined : String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300)
    results.push({ tag, k, ok: !!v, extra: x })
    console.log((v ? 'PASS ' : 'FAIL ') + tag + ' | ' + k + (x !== undefined ? ' :: ' + x.replace(/\n/g, ' / ').slice(0, 240) : ''))
  }
  const txt = (s) => p.$eval(s, (e) => e.innerText.trim().replace(/\s+/g, ' ')).catch(() => 'ERR')
  const st = () => p.evaluate(() => JSON.parse(JSON.stringify(window.S)))
  const ev = (f, a) => p.evaluate(f, a)
  const W = (ms = 150) => p.waitForTimeout(ms)
  const vis = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') }).catch(() => false)
  const real = (e) => (e.startsWith('pageerror') || e.startsWith('error')) && !/Failed to load resource/.test(e)
  const pageErrs = (from = 0) => errs.slice(from).filter(real)
  const mark = () => errs.length
  const safe = async (tag, name, f) => { try { await f() } catch (e) { const at = (e.stack.match(/t-[a-z]+\.cjs:(\d+)/) || [])[1]; r(tag, name + ' (threw)', false, e.message.split('\n')[0] + ' @line ' + at) } }
  p.setDefaultTimeout(5000)
  try {
    await p.goto('http://jq.test/sweep-framework-ui/pages/' + page)
    await p.waitForFunction(() => window.ES && window.jQuery && window.S && window.READY, null, { timeout: 10000 })
    await W(opts.wait || 800)
    await fn({ p, r, txt, st, ev, W, vis, safe, calls, errs, pageErrs, mark })
  } catch (e) { fails++; console.log('FAIL exception', e.message.slice(0, 400)); results.push({ tag: 'harness', k: 'exception', ok: false, extra: e.message.slice(0, 300) }) }
  const tag = (process.env.PROTO ? 'proto-' : '') + page.replace('.html', '')
  await p.screenshot({ path: __dirname + '/shot-' + tag + '.png', fullPage: true }).catch(() => {})
  console.log('console errors/warnings:', errs.length); errs.slice(0, 30).forEach((e) => console.log('  ' + e))
  await b.close()
  console.log(fails ? fails + ' FAILED of ' + n : 'ALL PASS (' + n + ')')
  fs.writeFileSync(__dirname + '/results-' + tag + '.json', JSON.stringify({ page, fails, n, results, errs }, null, 1))
  process.exitCode = fails ? 1 : 0
}
