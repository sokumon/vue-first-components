const { open } = require('../test/lib.cjs');
(async () => { const { b, p, errs } = await open(); p.setDefaultTimeout(4000)
 if (process.env.PROTO) { const fs=require('fs'); await p.route('http://jq.test/dist/es-ui.iife.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(__dirname + '/proto/' + (process.env.PROTO === 'dev' ? 'dist-dev' : 'dist') + '/es-ui.iife.js') })); await p.route('http://jq.test/dist/es-ui.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(__dirname + '/proto/' + (process.env.PROTO === 'dev' ? 'dist-dev' : 'dist') + '/es-wc-spike.css') })) }
 p.on('pageerror', e => console.log('PAGEERR', e.stack.slice(0,800)))
 await p.goto('http://jq.test/sweep-overlays/pages/' + process.argv[2]); await p.waitForFunction(() => window.READY); await p.waitForTimeout(300)
 const W = (ms=300) => p.waitForTimeout(ms)
 try { await eval('(async () => {' + require('fs').readFileSync(process.argv[3], 'utf8') + '})')() } catch (e) { console.log('ERR', e.message.split('\n')[0]) }
 console.log(errs.join('\n')); await b.close() })()
