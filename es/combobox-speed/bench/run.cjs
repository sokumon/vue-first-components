// Drives the bench page with Playwright (chromium, headless) + CDP.
//   node run.cjs <distTag> <suite> [runs] [outDir]
//   distTag: a folder under dist/ (npm-prod, clone-prod, npm-count, npm-prof, npm-dev, ...)
//   suite:   timing | counts | memory | profile | dev
// Needs NODE_PATH=~/fb/pw/node_modules (playwright). One browser at a time.
const http = require('http')
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const [tag, suite = 'timing', runsArg, outArg] = process.argv.slice(2)
const RUNS = Number(runsArg || 7)
const DIST = path.join(__dirname, 'dist', tag)
const OUT = path.resolve(outArg || path.join(__dirname, '../baseline/raw'))
fs.mkdirSync(OUT, { recursive: true })
if (!fs.existsSync(DIST)) throw new Error('no build at ' + DIST)

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0])
      if (p === '/') p = '/index.html'
      const f = path.join(DIST, p)
      if (!f.startsWith(DIST) || !fs.existsSync(f)) { resp.writeHead(404); return resp.end() }
      // COOP/COEP: cross-origin isolated, so performance.now() has 5 us resolution instead of 100 us
      resp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp' })
      fs.createReadStream(f).pipe(resp)
    })
    srv.listen(0, '127.0.0.1', () => res(srv))
  })
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

async function freshPage(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('console.' + m.type(), m.text().slice(0, 300)) })
  await page.goto(url)
  await page.waitForFunction(() => window.__benchReady)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable')
  // let page load settle
  await page.evaluate(() => new Promise((r) => setTimeout(r, 100)))
  return { ctx, page, cdp }
}

async function metrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics')
  const o = {}
  for (const m of metrics) o[m.name] = m.value
  return o
}
// run an in-page step, returning its own timing plus CDP main-thread deltas (ms)
async function step(page, cdp, fn, arg) {
  const a = await metrics(cdp)
  const r = await page.evaluate(fn, arg)
  const b = await metrics(cdp)
  const d = (k) => +(((b[k] || 0) - (a[k] || 0)) * 1000).toFixed(3)
  return { ...r, cdpScript: d('ScriptDuration'), cdpTask: d('TaskDuration'), cdpLayout: d('LayoutDuration'), cdpStyle: d('RecalcStyleDuration') }
}

// ------------------------------------------------------------------ scenarios
const DESK = {}
const SCEN = {
  mount_1_desk: { kind: 'combobox', n: 1 },
  mount_25_desk: { kind: 'combobox', n: 25 },
  mount_100_desk: { kind: 'combobox', n: 100 },
  mount_300_desk: { kind: 'combobox', n: 300 },
  mount_1_opts20: { kind: 'combobox', n: 1, options: 20 },
  mount_25_opts20: { kind: 'combobox', n: 25, options: 20 },
  mount_100_opts20: { kind: 'combobox', n: 100, options: 20 },
  mount_300_opts20: { kind: 'combobox', n: 300, options: 20 },
  ref_100_input: { kind: 'input', n: 100 },
  ref_300_input: { kind: 'input', n: 300 },
  ref_100_mini: { kind: 'mini', n: 100 },
  ref_300_mini: { kind: 'mini', n: 300 },
}
async function runTiming(browser, url) {
  const res = {}
  const push = (k, v) => (res[k] ||= []).push(v)
  for (let run = 0; run < RUNS; run++) {
    // mount scenarios: cold = first mount in a fresh page; warm = 4th mount in the same page
    for (const [name, s] of Object.entries(SCEN)) {
      const { ctx, page, cdp } = await freshPage(browser, url)
      push(name + ':cold', await step(page, cdp, (s) => B.mount(s.kind, s.n, { options: s.options }), s))
      for (let i = 0; i < 3; i++) await page.evaluate((s) => B.mount(s.kind, s.n, { options: s.options }), s)
      await page.evaluate(() => B.unmount())
      push(name + ':warm', await step(page, cdp, (s) => B.mount(s.kind, s.n, { options: s.options }), s))
      if (s.n === 100) push(name.replace('mount', 'unmount').replace('ref', 'unmount_ref') + ':warm', await step(page, cdp, () => B.unmount()))
      await ctx.close()
    }
    // first open of one (25 Desk-like mounted; options arrive closed, then open by prop, then close)
    for (const nopt of [20]) {
      const { ctx, page, cdp } = await freshPage(browser, url)
      await page.evaluate(() => B.mount('combobox', 25))
      push(`options${nopt}_arrive_closed`, await step(page, cdp, (n) => B.setAll('options', () => B.makeOptions(n), 1), nopt))
      push(`first_open_opts${nopt}`, await step(page, cdp, () => B.open(0)))
      push(`first_close_opts${nopt}`, await step(page, cdp, () => B.close(0)))
      push(`second_open_opts${nopt}`, await step(page, cdp, () => B.open(0)))
      push(`open_other_opts${nopt}`, await step(page, cdp, async (n) => { await B.close(0); await B.setAll('options', () => B.makeOptions(n), 2); return B.open(1) }, nopt))
      await ctx.close()
    }
    // typing / filtering in one filterable Combobox
    for (const nopt of [20, 500]) {
      const { ctx, page, cdp } = await freshPage(browser, url)
      await page.evaluate((n) => B.mount('combobox', 1, { options: n, filterable: true }), nopt)
      push(`open_filterable_${nopt}`, await step(page, cdp, () => B.open(0)))
      const keys = await step(page, cdp, () => B.type('Customer 001').then((k) => ({ keys: k })))
      push(`type_${nopt}`, keys)
      await ctx.close()
    }
    // prop updates on 100 mounted (closed) Desk-like Comboboxes
    {
      const { ctx, page, cdp } = await freshPage(browser, url)
      await page.evaluate(() => B.mount('combobox', 100))
      push('update100_query', await step(page, cdp, () => B.setAll('query', (i) => 'CUST-' + i)))
      push('update100_options20', await step(page, cdp, () => B.setAll('options', (i) => B.makeOptions(20, i))))
      push('update100_query_again', await step(page, cdp, () => B.setAll('query', (i) => 'CUST-x' + i)))
      push('update1_query', await step(page, cdp, () => B.setAll('query', () => 'one', 1)))
      push('update1_options20', await step(page, cdp, () => B.setAll('options', () => B.makeOptions(20, 9), 1)))
      push('update100_placeholder', await step(page, cdp, () => B.setAll('placeholder', (i) => 'P' + i)))
      await ctx.close()
    }
    {
      const { ctx, page, cdp } = await freshPage(browser, url)
      await page.evaluate(() => B.mount('mini', 100))
      push('ref_mini_update100_query', await step(page, cdp, () => B.setAll('query', (i) => 'CUST-' + i)))
      await ctx.close()
    }
    process.stderr.write(`run ${run + 1}/${RUNS} done\n`)
  }
  return res
}

async function runCounts(browser, url) {
  const out = {}
  for (const [label, s] of [['desk', { kind: 'combobox', n: 100 }], ['opts20', { kind: 'combobox', n: 100, options: 20 }], ['mini', { kind: 'mini', n: 100 }]]) {
    const { ctx, page } = await freshPage(browser, url)
    await page.evaluate((s) => B.mount(s.kind, s.n, { options: s.options }), s)
    out[label] = await page.evaluate(() => B.counts(0))
    if (s.kind === 'combobox') {
      // open it (20 options) and count again
      await page.evaluate(() => B.unmount())
      await page.evaluate(() => B.mount('combobox', 1, { options: 20 }))
      await page.evaluate(() => B.open(0))
      out[label + '_open1'] = await page.evaluate(() => B.counts(0))
    }
    await ctx.close()
  }
  return out
}

// heap, DOM counters and listeners per control, from a prod build
async function runMemory(browser, url) {
  const res = {}
  const push = (k, v) => (res[k] ||= []).push(v)
  const kinds = [['desk', 'combobox', 0], ['opts20', 'combobox', 20], ['mini', 'mini', 0], ['input', 'input', 0]]
  for (let run = 0; run < RUNS; run++) {
    for (const [label, kind, opts] of kinds) {
      const { ctx, page, cdp } = await freshPage(browser, url)
      // warm the code paths once so lazily-compiled code/IC state is not charged to the 100
      await page.evaluate(([k, o]) => B.mount(k, 1, { options: o }).then(() => B.unmount()), [kind, opts])
      const N = 100
      await cdp.send('HeapProfiler.collectGarbage')
      const h0 = await cdp.send('Runtime.getHeapUsage')
      const c0 = await cdp.send('Memory.getDOMCounters')
      await page.evaluate(([k, o, n]) => B.mount(k, n, { options: o }), [kind, opts, N])
      await cdp.send('HeapProfiler.collectGarbage')
      await cdp.send('HeapProfiler.collectGarbage')
      const h1 = await cdp.send('Runtime.getHeapUsage')
      const c1 = await cdp.send('Memory.getDOMCounters')
      // listeners on one control's DOM subtree
      const { result } = await cdp.send('Runtime.evaluate', { expression: 'document.querySelector("#stage .cell")' })
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: -1, pierce: true })
      const { result: d } = await cdp.send('Runtime.evaluate', { expression: 'document' })
      const { listeners: docL } = await cdp.send('DOMDebugger.getEventListeners', { objectId: d.objectId })
      const { result: w } = await cdp.send('Runtime.evaluate', { expression: 'window' })
      const { listeners: winL } = await cdp.send('DOMDebugger.getEventListeners', { objectId: w.objectId })
      push(label, {
        heapPerKB: (h1.usedSize - h0.usedSize) / N / 1024,
        domNodesPer: (c1.nodes - c0.nodes) / N,
        jsListenersPer: (c1.jsEventListeners - c0.jsEventListeners) / N,
        cellListeners: listeners.map((l) => l.type).sort(),
        docListeners: docL.map((l) => l.type).sort(),
        winListeners: winL.map((l) => l.type).sort(),
      })
      await ctx.close()
    }
    process.stderr.write(`memory run ${run + 1}/${RUNS}\n`)
  }
  return res
}

async function runProfile(browser, url) {
  const files = []
  for (let run = 0; run < RUNS; run++) {
    const { ctx, page, cdp } = await freshPage(browser, url)
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 50 })
    await cdp.send('Profiler.start')
    const t = await page.evaluate(() => B.mount('combobox', 100))
    const { profile } = await cdp.send('Profiler.stop')
    const f = path.join(OUT, `${tag}-mount100-run${run}.cpuprofile`)
    fs.writeFileSync(f, JSON.stringify(profile))
    files.push({ file: path.basename(f), timing: t })
    await ctx.close()
  }
  return files
}

async function runDev(browser, url) {
  const res = []
  for (let run = 0; run < RUNS; run++) {
    const { ctx, page } = await freshPage(browser, url)
    await page.evaluate(() => B.mount('combobox', 1).then(() => B.unmount()))
    await page.evaluate(() => B.devMeasures())
    const t = await page.evaluate(() => B.mount('combobox', 100))
    res.push({ timing: t, measures: await page.evaluate(() => B.devMeasures()) })
    await ctx.close()
  }
  return res
}

// MODE=dev (or count): which components re-render on mount and on each prop update, and what triggered them
async function runRerenders(browser, url) {
  const { ctx, page } = await freshPage(browser, url)
  const r = await page.evaluate(async () => {
    const o = {}
    await B.mount('combobox', 10); o.mount = B.takeUpdates()
    await B.setAll('query', (i) => 'X' + i); o.query = B.takeUpdates()
    await B.setAll('placeholder', (i) => 'P' + i); o.placeholder = B.takeUpdates()
    await B.setAll('options', (i) => B.makeOptions(20, i)); o.options = B.takeUpdates()
    await B.open(0); o.open = B.takeUpdates()
    await B.close(0); o.close = B.takeUpdates()
    return o
  })
  await ctx.close()
  return r
}

;(async () => {
  const srv = await serve()
  const url = `http://127.0.0.1:${srv.address().port}/index.html`
  const browser = await chromium.launch({ headless: true, args: ['--js-flags=--expose-gc'] })
  const t0 = Date.now()
  let data
  try {
    data = await ({ timing: runTiming, counts: runCounts, memory: runMemory, profile: runProfile, dev: runDev, rerenders: runRerenders })[suite](browser, url)
  } finally {
    await browser.close()
    srv.close()
  }
  const meta = { tag, suite, runs: RUNS, date: new Date().toISOString(), seconds: (Date.now() - t0) / 1000, ua: (await chromium.executablePath()) }
  const f = path.join(OUT, `${tag}-${suite}.json`)
  fs.writeFileSync(f, JSON.stringify({ meta, data }, null, 1))
  console.log('wrote', f)
})()
