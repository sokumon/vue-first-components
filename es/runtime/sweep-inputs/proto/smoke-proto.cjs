// Runs wc/jq/test.cjs (the builder's smoke suite) against proto/dist/es-ui.iife.js instead of wc/jq/dist.
const fs = require('fs'), path = require('path')
const lib = require('../../test/lib.cjs')
const orig = lib.open
lib.open = async (opts) => {
  const o = await orig(opts)
  await o.p.route('http://jq.test/dist/es-ui.iife.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'dist/es-ui.iife.js')) }))
  return o
}
require('../../test.cjs')
