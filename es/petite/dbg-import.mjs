import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/claude/fb/pw/node_modules/playwright')
const b = await chromium.launch(); const p = await b.newPage()
p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()) })
p.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)) })
await p.goto('http://127.0.0.1:5291/index.html')
console.log(await p.evaluate(async u => { try { await import(u); return 'ok' } catch (e) { return String(e) } }, process.argv[2]))
await b.close()
