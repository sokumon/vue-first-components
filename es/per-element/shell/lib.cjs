const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright');
const fs = require('fs'), path = require('path');
// BUILD=build|fix chooses the bundle; the page is copied next to it.
exports.run = async (page, body, opts = {}) => {
  const dir = path.join(__dirname, process.env.BUILD || 'build');
  fs.copyFileSync(path.join(__dirname, 'pages', page), path.join(dir, page));
  fs.copyFileSync(path.join(__dirname, '../../public/petite-vue.iife.js'), path.join(dir, 'petite-vue.iife.js'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: opts.viewport || { width: 1200, height: 900 } });
  const errs = [];
  p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.type() + ': ' + m.text().slice(0, 300)));
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300)));
  let fails = 0; const results = [];
  const r = (k, v, info = '') => { if (!v) fails++; results.push({ k, pass: !!v, info: String(info).slice(0, 200) }); console.log((v ? 'PASS ' : 'FAIL ') + k + (info !== '' ? '  :: ' + String(info).replace(/\n/g, ' / ').slice(0, 200) : '')) };
  try {
    await p.goto('file://' + path.join(dir, page)); await p.waitForTimeout(500);
    const H = {
      p, r, wait: (ms = 150) => p.waitForTimeout(ms),
      txt: (s) => p.$eval(s, e => e.innerText.trim()).catch(() => 'ERR'),
      vis: (s) => p.$eval(s, e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') }).catch(() => false),
      rect: (s) => p.$eval(s, e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }).catch(() => null),
      state: () => p.$eval('#state', e => e.innerText.trim()).catch(() => 'ERR'),
      log: () => p.$eval('#log', e => e.innerText.trim()).catch(() => 'ERR'),
      inside: (child, anc) => p.evaluate(([c, a]) => { const x = document.querySelector(c), y = document.querySelector(a); return !!(x && y && y.contains(x)) }, [child, anc]),
    };
    await body(H);
  } catch (e) { fails++; console.log('HARNESS ERROR', e.message.slice(0, 500)) }
  await p.screenshot({ path: path.join(__dirname, 'shot-' + (process.env.BUILD || 'build') + '-' + page.replace('.html', '') + '.png'), fullPage: true }).catch(() => {});
  console.log('console errors/warnings:', errs.length); errs.slice(0, 25).forEach(e => console.log('  ' + e));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  fs.writeFileSync(path.join(__dirname, `results-${process.env.BUILD || 'build'}-${page.replace('.html', '')}.json`), JSON.stringify({ results, errs }, null, 1));
};
