// Mount cost of 200 inputs elements from jQuery, with and without ES.batch (fresh page each).
const run = require('./lib.cjs')
run('desk.html', async ({ p, r, ev }) => {
  const out = {}
  for (const tag of ['es-checkbox', 'es-text-input', 'es-select', 'es-date-picker']) for (const mode of ['loop', 'batch']) {
    await p.goto('http://jq.test/sweep-inputs/pages/desk.html'); await p.waitForFunction(() => window.READY)
    out[tag + ':' + mode] = await ev(([tag, mode]) => {
      make(SPECS.find((s) => s.tag === 'es-button')); $('#stage').empty() // app created
      const spec = SPECS.find((s) => s.tag === tag)
      const t0 = performance.now()
      const go = () => { for (let i = 0; i < 200; i++) make(spec) }
      mode === 'batch' ? ES.batch(go) : go()
      const t1 = performance.now()
      const n = $('#stage ' + tag + ' ' + spec.probe.split(',')[0]).length
      return { ms: Math.round(t1 - t0), rendered: n }
    }, [tag, mode])
  }
  r('200 elements per tag render (ms per mode)', Object.values(out).every((o) => o.rendered >= 200), JSON.stringify(out))
})
