// Ad-hoc probe: node probe.cjs file-with-async-fn-body.js  (runs the body in the sweep page)
const { open } = require('../test/lib.cjs'); const fs = require('fs')
;(async () => {
  const { b, p, errs } = await open()
  fs.writeFileSync(__dirname + '/page-run.html', fs.readFileSync(__dirname + '/page.html', 'utf8').replace('/dist/es-ui.iife.js', (process.env.DIST || '/dist') + '/es-ui.iife.js'))
  if (process.env.CASE) await p.goto('about:blank').then(() => p.evaluate((c) => window.name = c, process.env.CASE)); await p.goto('http://jq.test/sweep-display/page-run.html'); await p.waitForFunction(() => window.__built)
  try { console.log(JSON.stringify(await p.evaluate(fs.readFileSync(process.argv[2], 'utf8')), null, 1)) } catch (e) { console.log('THREW', e.message.split('\n')[0]) }
  console.log('errors', errs.length); errs.slice(0, 8).forEach((e) => console.log('  ' + e.slice(0, 400)))
  await b.close()
})()
