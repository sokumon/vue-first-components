// Review harness: serves wc/jq at http://jq.test, plus /jquery.js (3.7.1), /bootstrap.js (4.6.2, Desk's),
// /wc-dist/* (per-element base build) and /wc-pe-fix/* (per-element shell 'fix' build).
// BUILD=dist (default) | proto  (proto = wc/jq/sweep-shell/proto/dist-nomin, the 6-fix prototype; read only)
const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright')
const path = require('path'), fs = require('fs')
const JQ = path.join(__dirname, '..')
const ROOTS = {
  '/wc-dist/': path.join(JQ, '../dist'),
  '/wc-pe-fix/': path.join(JQ, '../sweep/shell/fix'),
}
const FILES = {
  '/jquery.js': process.env.HOME + '/fb/frappe-bench/apps/frappe/node_modules/jquery/dist/jquery.min.js',
  '/bootstrap.css': process.env.HOME + '/fb/frappe-bench/apps/frappe/node_modules/bootstrap/dist/css/bootstrap.min.css',
  '/vue.bundle.js': path.join(__dirname, 'desk-build/vendor/vue.bundle.js'), // copy of the bench's built vue.bundle.MHKP3RF3.js
  '/bootstrap.js': process.env.HOME + '/fb/frappe-bench/apps/frappe/node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
}
const PROTO = path.join(JQ, 'sweep-shell/proto/dist-nomin')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
async function open(opts = {}) {
  const b = await chromium.launch(opts.launch || {})
  const p = await b.newPage({ viewport: opts.viewport || { width: 1280, height: 900 } })
  const errs = []
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.type() + ': ' + m.text().slice(0, 300)))
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 300)))
  p.on('dialog', (d) => { errs.push('DIALOG(alert executed): ' + d.message()); d.dismiss() })
  await p.route((u) => !u.href.startsWith('http://jq.test/') && !u.href.startsWith('data:') && !u.href.startsWith('blob:'), (r) => r.fulfill({ status: 204, body: '' }))
  await p.route('http://jq.test/**', async (route) => {
    const u = new URL(route.request().url())
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
    let f = FILES[u.pathname]
    if (!f) for (const [pre, dir] of Object.entries(ROOTS)) if (u.pathname.startsWith(pre)) f = path.join(dir, u.pathname.slice(pre.length))
    if (!f) {
      if (process.env.BUILD === 'proto' && u.pathname === '/dist/es-ui.iife.js') f = PROTO + '/es-ui.iife.js'
      else if (process.env.BUILD === 'proto' && (u.pathname === '/dist/es-ui.css' || u.pathname === '/dist/es-ui.scoped.css')) f = PROTO + '/es-wc-spike.css'
      else f = path.join(JQ, u.pathname)
    }
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' })
    route.fulfill({ status: 200, contentType: types[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) })
  })
  return { b, p, errs }
}
// run(name, page, async ({p, r, ev, errs}) => ...) ; writes results-<name>[-proto].json
async function run(name, page, fn, opts = {}) {
  const { b, p, errs } = await open(opts)
  const results = []
  const tag = process.env.BUILD === 'proto' ? '-proto' : ''
  const r = (k, ok, info) => {
    results.push({ k, ok: !!ok, info })
    console.log((ok ? 'PASS ' : 'FAIL ') + k + (info !== undefined ? ' :: ' + JSON.stringify(info).slice(0, 400) : ''))
  }
  const ev = (f, a) => p.evaluate(f, a)
  try {
    await p.goto('http://jq.test/review/pages/' + page)
    await p.waitForFunction(() => window.jQuery && (window.ES || window.NOES), null, { timeout: 15000 })
    await fn({ p, r, ev, errs })
  } catch (e) { r('harness exception', false, e.message.slice(0, 400)) }
  console.log('console/page errors: ' + errs.length); errs.slice(0, 30).forEach((e) => console.log('  ' + e))
  await b.close()
  const fails = results.filter((x) => !x.ok).length
  console.log(fails ? fails + ' FAILED of ' + results.length : 'ALL PASS (' + results.length + ')')
  fs.writeFileSync(path.join(__dirname, 'results-' + name + tag + '.json'), JSON.stringify({ name, fails, n: results.length, results, errs }, null, 1))
}
module.exports = { open, run }
