// Runs wc/jq/test.cjs (the builder's 35-check smoke suite) against proto/<PROTO>/es-ui.iife.js by
// patching test/lib.cjs open() to route /dist/es-ui.iife.js + es-ui.css. Nothing in wc/jq is modified.
const fs = require('fs')
const lib = require('../test/lib.cjs')
const d = __dirname + '/proto/' + (process.env.PROTO || 'dist-nomin')
const orig = lib.open
lib.open = async (...a) => {
  const o = await orig(...a)
  await o.p.route('http://jq.test/dist/es-ui.iife.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(d + '/es-ui.iife.js') }))
  return o
}
require('../test.cjs')
