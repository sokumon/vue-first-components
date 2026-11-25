// ad-hoc probe: node probe.cjs page.html "js expr" [steps-js]
const { open } = require('../test/lib.cjs')
;(async () => {
  const { b, p, errs } = await open()
  if (process.env.VW) await p.setViewportSize({ width: +process.env.VW, height: +process.env.VH })
  if (process.env.PROTO) { const d = __dirname + '/proto/' + process.env.PROTO; const fs = require('fs')
    await p.route('http://jq.test/dist/es-ui.iife.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(d + '/es-ui.iife.js') }))
    await p.route('http://jq.test/dist/es-ui.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(d + '/es-wc-spike.css') })) }
  p.on('pageerror', (e) => console.log('PAGEERR', e.stack.slice(0, 1500)))
  p.on('console', (m) => m.type() !== 'log' && console.log(m.type(), m.text().slice(0, 600)))
  await p.goto('http://jq.test/sweep-shell/pages/' + process.argv[2])
  await p.waitForFunction(() => window.READY, null, { timeout: 8000 }); await p.waitForTimeout(300)
  for (const x of process.argv.slice(3)) { console.log('>>', x.slice(0, 80)); console.log(JSON.stringify(await p.evaluate(x).catch((e) => 'ERR ' + e.message), null, 0)?.slice(0, 2000)); await p.waitForTimeout(200) }
  await b.close()
})()
