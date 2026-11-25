// Drives the harness page: one fresh page load per component, one browser.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/claude/fb/pw/node_modules/playwright')
const HERE = '/home/claude/vue-first-components/wc/petite-all'
const rows = JSON.parse(fs.readFileSync(HERE + '/analysis.json', 'utf8'))
const OUT = HERE + '/raw-results.json'
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null
const prev = fs.existsSync(OUT) && !only ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
const results = only && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : prev
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext()
let page = await ctx.newPage()
try {
  const transient = x => !x || x.harnessError || (x.ref?.mounted === false && /Failed to fetch dynamically imported module/.test(x.ref.errors?.[0] || ''))
  for (const r of rows) {
    if (only && !only.includes(r.idx)) continue
    if (!only && results[r.idx] && !transient(results[r.idx])) continue
    for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now()
    let res
    try {
      await page.goto('http://127.0.0.1:5291/index.html', { waitUntil: 'load', timeout: 60000 })
      await page.waitForFunction('window.harnessReady === true', null, { timeout: 60000 })
      res = await Promise.race([
        page.evaluate(i => window.runOne(i), r.idx),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 30s')), 30000)),
      ])
    } catch (e) {
      let phase = '?'
      try { phase = await Promise.race([page.evaluate(() => window.__phase), new Promise(r => setTimeout(() => r('page blocked (sync loop)'), 3000))]) } catch {}
      res = { idx: r.idx, file: r.file, harnessError: String(e.message || e).slice(0, 500), phase }
      try { await page.close() } catch {}
      page = await ctx.newPage()
    }
    res.ms = Date.now() - t0
    res.attempt = attempt + 1
    results[r.idx] = res
    if (!transient(res)) break
    }
    console.log(r.idx, r.file, res.harnessError ? 'HARNESS-ERR ' + res.harnessError.slice(0, 120) : `ref=${res.ref?.mounted} pv=${res.pv?.mounted ?? res.pv?.skipped} same=${res.identical} pvErr=${res.pv?.errors?.length}`, res.ms + 'ms')
    if (r.idx % 10 === 0) fs.writeFileSync(OUT, JSON.stringify(results))
  }
} finally {
  fs.writeFileSync(OUT, JSON.stringify(results))
  await browser.close()
}
