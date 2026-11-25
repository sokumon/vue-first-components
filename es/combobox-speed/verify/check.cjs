// node check.cjs <distTag>              -> out/<distTag>.json
// node check.cjs --diff a.json b.json   -> step-by-step differences
const http = require('http'), fs = require('fs'), path = require('path')
if (process.argv[2] === '--diff') {
  const [a, b] = process.argv.slice(3).map((f) => JSON.parse(fs.readFileSync(f)))
  let n = 0, total = 0
  for (const sc of Object.keys(a)) {
    const A = a[sc], B = b[sc] || []
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      total++
      const x = A[i], y = B[i]
      const keys = new Set([...Object.keys(x || {}), ...Object.keys(y || {})])
      const diffs = [...keys].filter((k) => JSON.stringify(x?.[k]) !== JSON.stringify(y?.[k]))
      if (diffs.length) { n++; console.log(`\n### ${sc} #${i} ${x?.label || y?.label}: ${diffs.join(', ')}`); for (const k of diffs) { console.log(`  A.${k}:`, JSON.stringify(x?.[k]).slice(0, 1500)); console.log(`  B.${k}:`, JSON.stringify(y?.[k]).slice(0, 1500)) } }
    }
  }
  console.log(`\n${n} differing steps of ${total}`)
  process.exit(0)
}
const { chromium } = require('playwright')
const tag = process.argv[2]
const DIST = path.join(__dirname, 'dist', tag)
const only = process.argv[3]

const D = (props = {}) => ({ kind: 'desk', props })
const P = (props = {}) => ({ kind: 'plain', props })
const SC = {
  trigger_shapes: [
  ['mount', [P({ slots: { 'trigger-renderslot': true } })]], ['snap', 'trigger-renderslot closed'], ['click', '[data-cell="0"] .v-trigger'], ['tick'], ['snap', 'trigger-renderslot clicked'], ['key', 'Escape'], ['tick'], ['snap', 'trigger-renderslot escape'],
  ['mount', [P({ slots: { 'trigger-fwd': true } })]], ['snap', 'trigger-fwd closed'], ['click', '[data-cell="0"] .v-trigger'], ['tick'], ['snap', 'trigger-fwd clicked'], ['key', 'Escape'], ['tick'], ['snap', 'trigger-fwd escape'],
  ['mount', [P({ slots: { 'trigger': true } })]], ['snap', 'trigger closed'], ['click', '[data-cell="0"] .v-trigger'], ['tick'], ['snap', 'trigger clicked'], ['key', 'Escape'], ['tick'], ['snap', 'trigger escape'], ['focus', '#outside'], ['call', 0, 'focus'], ['snap', 'trigger exposed focus'], ['key', 'Enter'], ['tick'], ['snap', 'trigger Enter on focused trigger'],
  ['mount', [P({ slots: { 'trigger-multi': true } })]], ['snap', 'trigger-multi closed'], ['click', '[data-cell="0"] .v-trigger'], ['tick'], ['snap', 'trigger-multi clicked'], ['key', 'Escape'], ['tick'], ['snap', 'trigger-multi escape'], ['focus', '#outside'], ['call', 0, 'focus'], ['snap', 'trigger-multi exposed focus'], ['key', 'Enter'], ['tick'], ['snap', 'trigger-multi Enter on focused trigger'],
  ['mount', [P({ slots: { 'trigger-comment': true } })]], ['snap', 'trigger-comment closed'], ['click', '[data-cell="0"] .v-trigger'], ['tick'], ['snap', 'trigger-comment clicked'], ['key', 'Escape'], ['tick'], ['snap', 'trigger-comment escape'], ['focus', '#outside'], ['call', 0, 'focus'], ['snap', 'trigger-comment exposed focus'], ['key', 'Enter'], ['tick'], ['snap', 'trigger-comment Enter on focused trigger'],
  ['mount', [P({ slots: { 'trigger-frag': true } })]], ['snap', 'trigger-frag closed'], ['click', '[data-cell="0"] .v-trigger'], ['tick'], ['snap', 'trigger-frag clicked'], ['key', 'Escape'], ['tick'], ['snap', 'trigger-frag escape'], ['focus', '#outside'], ['call', 0, 'focus'], ['snap', 'trigger-frag exposed focus'], ['key', 'Enter'], ['tick'], ['snap', 'trigger-frag Enter on focused trigger'],
  ['mount', [P({ slots: { 'trigger-comp': true } })]], ['snap', 'trigger-comp closed'], ['click', '[data-cell="0"] .v-trigger'], ['tick'], ['snap', 'trigger-comp clicked'], ['key', 'Escape'], ['tick'], ['snap', 'trigger-comp escape'], ['focus', '#outside'], ['call', 0, 'focus'], ['snap', 'trigger-comp exposed focus'], ['key', 'Enter'], ['tick'], ['snap', 'trigger-comp Enter on focused trigger'],
  ],
  closed_aria: [
    ['mount', [D(), D({ options: 5 }), P()]], ['snap', 'mounted closed'],
    ['set', 1, { open: true }], ['snap', 'desk1 open'], ['set', 1, { open: false }], ['tick'], ['snap', 'desk1 closed again'],
    ['click', '[data-cell="2"] input'], ['snap', 'plain open by click'], ['key', 'Escape'], ['tick'], ['snap', 'plain closed by Escape'],
  ],
  open_close_many: [
    ['mount', [D({ options: 5 }), P()]],
    ...Array.from({ length: 12 }, (_, k) => [['set', 0, { open: true }], ['tick'], ['set', 0, { open: false }], ['tick', 1]]).flat(), ['tick'], ['snap', 'after 12 prop cycles'],
    ['set', 0, { open: true }], ['tick'], ['snap', 'open 13th'], ['set', 0, { open: false }],
    ...Array.from({ length: 8 }, () => [['click', '[data-cell="1"] [data-slot=chevron]'], ['tick'], ['key', 'Escape'], ['tick']]).flat(), ['snap', 'after 8 chevron/Escape cycles'],
    ...Array.from({ length: 8 }, () => [['focus', '[data-cell="1"] input'], ['key', 'ArrowDown'], ['tick'], ['key', 'Escape'], ['tick', 1]]).flat(), ['tick'], ['snap', 'after 8 ArrowDown/Escape'],
    // rapid: open and close in the same tick, and open-close-open in one tick
    ['set', 0, { open: true }], ['set', 0, { open: false }], ['tick'], ['snap', 'open+close same tick'],
  ],
  keyboard_first: [
    ['mount', [P(), P()]], ['focus', '#outside'], ['key', 'Tab'], ['snap', 'tab into first'],
    ['key', 'ArrowDown'], ['tick'], ['snap', 'ArrowDown first interaction'], ['key', 'ArrowDown'], ['tick'], ['snap', 'ArrowDown 2'],
    ['key', 'Enter'], ['tick'], ['snap', 'Enter picks'], ['key', 'Tab'], ['key', 'ArrowUp'], ['tick'], ['snap', 'ArrowUp on second'],
    ['key', 'End'], ['tick'], ['snap', 'End'], ['key', 'Escape'], ['tick'], ['snap', 'Escape'],
  ],
  keyboard_type_first: [
    ['mount', [P({ extra: { openOnFocus: false } })]], ['focus', '[data-cell="0"] input'], ['type', 'Ac'], ['tick'], ['snap', 'typing first opens filtered'], ['key', 'Enter'], ['tick'], ['snap', 'Enter'],
  ],
  mount_open: [
    ['mount', [D({ options: 5, open: true }), D()]], ['snap', 'mounted open'], ['key', 'ArrowDown'], ['tick'], ['snap', 'arrow'], ['set', 0, { open: false }], ['tick'], ['snap', 'closed'],
  ],
  open_sync_after_mount: [
    ['mount', [D({ options: 5 })], { openSync: 0 }], ['snap', 'opened in same tick as mount'],
  ],
  options_while_closed: [
    ['mount', [D()]], ['set', 0, { optionsN: 3 }], ['set', 0, { optionsN: 7, gen: 1 }], ['tick'], ['snap', 'closed after 2 option sets'],
    ['set', 0, { open: true }], ['tick'], ['snap', 'open shows 7'], ['set', 0, { open: false }], ['tick'],
    ['set', 0, { optionsN: 2, gen: 2, html: true }], ['tick'], ['set', 0, { open: true }], ['tick'], ['snap', 'reopen shows 2 html rows'],
    ['set', 0, { optionsN: 4, gen: 3 }], ['tick'], ['snap', 'options change while open'],
  ],
  query_while_closed: [
    ['mount', [D({ options: 8, extra: { filterable: true, openOnFocus: false, openOnClick: false } })]], ['set', 0, { query: 'Acme' }], ['tick'], ['snap', 'query set closed'],
    ['set', 0, { open: true }], ['tick'], ['snap', 'open filtered by query'], ['set', 0, { open: false }], ['set', 0, { query: 'Cust 1' }], ['tick'], ['set', 0, { open: true }], ['tick'], ['snap', 'reopen new query'],
    ['set', 0, { query: '' }], ['tick'], ['snap', 'query cleared while open'],
  ],
  slots_after_mount: [
    ['mount', [D({ options: 4 }), P()]], ['set', 0, { slots: { label: true, description: true, prefix: true } }], ['tick'], ['snap', 'label/desc/prefix added'],
    ['set', 0, { slots: { suffix: true } }], ['tick'], ['snap', 'suffix added'], ['set', 0, { slots: { suffix: false, 'suffix-empty': true } }], ['tick'], ['snap', 'empty suffix -> chevron fallback'],
    ['set', 0, { slots: { 'suffix-empty': false, footer: true } }], ['tick'], ['set', 0, { open: true }], ['tick'], ['snap', 'open with footer'],
    ['set', 0, { slots: { footer: false, 'item-html': false } }], ['tick'], ['snap', 'footer + item-html removed while open'],
    ['set', 0, { open: false, modelValue: 'C-0-1', slots: { 'item-prefix': true } }], ['tick'], ['snap', 'selected + item-prefix'],
    ['set', 1, { slots: { trigger: true } }], ['tick'], ['snap', 'trigger slot added to plain'], ['click', '[data-cell="1"] .v-trigger'], ['tick'], ['snap', 'click custom trigger'],
    ['key', 'Escape'], ['tick'], ['set', 1, { slots: { trigger: false } }], ['tick'], ['snap', 'trigger removed'], ['click', '[data-cell="1"] input'], ['tick'], ['snap', 'input click after trigger removed'],
  ],
  async_options: [
    ['mount', [D()]], ['set', 0, { open: true }], ['tick'], ['snap', 'open empty'], ['wait', 50], ['set', 0, { optionsN: 5 }], ['tick'], ['snap', 'async options arrive'],
    ['focus', '[data-cell="0"] input'], ['key', 'ArrowDown'], ['tick'], ['key', 'Enter'], ['tick'], ['snap', 'pick'],
    ['set', 0, { open: true, options: [] }], ['tick'], ['set', 0, { optionsN: 3, gen: 5 }], ['tick'], ['snap', 'reopen async'],
  ],
  focus_blur: [
    ['mount', [P(), P(), D({ options: 3 })]], ['click', '[data-cell="0"] input'], ['tick'], ['snap', 'click 0'], ['key', 'Tab'], ['tick'], ['snap', 'Tab'], ['key', 'Tab'], ['tick'], ['snap', 'Tab 2'],
    ['key', 'Shift+Tab'], ['tick'], ['snap', 'Shift+Tab'], ['click', '#outside'], ['tick'], ['snap', 'outside'], ['call', 2, 'focus'], ['snap', 'exposed focus'], ['call', 0, 'clear'], ['snap', 'exposed clear'],
  ],
  portal_change: [
    ['mount', [D({ options: 3 }), D({ options: 3 })]], ['set', 0, { portalTo: '#portalA' }], ['set', 0, { open: true }], ['tick'], ['snap', 'first open to portalA'],
    ['set', 0, { open: false }], ['tick'], ['set', 0, { portalTo: '#portalB' }], ['tick'], ['set', 0, { open: true }], ['tick'], ['snap', 'reopen to portalB'],
    ['set', 0, { portalTo: '#portalA' }], ['tick'], ['snap', 'portal change while open'], ['set', 0, { portalTo: undefined }], ['tick'], ['snap', 'portal unset while open'],
    ['set', 1, { portalTo: '#late' }], ['addEl', 'late'], ['set', 1, { open: true }], ['tick'], ['snap', 'target created after mount'],
  ],
  portal_host_config: [
    ['mount', [D({ options: 3 }), D({ options: 3, portalTo: '#portalB' })], { hostTarget: '#portalA' }], ['set', 0, { open: true }], ['tick'], ['snap', 'host target'], ['set', 1, { open: true }], ['tick'], ['snap', 'portalTo beats host'],
  ],
  portal_config: [
    ['mount', [D({ options: 3 })], { layout: { config: '#portalB' } }], ['set', 0, { open: true }], ['tick'], ['snap', 'ConfigProvider teleportTo'],
  ],
  dialog: [
    ['mount', [P(), D({ options: 4 })], { layout: { dialog: true } }], ['tick', 3], ['snap', 'dialog open'],
    ['click', '[data-cell="0"] input'], ['tick'], ['snap', 'combobox in dialog open'], ['key', 'ArrowDown'], ['tick'], ['key', 'Enter'], ['tick'], ['snap', 'picked in dialog'],
    ['click', '[data-cell="0"] [data-slot=chevron]'], ['tick'], ['snap', 'reopen'], ['key', 'Escape'], ['tick'], ['snap', 'Escape closes combobox only'],
    ['set', 1, { open: true }], ['tick'], ['snap', 'desk combobox open in dialog'], ['click', '[data-slot=content] [role=option] >> nth=1'], ['tick'], ['snap', 'click option in desk combobox'],
    ['key', 'Tab'], ['tick'], ['key', 'Tab'], ['tick'], ['key', 'Tab'], ['tick'], ['key', 'Tab'], ['tick'], ['snap', 'tab x4 in trap'],
    ['key', 'Escape'], ['tick', 3], ['snap', 'Escape again'],
  ],
  unmount_open: [
    ['mount', [D({ options: 4 }), P()]], ['set', 0, { open: true }], ['tick'], ['set', 0, { hidden: true }], ['tick'], ['snap', 'unmounted desk while open'],
    ['click', '[data-cell="1"] input'], ['tick'], ['set', 1, { hidden: true }], ['tick'], ['snap', 'unmounted plain while open (focused)'],
    ['set', 1, { hidden: false }], ['tick'], ['snap', 'remounted plain'], ['click', '[data-cell="1"] input'], ['tick'], ['snap', 'open remounted'],
    ['unmountApp'], ['snap', 'app unmounted'],
  ],
  two_interacting: [
    ['mount', [P(), P()]], ['click', '[data-cell="0"] input'], ['tick'], ['snap', '0 open'], ['click', '[data-cell="1"] input'], ['tick'], ['snap', 'click 1'],
    ['key', 'ArrowDown'], ['tick'], ['key', 'Enter'], ['tick'], ['snap', 'pick in 1'], ['click', '[data-cell="0"] [data-slot=chevron]'], ['tick'], ['snap', 'chevron 0'], ['click', '[data-cell="1"] [data-slot=chevron]'], ['tick'], ['snap', 'chevron 1'],
  ],
  desk_aria_timing: [
    ['mount', [D({ options: 5 }), D({ options: 5 })]], ['ariaTimeout', 0], ['snap', 'after desk-style first open'], ['set', 0, { open: false }], ['tick'], ['ariaTimeout', 0], ['snap', 'second open'],
  ],
  disabled_toggle: [
    ['mount', [P(), D({ options: 3 })]], ['set', 0, { extra: { disabled: true } }], ['set', 1, { extra: { filterable: false, openOnFocus: false, openOnClick: false, disabled: true } }], ['tick'], ['snap', 'disabled'],
    ['set', 0, { extra: { disabled: false } }], ['tick'], ['click', '[data-cell="0"] input'], ['tick'], ['snap', 'enabled + click'],
  ],
}

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'
      const f = path.join(DIST, p)
      if (!f.startsWith(DIST) || !fs.existsSync(f)) { resp.writeHead(404); return resp.end() }
      resp.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' })
      fs.createReadStream(f).pipe(resp)
    })
    srv.listen(0, '127.0.0.1', () => res(srv))
  })
}

;(async () => {
  const srv = await serve()
  const browser = await chromium.launch()
  const out = {}
  for (const [name, steps] of Object.entries(SC)) {
    if (only && name !== only) continue
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } })
    const page = await ctx.newPage()
    const consoleMsgs = []
    page.on('pageerror', (e) => consoleMsgs.push('pageerror ' + e.message))
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push(m.type() + ' ' + m.text().slice(0, 200)) })
    await page.goto(`http://127.0.0.1:${srv.address().port}/`)
    await page.waitForFunction(() => window.__ready)
    const res = []
    let extra = null
    for (const st of steps) {
      const [op, a, b, c] = st
      if (process.env.TRACE) console.log(name, op, JSON.stringify(a)?.slice(0, 60))
      try {
        if (op === 'mount') await page.evaluate(async ([states, opts]) => {
          for (const s of states) if (s.props?.options) s.props.options = window.V.makeOptions(s.props.options)
          await window.V.mount(states, opts || {})
        }, [a, b])
        if (op === 'set') await page.evaluate(([i, p]) => window.V.set(i, p), [a, b])
        if (op === 'tick') await page.evaluate((n) => window.V.tick(n), a ?? 2)
        if (op === 'key') await page.keyboard.press(a)
        if (op === 'type') await page.keyboard.type(a, { delay: 20 })
        if (op === 'click') await page.click(a, { timeout: 2000 })
        if (op === 'focus') await page.focus(a)
        if (op === 'call') await page.evaluate(([i, m]) => window.V.call(i, m), [a, b])
        if (op === 'wait') await page.waitForTimeout(a)
        if (op === 'addEl') await page.evaluate((id) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d) }, a)
        if (op === 'unmountApp') await page.evaluate(() => window.V.unmount())
        if (op === 'ariaTimeout') extra = await page.evaluate((i) => window.V.ariaAfterOpenTimeout(i), a)
      } catch (e) { extra = { ...(extra || {}), error: `${op}: ${e.message.split('\n')[0]}` } }
      if (op === 'snap') {
        const s = await page.evaluate(() => window.V.snap())
        res.push({ label: a, ...s, ...(extra ? { extra } : {}), console: consoleMsgs.splice(0) })
        extra = null
      }
    }
    out[name] = res
    await ctx.close()
  }
  await browser.close(); srv.close()
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true })
  const f = path.join(__dirname, 'out', (only ? only + '-' : '') + tag + '.json')
  fs.writeFileSync(f, JSON.stringify(out, null, 1))
  const nSnaps = Object.values(out).reduce((n, r) => n + r.length, 0)
  console.log('wrote', f, nSnaps, 'snapshots')
})()
