// Loads the IIFE in a blank page and writes the registered tag list (for the CSS host rules).
const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright')
const fs = require('fs'), path = require('path')
;(async () => {
  const b = await chromium.launch()
  try {
    const p = await b.newPage()
    await p.setContent('<!doctype html><html><body></body></html>')
    await p.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../dist/es-ui.iife.js'), 'utf8') })
    const r = await p.evaluate(() => ({ tags: ES.registered, failed: ES.failed }))
    fs.writeFileSync(path.join(__dirname, '../dist/tags.json'), JSON.stringify(r.tags))
    console.log('tags:', r.tags.length, 'registered,', r.failed.length, 'failed', r.failed.length ? JSON.stringify(r.failed) : '')
  } finally { await b.close() }
})()
