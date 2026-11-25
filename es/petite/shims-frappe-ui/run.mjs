// node run.mjs <label> <shim,list|-> [idx,...]  -> raw/<label>.json ; frappe-ui rows only, 1 browser
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/claude/fb/pw/node_modules/playwright')
const HERE = '/home/claude/vue-first-components/wc/petite-all/shims-frappe-ui'
const rows = JSON.parse(fs.readFileSync(HERE + '/../analysis.json', 'utf8')).filter(r => r.pkg === 'frappe-ui')
const [label, shimArg, onlyArg] = process.argv.slice(2)
const shims = shimArg && shimArg !== '-' ? shimArg : ''
const only = onlyArg ? onlyArg.split(',').map(Number) : null
fs.mkdirSync(HERE + '/raw', { recursive: true })
const OUT = `${HERE}/raw/${label}.json`
const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const ctx = await browser.newContext()
let page = await ctx.newPage()
const transient = x => !x || x.harnessError || (x.ref?.mounted === false && /Failed to fetch dynamically imported module/.test(x.ref.errors?.[0] || ''))
try {
  for (const r of rows) {
    if (only ? !only.includes(r.idx) : (results[r.idx] && !transient(results[r.idx]))) continue
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now(); let res
      try {
        await page.goto(`http://127.0.0.1:5293/index.html?shims=${shims}`, { waitUntil: 'load', timeout: 60000 })
        await page.waitForFunction('window.harnessReady === true', null, { timeout: 60000 })
        res = await Promise.race([page.evaluate(i => window.runOne(i), r.idx), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 30s')), 30000))])
      } catch (e) {
        res = { idx: r.idx, file: r.file, harnessError: String(e.message || e).slice(0, 500) }
        try { await page.close() } catch {}
        page = await ctx.newPage()
      }
      res.ms = Date.now() - t0; results[r.idx] = res
      if (!transient(res)) break
    }
    const x = results[r.idx]
    console.log(label, r.idx, r.file, x.harnessError ? 'ERR ' + x.harnessError.slice(0, 100) : `same=${x.identical} pvErr=${x.pv?.errors?.length}`)
  }
} finally {
  fs.writeFileSync(OUT, JSON.stringify(results))
  await browser.close()
}
