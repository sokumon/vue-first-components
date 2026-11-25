const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright');
const path = require('path');
module.exports = async function run(page, fn) {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.type() + ': ' + m.text().slice(0, 300)));
  p.on('pageerror', e => { errs.push('pageerror: ' + e.message.slice(0, 300)); if (process.env.STACK) console.log('  [pageerror]', e.stack.slice(0, 600)) });
  let fails = 0;
  const r = (k, v, extra) => { if (!v) fails++; console.log((v ? 'PASS ' : 'FAIL ') + k + (extra !== undefined ? ' :: ' + String(extra).replace(/\n/g, ' / ').slice(0, 220) : '')) };
  const txt = s => p.$eval(s, e => e.innerText.trim()).catch(() => 'ERR');
  const st = () => p.evaluate(() => JSON.parse(document.getElementById('state').textContent));
  try {
    await p.goto('file://' + path.join(__dirname, 'pages', page.split('#')[0]) + (page.includes('#') ? '#' + page.split('#')[1] : '')); await p.waitForTimeout(600);
    await fn({ p, r, txt, st });
  } catch (e) { fails++; console.log('FAIL exception', e.message.slice(0, 300)) }
  console.log('console errors/warnings:', errs.length); errs.slice(0, 20).forEach(e => console.log('  ' + e));
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exitCode = fails ? 1 : 0;
};
