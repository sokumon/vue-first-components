// One-app (jq dist / proto) vs per-element (wc/dist base, wc/sweep/shell/fix): mount time, heap, ids, context.
const { open } = require('./lib.cjs')
const fs = require('fs')
;(async () => {
  const out = {}
  for (const page of ['base.html', 'pe-wc-dist.html', 'pe-wc-pe-fix.html']) {
    const { b, p, errs } = await open()
    await p.goto('http://jq.test/review/pages/' + page)
    await p.waitForFunction(() => window.jQuery && customElements.get('es-button'), null, { timeout: 15000 })
    const cdp = await p.context().newCDPSession(p)
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); const u = await cdp.send('Runtime.getHeapUsage'); return u.usedSize }
    const res = {}
    for (const [tag, n] of [['es-button', 200], ['es-button', 1000], ['es-checkbox', 1000], ['es-text-input', 1000]]) {
      await p.evaluate(() => { $('#stage').empty() }); await p.waitForTimeout(300)
      const h0 = await heap()
      const t = await p.evaluate(async ([tag, n]) => {
        const flush = () => window.ES && ES.flush()
        const t0 = performance.now()
        for (let i = 0; i < n; i++) $('<' + tag + '>').attr('label', 'L' + i).appendTo('#stage')
        flush()
        const sync = performance.now() - t0
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r)))
        const painted = performance.now() - t0
        const rendered = $('#stage ' + tag).filter((i, x) => x.querySelector('button,input')).length
        const t1 = performance.now(); $('#stage').empty(); flush(); await new Promise((r) => requestAnimationFrame(() => setTimeout(r)))
        return { sync: Math.round(sync), painted: Math.round(painted), rendered, clear: Math.round(performance.now() - t1) }
      }, [tag, n])
      // heap per element: rebuild and measure while mounted
      await p.evaluate(([tag, n]) => { for (let i = 0; i < n; i++) $('<' + tag + '>').attr('label', 'L' + i).appendTo('#stage'); window.ES && ES.flush() }, [tag, n])
      await p.waitForTimeout(300)
      const h1 = await heap()
      res[tag + ' x' + n] = { ...t, kbPerEl: +((h1 - h0) / n / 1024).toFixed(1) }
    }
    // ids and context
    res.ids = await p.evaluate(async () => {
      $('#stage').empty(); await new Promise((r) => setTimeout(r, 50))
      for (let i = 0; i < 20; i++) $('<es-checkbox label="c">').appendTo('#stage')
      for (let i = 0; i < 5; i++) $('<es-text-input>').attr('label', 'x').appendTo('#stage')
      window.ES && ES.flush(); await new Promise((r) => setTimeout(r, 100))
      const ids = [...document.querySelectorAll('#stage [id]')].map((e) => e.id)
      return { n: ids.length, dup: ids.length - new Set(ids).size, sample: ids.slice(0, 3) }
    })
    res.apps = await p.evaluate(() => document.querySelectorAll('[data-v-app]').length + (window.ES ? 0 : 0))
    res.errs = errs.length
    out[page] = res
    console.log(page, JSON.stringify(res))
    await b.close()
  }
  fs.writeFileSync(__dirname + '/results-perf.json', JSON.stringify(out, null, 1))
})()
