// node bench.cjs <runs> <tag1> <tag2> ...  (prod builds; alternates tags each run; one browser at a time)
const http = require('http'), fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const [runsArg, ...tags] = process.argv.slice(2)
const RUNS = +runsArg
function serve(dist) {
  return new Promise((res) => { const srv = http.createServer((req, resp) => { let p = req.url.split('?')[0]; if (p === '/') p = '/index.html'; const f = path.join(dist, p); if (!fs.existsSync(f)) { resp.writeHead(404); return resp.end() } resp.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] }); fs.createReadStream(f).pipe(resp) }); srv.listen(0, '127.0.0.1', () => res(srv)) })
}
const med = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
;(async () => {
  const srvs = {}; for (const t of tags) srvs[t] = await serve(path.join(__dirname, 'dist', t + '-prod'))
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] })
  const R = {}
  const rec = (t, k, v) => ((R[t] ||= {})[k] ||= []).push(v)
  for (let r = 0; r < RUNS; r++) {
    for (const t of (r % 2 ? [...tags].reverse() : tags)) {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } }); const page = await ctx.newPage()
      page.on('pageerror', (e) => console.error(t, 'pageerror', e.message))
      await page.goto(`http://127.0.0.1:${srvs[t].address().port}/`); await page.waitForFunction(() => window.__ready)
      const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable')
      const nodes = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'Nodes').value
      const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize }
      const E = (f, a) => page.evaluate(f, a)
      await page.waitForTimeout(100)
      const h0 = await heap(), n0 = await nodes()
      rec(t, 'mount100 cold', (await E(() => V.bench.mount(100))).js)
      rec(t, 'heap/ctl KB', ((await heap()) - h0) / 100 / 1024); rec(t, 'blink nodes/ctl', ((await nodes()) - n0) / 100)
      rec(t, 'dom nodes/ctl (tree)', (await E(() => V.bench.dom())) / 100)
      rec(t, 'upd query x100', (await E(() => V.bench.setAll('query', 'query'))).js)
      rec(t, 'upd options20 x100', (await E(() => V.bench.setAll('options', 'opts20'))).js)
      rec(t, 'upd placeholder x100', (await E(() => V.bench.setAll('placeholder', 'ph'))).js)
      { const o = await E(() => V.bench.open(3)); rec(t, 'first open js', o.js); rec(t, 'first open painted', o.painted) }
      { const o = await E(() => V.bench.close(3)); rec(t, 'first close js', o.js); rec(t, 'first close painted', o.painted) }
      rec(t, 'second open js', (await E(() => V.bench.open(3))).js)
      await E(() => V.bench.close(3))
      rec(t, 'mount100 warm', (await E(() => V.bench.mount(100))).js)
      rec(t, 'mount10 warm', (await E(() => V.bench.mount(10))).js)
      rec(t, 'mount10 warm painted', (await E(() => V.bench.mount(10))).painted)
      await ctx.close()
      // a fresh page for a Desk-sized cold mount (10 Links)
      const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage(); await p2.goto(`http://127.0.0.1:${srvs[t].address().port}/`); await p2.waitForFunction(() => window.__ready); await p2.waitForTimeout(100)
      const m10 = await p2.evaluate(() => V.bench.mount(10)); rec(t, 'mount10 cold', m10.js); rec(t, 'mount10 cold painted', m10.painted)
      await ctx2.close()
    }
    process.stderr.write(`run ${r + 1}/${RUNS}\n`)
  }
  await browser.close(); Object.values(srvs).forEach((s) => s.close())
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'out', 'bench-' + tags.join('-') + '.json'), JSON.stringify(R, null, 1))
  const keys = Object.keys(R[tags[0]])
  console.log('| metric | ' + tags.map((t) => t + ' median [min-max]').join(' | ') + ' | change |\n|---|' + tags.map(() => '---:|').join('') + '---:|')
  for (const k of keys) {
    const cells = tags.map((t) => { const a = R[t][k]; return `${med(a).toFixed(2)} [${Math.min(...a).toFixed(1)}-${Math.max(...a).toFixed(1)}]` })
    const ch = ((med(R[tags[1]][k]) / med(R[tags[0]][k]) - 1) * 100).toFixed(0) + '%'
    console.log(`| ${k} | ${cells.join(' | ')} | ${ch} |`)
  }
})()
