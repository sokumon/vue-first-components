// Behaviour checks for Combobox. Drives the harness page with Playwright and records, after every
// step, a normalized DOM + ARIA snapshot of the scenario, every open popover (and where it was
// teleported), the focused element, and the emitted events. Output: out/<tag>.json.
//   node check.cjs <distTag>            e.g. head-dev, patched-dev
//   node check.cjs --diff a.json b.json
const http = require('http'), fs = require('fs'), path = require('path')

if (process.argv[2] === '--diff') {
  const A = JSON.parse(fs.readFileSync(process.argv[3])), B = JSON.parse(fs.readFileSync(process.argv[4]))
  let diffs = 0
  const keys = new Set([...Object.keys(A.steps), ...Object.keys(B.steps)])
  for (const k of keys) {
    const a = JSON.stringify(A.steps[k], null, 1), b = JSON.stringify(B.steps[k], null, 1)
    if (a === b) continue
    diffs++
    console.log('### DIFF', k)
    const al = (a || '').split('\n'), bl = (b || '').split('\n')
    for (let i = 0; i < Math.max(al.length, bl.length); i++) if (al[i] !== bl[i]) { console.log('- ' + al[i]); console.log('+ ' + bl[i]) }
  }
  for (const w of ['warnings', 'errors']) if (JSON.stringify(A[w]) !== JSON.stringify(B[w])) { diffs++; console.log('### DIFF', w, '\n-', JSON.stringify(A[w]), '\n+', JSON.stringify(B[w])) }
  console.log(`${keys.size} steps compared, ${diffs} differ`)
  process.exit(diffs ? 1 : 0)
}

const { chromium } = require('playwright')
const tag = process.argv[2]
const DIST = path.join(__dirname, 'dist', tag)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const serve = () => new Promise((res) => {
  const srv = http.createServer((req, resp) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'
    const f = path.join(DIST, p)
    if (!f.startsWith(DIST) || !fs.existsSync(f)) { resp.writeHead(404); return resp.end() }
    resp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(resp)
  })
  srv.listen(0, '127.0.0.1', () => res(srv))
})

// in-page snapshot: normalized clone of the scenario + each popover content, with generated ids
// renamed by first appearance in DOM order (so a different useId counter does not show as a diff).
function pageSnap(sc) {
  const ID_ATTRS = ['id', 'for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-activedescendant', 'aria-errormessage', 'aria-owns']
  const roots = [document.getElementById(sc)]
  const contents = [...document.querySelectorAll('[data-slot=content]')].filter((c) => !document.getElementById('app').contains(c) || roots[0].contains(c))
  const where = (el) => { for (let p = el; p; p = p.parentElement) if (['portal-a', 'cp-target', 'host-target'].includes(p.id)) return '#' + p.id; return el.closest('#app') ? 'inline' : 'body' }
  const map = new Map()
  const norm = (v) => v.split(/\s+/).filter(Boolean).map((t) => {
    if (!/^(reka-|v-|frappe|input-|combobox|:)/.test(t) && !/\d/.test(t)) return t
    if (!map.has(t)) map.set(t, 'ID' + map.size)
    return map.get(t)
  }).join(' ')
  const ser = (n) => {
    if (n.nodeType === 8) return null
    if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' ').trim(); return t ? t : null }
    if (n.nodeType !== 1) return null
    const attrs = {}
    for (const a of [...n.attributes].sort((x, y) => (x.name < y.name ? -1 : 1))) {
      if (a.name.startsWith('data-v-')) continue
      attrs[a.name] = ID_ATTRS.includes(a.name) ? norm(a.value) : a.value
    }
    if ('value' in n && (n.tagName === 'INPUT')) attrs['.value'] = n.value
    const kids = [...n.childNodes].map(ser).filter((x) => x != null)
    return [n.tagName.toLowerCase(), attrs, ...kids]
  }
  const out = { dom: ser(roots[0]), contents: contents.map((c) => ({ where: where(c), dom: ser(c) })) }
  const a = document.activeElement
  out.active = a && a !== document.body ? { tag: a.tagName.toLowerCase(), slot: a.getAttribute('data-slot'), role: a.getAttribute('role'), id: a.id ? norm(a.id) : null, inScenario: roots[0].contains(a), inContent: contents.some((c) => c.contains(a)), text: (a.textContent || '').trim().slice(0, 40) } : 'body'
  out.events = window.__log.splice(0)
  return out
}

;(async () => {
  const srv = await serve()
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1400 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error ' + m.text().slice(0, 200)) })
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`)
  await page.waitForFunction(() => window.__ready)
  const steps = {}
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250)))))
  let n = 0
  async function snap(sc, label) {
    await settle()
    const s = await page.evaluate(pageSnap, sc)
    try { s.aria = await page.locator('#' + sc).ariaSnapshot() } catch (e) { s.aria = 'ERR ' + e.message }
    const open = page.locator('[data-slot=content]')
    s.ariaContent = []
    for (let i = 0; i < await open.count(); i++) s.ariaContent.push(await open.nth(i).ariaSnapshot().catch((e) => 'ERR'))
    steps[`${String(++n).padStart(3, '0')} ${sc}: ${label}`] = s
  }
  const T = (fn, arg) => page.evaluate(fn, arg)
  const k = (key) => page.keyboard.press(key)
  const input = (sc) => page.locator(`#${sc} input[data-slot=input]`).first()

  try {
  // ---- s1: input mode, uncontrolled open, v-model, filterable, label/description, groups, custom row
  await snap('s1', 'closed')
  await input('s1').click(); await snap('s1', 'click opens')
  await k('ArrowDown'); await snap('s1', 'ArrowDown')
  await k('ArrowDown'); await snap('s1', 'ArrowDown 2')
  await k('Enter'); await snap('s1', 'Enter selects')
  await input('s1').click(); await snap('s1', 'reopen with value')
  await page.keyboard.type('glo'); await snap('s1', 'typed glo (filter)')
  for (let i = 0; i < 3; i++) await k('Backspace')
  await snap('s1', 'cleared by backspace')
  await page.keyboard.type('zzz'); await snap('s1', 'typed zzz (only custom row)')
  await k('Escape'); await snap('s1', 'Escape')
  await k('Tab'); await snap('s1', 'Tab away')
  await T(() => T.call('s1', 'focus')); await snap('s1', 'exposed focus()')
  await k('ArrowDown'); await snap('s1', 'ArrowDown opens from focus')
  await k('End'); await snap('s1', 'End')
  await k('Home'); await snap('s1', 'Home')
  await page.locator('[data-slot=content] [role=option]', { hasText: 'Hooli' }).click(); await snap('s1', 'click Hooli')
  await T(() => T.call('s1', 'clear')); await snap('s1', 'exposed clear()')
  await page.locator('#s1 [data-slot=chevron]').click(); await snap('s1', 'chevron opens')
  await page.locator('[data-slot=content] [role=option]', { hasText: 'Create new' }).click(); await snap('s1', 'custom row click')
  await page.locator('#s1 [data-slot=chevron]').click(); await snap('s1', 'chevron opens again')
  await page.mouse.click(800, 1300); await snap('s1', 'outside click closes')
  await T(() => { T.S.s1.value = 'umbrella' }); await snap('s1', 'v-model set from parent')
  await T(() => { T.S.s1.opts = [{ label: 'Only', value: 'only' }] }); await snap('s1', 'options replaced (value not in options)')

  // ---- s2: Desk-like h() control
  await snap('s2', 'closed')
  await input('s2').click(); await snap('s2', 'click does not open')
  await page.keyboard.type('cu'); await snap('s2', 'typed cu (closed, controlled)')
  await T(() => T.setDesk({ options: T.deskOptions(5) })); await snap('s2', 'options arrive closed')
  await T(() => T.setDesk({ open: true })); await snap('s2', 'open by prop')
  await k('ArrowDown'); await snap('s2', 'ArrowDown')
  await k('ArrowDown'); await snap('s2', 'ArrowDown 2')
  await k('Enter'); await snap('s2', 'Enter selects')
  await T(() => T.setDesk({ options: [], open: true })); await snap('s2', 'open with no options (emptyText)')
  await k('Escape'); await snap('s2', 'Escape')
  await T(() => T.setDesk({ placeholder: 'Changed', query: '' })); await snap('s2', 'placeholder + query change closed')
  await T(() => T.setDesk({ options: T.deskOptions(3), open: true })); await snap('s2', 'reopen')
  await T(() => T.setDesk({ open: false })); await snap('s2', 'close by prop')

  // ---- s3: slots, error/required, dynamic slot
  await snap('s3', 'closed')
  await T(() => { T.S.s3.flag = true }); await snap('s3', 'prefix slot added')
  await input('s3').click(); await snap('s3', 'open')
  await page.keyboard.type('zz'); await snap('s3', 'empty slot')
  for (let i = 0; i < 2; i++) await k('Backspace')
  await page.locator('[data-slot=content] [role=option]', { hasText: 'Globex' }).click(); await snap('s3', 'select Globex')
  await T(() => { T.S.s3.flag = false }); await snap('s3', 'prefix slot removed')
  await input('s3').click(); await snap('s3', 'reopen with selection')
  await page.locator('[data-test=footer] button').click(); await snap('s3', 'footer close()')
  await page.locator('#s3 [data-test=clear]').click(); await snap('s3', 'suffix clear()')

  // ---- s4: button mode with search
  await snap('s4', 'closed')
  await page.locator('#s4 button[data-slot=trigger]').click(); await snap('s4', 'click opens, search focused')
  await page.keyboard.type('ar'); await snap('s4', 'typed ar')
  await k('ArrowDown'); await snap('s4', 'ArrowDown')
  await k('Enter'); await snap('s4', 'Enter selects, focus returns')
  await page.locator('#s4 button[data-slot=trigger]').focus(); await snap('s4', 'trigger focused')
  await k('Enter'); await snap('s4', 'Enter on trigger opens')
  await page.locator('[data-test=ss]').click(); await snap('s4', 'search-suffix setQuery')
  await k('Escape'); await snap('s4', 'Escape, focus return')
  await T(() => T.call('s4', 'focus')); await snap('s4', 'exposed focus() closed')
  await k('ArrowDown'); await snap('s4', 'ArrowDown on trigger')
  await T(() => T.call('s4', 'focus')); await snap('s4', 'exposed focus() open')
  await k('Escape'); await snap('s4', 'Escape 2')

  // ---- s5: custom #trigger
  await snap('s5', 'closed')
  await page.locator('[data-test=mytrigger]').click(); await snap('s5', 'click opens')
  await k('ArrowDown'); await k('Enter'); await snap('s5', 'keyboard select')
  await T(() => T.call('s5', 'focus')); await snap('s5', 'exposed focus()')
  await page.locator('[data-test=mytrigger]').click(); await snap('s5', 'reopen')
  await k('Escape'); await snap('s5', 'Escape')

  // ---- s6: disabled
  await snap('s6', 'closed')
  await input('s6').click({ force: true }); await snap('s6', 'click disabled input')
  await page.locator('#s6 button[data-slot=trigger]').click({ force: true }); await snap('s6', 'click disabled button')

  // ---- s8: attrs passthrough, readonly
  await snap('s8', 'closed')
  await input('s8').click(); await snap('s8', 'click readonly opens')
  await k('Escape'); await snap('s8', 'Escape')

  // ---- s9: mounted open (controlled v-model:open)
  await snap('s9', 'mounted open')
  await k('Escape'); await snap('s9', 'Escape (not focused)')
  await T(() => { T.S.s9.open = true }); await snap('s9', 'open by v-model:open')
  await page.locator('[data-slot=content] [role=option]', { hasText: 'Acme' }).click(); await snap('s9', 'select Acme')

  // ---- s10/s11: ConfigProvider teleportTo, providePortalTarget
  await page.locator('#s10 input[placeholder=cp]').click(); await snap('s10', 'open (ConfigProvider teleportTo)')
  await k('Escape'); await snap('s10', 'Escape')
  await page.locator('#s10 input[placeholder=host]').click(); await snap('s10', 'open (providePortalTarget)')
  await k('Escape'); await snap('s10', 'Escape 2')

  // ---- s12: loading
  await page.locator('#s12 button[data-slot=trigger]').click(); await snap('s12', 'open loading')
  await T(() => { T.S.s12.loading = false }); await snap('s12', 'loaded')
  await k('Escape'); await snap('s12', 'Escape')

  // ---- s13: controlled v-model:open, openOnClick false, side/align/offset
  await input('s13').click(); await snap('s13', 'click does not open')
  await T(() => { T.S.s13.open = true }); await snap('s13', 'open by parent')
  await k('ArrowDown'); await k('Enter'); await snap('s13', 'keyboard select')
  await k('ArrowDown'); await snap('s13', 'ArrowDown reopens')
  await k('Escape'); await snap('s13', 'Escape')

  } catch (e) { errors.push('DRIVER ' + e.message.split('\n')[0]); process.exitCode = 2 }
  const warnings = await page.evaluate(() => window.__warnings)
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true })
  const f = path.join(__dirname, 'out', tag + '.json')
  fs.writeFileSync(f, JSON.stringify({ tag, steps, warnings, errors }, null, 1))
  console.log('wrote', f, Object.keys(steps).length, 'steps,', warnings.length, 'warnings,', errors.length, 'errors')
  await browser.close(); srv.close()
})()
