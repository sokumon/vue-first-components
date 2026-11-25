// jQuery-driven re-run of wc/sweep/display on wc/jq/dist. Usage: . ~/fb/env.sh && node wc/jq/sweep-display/test.cjs [dist-prefix]
// dist-prefix defaults to /dist (the shared build); pass /sweep-display/fix-dist to try a prototype fix.
const { open } = require('../test/lib.cjs')
const fs = require('fs')
const DIST = process.argv[2] || '/dist'
const pageFile = __dirname + '/page-run.html'
fs.writeFileSync(pageFile, fs.readFileSync(__dirname + '/page.html', 'utf8').replace('/dist/es-ui.iife.js', DIST + '/es-ui.iife.js').replace('/dist/es-ui.css', DIST === '/dist' ? '/dist/es-ui.css' : DIST + '/es-wc-spike.css'))
// (a prototype build has its own scoped-style hashes, so it brings its own CSS)

;(async () => {
  const { b, p, errs } = await open()
  p.on('console', (m) => m.type() === 'warning' && errs.push('warning: ' + m.text().slice(0, 240)))
  await p.setViewportSize({ width: 1200, height: 1400 })
  await p.goto('http://jq.test/sweep-display/page-run.html')
  await p.waitForFunction(() => window.__built)
  await p.waitForTimeout(400)
  const results = {}; let fails = 0
  const r = (tag, k, v, info = '') => {
    if (!v) fails++;
    (results[tag] ||= []).push([!!v, k, v ? '' : String(info).slice(0, 300)])
    console.log((v ? 'PASS ' : 'FAIL ') + tag + ' | ' + k + (info !== '' ? '  -> ' + String(info).replace(/\n/g, ' / ').slice(0, 200) : ''))
  }
  const txt = (s) => p.$eval(s, (e) => e.innerText.trim()).catch(() => 'ERR');
  const ev = (fn, a) => p.evaluate(fn, a);
  const state = () => ev(() => JSON.parse(document.getElementById('state').textContent));
  const box = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }).catch(() => null);
  const inside = (inner, outer) => ev(([i, o]) => { const a = document.querySelector(i), c = document.querySelector(o); return !!a && !!c && c.contains(a) }, [inner, outer]);
  const safe = async (tag, name, fn) => { try { await fn() } catch (e) { r(tag, name + ' (threw)', false, e.message.split('\n')[0]) } }

  // ================= original per-element scenarios, now driven by jQuery (page.js) =================
