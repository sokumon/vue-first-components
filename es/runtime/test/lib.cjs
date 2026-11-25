// Serves wc/jq over a fake origin (http://jq.test) so /api/* can be mocked like a Frappe backend.
const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright')
const path = require('path'), fs = require('fs')
const JQ = path.join(__dirname, '..')
const WCDIST = path.join(__dirname, '../../dist') // the per-element build, for timing comparison only
const JQUERY = process.env.HOME + '/fb/frappe-bench/apps/frappe/node_modules/jquery/dist/jquery.min.js'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }
async function open(opts = {}) {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 300)))
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 300)))
  await p.route((u) => !u.href.startsWith('http://jq.test/') && !u.href.startsWith('data:') && !u.href.startsWith('blob:'), (r) => r.fulfill({ status: 204, body: '' }))
  await p.route('http://jq.test/**', async (route) => {
    const req = route.request(), u = new URL(req.url())
    if (u.pathname.startsWith('/api/')) {
      let body = null; try { body = req.postDataJSON() } catch { body = req.postData() }
      if (!body || typeof body !== 'object') body = Object.fromEntries(u.searchParams)
      const method = u.pathname.replace(/^\/api\/method\//, '')
      const res = opts.api ? await opts.api(method, body) : undefined
      if (res === undefined) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ exception: 'unmocked ' + method }) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: res }) })
    }
    const f = u.pathname === '/jquery.js' ? JQUERY : u.pathname.startsWith('/wc-dist/') ? path.join(WCDIST, u.pathname.slice(9)) : path.join(JQ, u.pathname)
    if (!(f.startsWith(JQ) || f.startsWith(WCDIST) || f === JQUERY) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' })
    route.fulfill({ status: 200, contentType: types[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) })
  })
  return { b, p, errs }
}
module.exports = { open }
