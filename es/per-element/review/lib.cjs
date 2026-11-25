const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright');
const path = require('path');
// Pages live in sweep/review and load ../../dist (the shared build, untouched).
exports.run = async (page, body, opts = {}) => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, ...(opts.ctx || {}) });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.type() + ': ' + m.text().slice(0, 300)));
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300)));
  let fails = 0;
  const r = (k, v, info = '') => { if (!v) fails++; console.log((v ? 'PASS ' : 'FAIL ') + k + (info !== '' ? '  :: ' + (typeof info === 'string' ? info : JSON.stringify(info)).replace(/\n/g, ' / ').slice(0, 400) : '')) };
  const info = (k, v) => console.log('INFO ' + k + ' :: ' + (typeof v === 'string' ? v : String(JSON.stringify(v))).slice(0, 600));
  try {
    if (page) { await p.goto('file://' + path.join(__dirname, page)); await p.waitForTimeout(opts.wait ?? 500); }
    await body({ p, ctx, b, r, info, errs, wait: (ms = 150) => p.waitForTimeout(ms), txt: (s) => p.$eval(s, e => e.innerText.trim()).catch(() => 'ERR') });
  } catch (e) { fails++; console.log('HARNESS ERROR', e.stack.slice(0, 600)) }
  console.log('console errors/warnings:', errs.length); errs.slice(0, 25).forEach(e => console.log('  ' + e));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
};
