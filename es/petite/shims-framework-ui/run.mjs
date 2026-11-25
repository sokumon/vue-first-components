// One Chromium, one fresh page per framework-ui component; all shim levels compared in that page.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/claude/fb/pw/node_modules/playwright')
const HERE = '/home/claude/vue-first-components/wc/petite-all/shims-framework-ui'
const rows = JSON.parse(fs.readFileSync(HERE + '/../analysis.json', 'utf8')).filter(r => r.file.startsWith('frappe/'))
const OUT = HERE + '/raw.json'
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null
const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext()
let page = await ctx.newPage()
try {
  for (const r of rows) {
    if (only && !only.includes(r.idx)) continue
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now(); let res
      try {
        await page.goto('http://127.0.0.1:5297/index.html', { waitUntil: 'load', timeout: 60000 })
        await page.waitForFunction('window.harnessReady === true', null, { timeout: 60000 })
        res = await Promise.race([page.evaluate(i => window.runOne(i), r.idx), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 45s')), 45000))])
      } catch (e) {
        res = { idx: r.idx, file: r.file, harnessError: String(e.message || e).slice(0, 300) }
        try { await page.close() } catch {}
        page = await ctx.newPage()
      }
      res.ms = Date.now() - t0; results[r.idx] = res
      const transient = res.harnessError || (res.ref?.mounted === false && /dynamically imported/.test(res.ref.errors?.[0] || ''))
      if (!transient) break
    }
    const res = results[r.idx]
    console.log(r.idx, r.file, res.harnessError ? 'ERR ' + res.harnessError : Object.entries(res.levels || {}).map(([k, v]) => `${k.slice(0, 2)}:${v.identical ? 'S' : 'd'}${v.errors.filter(e => !e.startsWith('unhandledrejection')).length}`).join(' '), res.ms + 'ms')
    fs.writeFileSync(OUT, JSON.stringify(results))
  }
} finally { fs.writeFileSync(OUT, JSON.stringify(results)); await browser.close() }
