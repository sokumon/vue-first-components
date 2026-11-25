// Harness: serves pages + build over a fake origin (http://fw.test) through
// page.route, so /api/* can be mocked like a Frappe backend.
const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright');
const path = require('path'), fs = require('fs');
const ROOT = __dirname, WC = path.join(__dirname, '../..');
const BUILD = process.env.BUILD || 'build';
const types = { '.md': 'text/markdown', '.txt': 'text/plain', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

// A ToDo-like meta used by every list control.
const META = {
  name: 'ToDo', title_field: 'description',
  fields: [
    { fieldname: 'status', fieldtype: 'Select', label: 'Status', options: 'Open\nClosed\nCancelled', in_list_view: 1, in_standard_filter: 1 },
    { fieldname: 'priority', fieldtype: 'Select', label: 'Priority', options: 'Low\nMedium\nHigh', in_list_view: 1, in_standard_filter: 1 },
    { fieldname: 'date', fieldtype: 'Date', label: 'Due Date', in_list_view: 1 },
    { fieldname: 'allocated_to', fieldtype: 'Link', label: 'Allocated To', options: 'User', in_standard_filter: 1 },
    { fieldname: 'description', fieldtype: 'Text Editor', label: 'Description', reqd: 1 },
    { fieldname: 'hours', fieldtype: 'Float', label: 'Hours' },
    { fieldname: 'done', fieldtype: 'Check', label: 'Done' },
  ],
  permissions: [{ role: 'System Manager', read: 1, write: 1, permlevel: 0 }],
};
const USERS = [
  { value: 'ada@example.com', label: 'Ada Lovelace', description: 'ada@example.com' },
  { value: 'grace@example.com', label: 'Grace Hopper', description: 'grace@example.com' },
  { value: 'linus@example.com', label: 'Linus T', description: 'linus@example.com' },
];
function defaultApi(method, body) {
  if (method === 'frappe.desk.form.load.getdoctype') return { docs: [META], user_settings: '{}' };
  if (method === 'frappe.desk.search.search_link') {
    const q = (body && (body.txt || '')).toLowerCase();
    return USERS.filter((u) => !q || u.value.includes(q) || u.label.toLowerCase().includes(q));
  }
  return undefined;
}

module.exports = async function run(page, fn, opts = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: opts.viewport || { width: 1280, height: 900 } });
  const errs = [], calls = [];
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.type() + ': ' + m.text().slice(0, 300)));
  p.on('response', (res) => res.status() >= 400 && errs.push('http ' + res.status() + ' ' + res.url().slice(0, 120)));
  p.on('pageerror', (e) => { errs.push('pageerror: ' + e.message.slice(0, 300)); if (process.env.STACK) console.log('  [pageerror]', e.stack.slice(0, 800)) });
  await p.route((u) => !u.href.startsWith('http://fw.test/') && !u.href.startsWith('data:') && !u.href.startsWith('blob:'), (route) => route.fulfill({ status: 204, body: '' }));
  await p.route('http://fw.test/**', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) {
      let body = null; try { body = req.postDataJSON() } catch { body = req.postData() }
      if (!body || typeof body !== 'object') body = Object.fromEntries(u.searchParams);
      const method = u.pathname.replace(/^\/api\/method\//, '');
      calls.push({ method, body, verb: req.method() });
      let res = opts.api ? await opts.api(method, body, req) : undefined;
      if (res === undefined) res = defaultApi(method, body);
      if (res && res.__status) return route.fulfill({ status: res.__status, contentType: 'application/json', body: JSON.stringify(res.body) });
      if (res === undefined) { errs.push('unmocked api: ' + method); return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ exc_type: 'DoesNotExistError', exception: 'unmocked ' + method }) }) }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: res }) });
    }
    if (u.pathname === '/petite-vue.iife.js' && BUILD.includes('shared')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* PetiteVue comes from the shared-reactivity bundle */' });
    let f = u.pathname === '/petite-vue.iife.js' ? path.join(WC, 'public/petite-vue.iife.js')
      : u.pathname.startsWith('/build/') ? path.join(ROOT, BUILD, u.pathname.slice(7)) : path.join(ROOT, 'pages', u.pathname);
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, contentType: types[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  let fails = 0; const results = [];
  const r = (k, v, extra) => { if (!v) fails++; results.push({ k, ok: !!v, extra: extra === undefined ? undefined : String(extra).slice(0, 300) }); console.log((v ? 'PASS ' : 'FAIL ') + k + (extra !== undefined ? ' :: ' + String(extra).replace(/\n/g, ' / ').slice(0, 240) : '')) };
  const txt = (s) => p.$eval(s, (e) => e.innerText.trim()).catch(() => 'ERR');
  const st = () => p.evaluate(() => JSON.parse(document.getElementById('state').textContent));
  // Same state after forcing one more petite flush (separates petite's lost-update from real failures).
  const stPoked = async () => { await p.evaluate(() => document.getElementById('poke').click()); await p.waitForTimeout(50); return st() };
  try {
    await p.goto('http://fw.test/' + page); await p.waitForTimeout(opts.wait || 800);
    await fn({ p, r, txt, st, stPoked, calls, errs });
  } catch (e) { fails++; console.log('FAIL exception', e.message.slice(0, 400)) }
  console.log('console errors/warnings:', errs.length); errs.slice(0, 25).forEach((e) => console.log('  ' + e));
  if (opts.shot) await p.screenshot({ path: path.join(ROOT, opts.shot), fullPage: true }).catch(() => {});
  await b.close();
  fs.writeFileSync(path.join(ROOT, 'results-' + page.replace('.html', '') + '.json'), JSON.stringify({ results, errs }, null, 1));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
};
module.exports.META = META;
