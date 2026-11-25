// Smoke suite for the jQuery contract (CONTRACT.md). Page code is jQuery only.
// Usage: . ~/fb/env.sh && node wc/jq/test.cjs
const { open } = require('./test/lib.cjs')
const fs = require('fs'), path = require('path')

const USERS = [
  { value: 'ada@example.com', label: 'Ada Lovelace', description: 'ada@example.com' },
  { value: 'grace@example.com', label: 'Grace Hopper', description: 'grace@example.com' },
]
const api = (method, body) => {
  if (method === 'frappe.desk.search.search_link') {
    const q = ((body && body.txt) || '').toLowerCase()
    return USERS.filter((u) => !q || u.value.includes(q) || u.label.toLowerCase().includes(q))
  }
}

let fails = 0
const report = (k, ok, extra) => {
  if (!ok) fails++
  console.log((ok ? 'PASS ' : 'FAIL ') + k + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).replace(/\n/g, ' ').slice(0, 220) : ''))
}
const frame = () => new Promise((r) => setTimeout(r, 60))

;(async () => {
  const { b, p, errs } = await open({ api })
  const ev = (fn, arg) => p.evaluate(fn, arg)
  const check = async (name, fn, arg) => {
    try {
      const r = await p.evaluate(fn, arg)
      report(name, r && r.ok, r && r.info)
    } catch (e) { report(name, false, 'exception ' + e.message.split('\n')[0]) }
  }
  try {
    await p.goto('http://jq.test/test/pages/smoke.html')
    await p.waitForFunction(() => window.ES && window.jQuery)

    // ---------------------------------------------------------------- registration
    await check('registration: frappe-ui as es-*, @framework/ui as es-fw-*, none failed', () => {
      const t = ES.registered
      return { ok: t.length > 140 && t.includes('es-button') && t.includes('es-fw-link-field') && !ES.failed.length,
        info: { total: t.length, fui: t.filter((x) => !x.startsWith('es-fw-')).length, fw: t.filter((x) => x.startsWith('es-fw-')).length, failed: ES.failed } }
    })

    // ---------------------------------------------------------------- 1 creation
    await check('create: $(\'<es-button label="Save">\') renders on the next line', () => {
      const $b = $('<es-button label="Save" id="b1">').appendTo('#stage')
      const $btn = $b.find('button')
      return { ok: $btn.length === 1 && $btn.text().trim() === 'Save', info: $btn.text().trim() }
    })
    await check('create: document.createElement + property, then append', () => {
      const el = document.createElement('es-button')
      el.label = 'Made'
      document.getElementById('stage').appendChild(el)
      const t = $(el).find('button').text().trim()
      return { ok: t === 'Made', info: t }
    })
    await check('one app: every element shares the one Vue app (no per-element createApp)', () => {
      const n = ES.stats()
      return { ok: !!ES.app && n.top >= 2 && document.querySelectorAll('es-app').length === 1, info: n }
    })

    // ---------------------------------------------------------------- 2 attributes and properties
    await check('.attr string before insertion, after insertion (re-render)', async () => {
      const $b = $('<es-button>').attr('label', 'Before').appendTo('#stage')
      const a = $b.find('button').text().trim()
      $b.attr('label', 'After')
      await Promise.resolve(); await new Promise((r) => setTimeout(r))
      const c = $b.find('button').text().trim()
      return { ok: a === 'Before' && c === 'After', info: [a, c] }
    })
    await check('.attr boolean: attr(name,true) sets, attr(name,false) removes (before and after)', async () => {
      const $b = $('<es-button label="X">').attr('disabled', true).appendTo('#stage')
      const d1 = $b.find('button').prop('disabled')
      $b.attr('disabled', false)
      ES.flush()
      const d2 = $b.find('button').prop('disabled')
      const has = $b[0].hasAttribute('disabled')
      $b.attr('loading', true); ES.flush()
      const l = $b[0].loading
      $b.attr('loading', false); ES.flush()
      return { ok: d1 === true && d2 === false && !has && l === true && !$b[0].loading, info: { d1, d2, has, l, l2: $b[0].loading } }
    })
    await check('.prop arrays/objects/functions before and after insertion (es-select options)', async () => {
      const $s = $('<es-select placeholder="Pick">').prop('options', [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }])
      $s.prop('modelValue', '2').appendTo('#stage')
      const t1 = $s.find('button').text().trim()
      $s.prop('model-value', '1'); ES.flush()
      const t2 = $s.find('button').text().trim()
      return { ok: /Two/.test(t1) && /One/.test(t2) && Array.isArray($s.prop('options')), info: [t1, t2] }
    })

    // ---------------------------------------------------------------- 3 events
    await check('events: .on("update:model-value") payload in e.originalEvent.detail; element keeps the value', async () => {
      const got = []
      const $c = $('<es-checkbox label="Agree">').on('update:model-value', (e) => got.push(e.originalEvent.detail)).appendTo('#stage')
      $c.find('button,input').first()[0].click()
      await new Promise((r) => setTimeout(r, 30))
      return { ok: got.length === 1 && got[0] === true && $c.prop('modelValue') === true, info: { got, prop: $c.prop('modelValue') } }
    })
    await check('events: a native event that shares an emit name is not seen (es-fw-text-field change fires once, with the value)', async () => {
      const got = []
      const $f = $('<es-fw-text-field>').prop('field', { fieldname: 'x', fieldtype: 'Data', label: 'X' }).prop('modelValue', '')
        .on('change', (e) => got.push(e.originalEvent instanceof CustomEvent ? ['es', e.originalEvent.detail] : ['native']))
        .appendTo('#stage')
      const inp = $f.find('input')[0]
      inp.focus(); inp.value = 'hello'; inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true })); inp.blur()
      await new Promise((r) => setTimeout(r, 50))
      const natives = got.filter((g) => g[0] === 'native').length
      return { ok: natives === 0 && got.some((g) => g[1] === 'hello'), info: got }
    })
    await check('events: emit "click" on a component that declares it arrives once (es-mobile-nav-item)', async () => {
      const got = []
      const $n = $('<es-mobile-nav-item label="Home">').on('click', (e) => got.push(e.originalEvent instanceof CustomEvent)).appendTo('#stage')
      $n.find('button')[0].click()
      return { ok: got.length === 1 && got[0] === true, info: got }
    })

    // ---------------------------------------------------------------- 4 exposed methods
    await check('exposed methods callable on the element (es-text-input .focus(), .inputElement)', () => {
      const $t = $('<es-text-input placeholder="Type">').appendTo('#stage')
      const el = $t[0]
      el.focus()
      const inp = el.inputElement
      return { ok: inp && document.activeElement === inp && inp.tagName === 'INPUT', info: [inp && inp.tagName, document.activeElement.tagName] }
    })

    // ---------------------------------------------------------------- 5 jQuery writes into a host
    await check('.text() on a host: becomes the default slot, element keeps working', async () => {
      const $b = $('<es-button label="L">').appendTo('#stage')
      $b.text('Texted'); ES.flush()
      const t = $b.find('button').text().trim()
      const c0 = $b.find('button').attr('class')
      $b.attr('variant', 'solid'); ES.flush()
      const c1 = $b.find('button').attr('class')
      return { ok: t === 'Texted' && $b.find('button').length === 1 && c0 !== c1, info: [t, c1] }
    })
    await check('.html() on a host: re-read as slot content, remounted', () => {
      const $b = $('<es-button label="L">').appendTo('#stage')
      $b.html('<b class="hb">Bold</b>'); ES.flush()
      return { ok: $b.find('button b.hb').length === 1 && $b.find('button').length === 1, info: $b.find('button').html().slice(0, 120) }
    })
    await check('.append()/.prepend() on a host: added to the slot, state kept', () => {
      const $c = $('<es-checkbox label="C">').appendTo('#stage')
      $c.find('button,input').first()[0].click(); ES.flush()
      const before = $c.prop('modelValue')
      const $b = $('<es-button>').appendTo('#stage')
      $b.append('<i class="ap">A</i>'); ES.flush()
      $b.append('<i class="ap2">B</i>'); $b.prepend('<i class="pp">P</i>'); ES.flush()
      const order = $b.find('button i').map((_, x) => x.className).get().join(',')
      return { ok: before === true && order === 'pp,ap,ap2' && $b.find('button').length === 1, info: order }
    })
    await check('.empty() on a host: no slot content, default rendering', () => {
      const $b = $('<es-button label="Fallback"><b>x</b></es-button>').appendTo('#stage')
      const a = $b.find('button').text().trim()
      $b.empty(); ES.flush()
      const t = $b.find('button').text().trim()
      return { ok: a === 'x' && t === 'Fallback' && $b.find('button').length === 1, info: [a, t] }
    })

    // ---------------------------------------------------------------- 6 removal, detach, clone
    await check('.remove() unmounts at once', () => {
      const n0 = ES.stats().top
      const $b = $('<es-button label="R">').appendTo('#stage')
      const n1 = ES.stats().top
      $b.remove()
      const n2 = ES.stats().top
      return { ok: n1 === n0 + 1 && n2 === n0 && $b.find('button').length === 0, info: [n0, n1, n2] }
    })
    await check('.detach() then re-append in the same task keeps state', async () => {
      const $t = $('<es-text-input>').appendTo('#stage')
      const inp = $t.find('input')[0]
      inp.value = 'typed'; inp.dispatchEvent(new Event('input', { bubbles: true }))
      await new Promise((r) => setTimeout(r))
      $t.detach(); $('#stage').prepend($t)
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))
      const same = $t.find('input')[0] === inp
      return { ok: same && $t.find('input').val() === 'typed' && $t[0].modelValue === 'typed', info: [same, $t.find('input').val()] }
    })
    await check('.detach() then re-append in the next frame keeps state; after that it unmounts', async () => {
      const $t = $('<es-text-input>').appendTo('#stage')
      const inp = $t.find('input')[0]
      $t.detach()
      await new Promise((r) => requestAnimationFrame(r))
      $('#stage').append($t)
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))
      const kept = $t.find('input')[0] === inp
      const n0 = ES.stats().top
      $t.detach()
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))
      const n1 = ES.stats().top
      $('#stage').append($t)
      const back = $t.find('input').length === 1 && $t.find('input')[0] !== inp
      return { ok: kept && n1 === n0 - 1 && back, info: { kept, n0, n1, back } }
    })
    await check('.clone(): attributes and slot content copied, renders on its own', () => {
      const $b = $('<es-button variant="solid"><span class="lbl">Cloned</span></es-button>').appendTo('#stage')
      const $c = $b.clone().appendTo('#stage')
      const c = $c.find('button .lbl').length, s = $c.find('button').length
      $c.find('.lbl').text('Changed')
      return { ok: c === 1 && s === 1 && $b.find('.lbl').text() === 'Cloned' && $c.attr('variant') === 'solid', info: { c, s, html: $c.html().slice(0, 120) } }
    })

    // ---------------------------------------------------------------- 7 scoped slots
    await check('per-row slot: <template slot="tab-label"> stamped per tab, [data-es-text] bound, es-slot event', () => {
      const seen = []
      const $t = $('<es-tabs model-value="a"><template slot="tab-label"><span class="tl" data-es-text="tab.label"></span></template></es-tabs>')
        .prop('tabs', [{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b' }])
        .on('es-slot', (e) => { const d = e.originalEvent.detail; seen.push(d.name); $(d.nodes).addClass('stamped') })
        .appendTo('#stage')
      const labels = $t.find('.tl').map((_, x) => x.textContent).get()
      return { ok: labels.join() === 'Alpha,Beta' && $t.find('.tl.stamped').length === 2 && seen.length >= 2, info: { labels, seen } }
    })

    // ---------------------------------------------------------------- composition
    await check('Tabs composed from es-tabs / es-tab-list / es-tab-trigger / es-tab-panel', async () => {
      const got = []
      const $t = $(`<es-tabs model-value="one">
        <es-tab-list><es-tab-trigger value="one" label="One"></es-tab-trigger><es-tab-trigger value="two" label="Two"></es-tab-trigger></es-tab-list>
        <es-tab-panel value="one"><p class="p1">Panel one</p></es-tab-panel>
        <es-tab-panel value="two"><p class="p2">Panel two</p></es-tab-panel></es-tabs>`)
        .on('update:model-value', (e) => e.target === e.currentTarget && got.push(e.originalEvent.detail)).appendTo('#stage')
      const triggers = $t.find('[role=tab]')
      const v1 = $t.find('.p1:visible').length === 1 && $t.find('.p2:visible').length === 0
      const sel1 = triggers.eq(0).attr('aria-selected')
      triggers.eq(1).trigger('mousedown')
      triggers[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      triggers[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      triggers[1].click()
      await new Promise((r) => setTimeout(r, 60))
      const v2 = $t.find('.p2:visible').length === 1 && $t.find('.p1:visible').length === 0
      return { ok: triggers.length === 2 && sel1 === 'true' && v1 && v2 && got.includes('two'), info: { n: triggers.length, sel1, v1, v2, got } }
    })
    await check('nested elements are real children: es-tab-trigger\'s component has Tabs and TabList as ancestors; a trigger appended later joins, a removed one leaves', async () => {
      const names = (el) => { const out = []; for (let i = el.esComponent && el.esComponent.$; i; i = i.parent) out.push(i.type.name || i.type.__name); return out }
      const $t = $('<es-tabs model-value="a"><es-tab-list><es-tab-trigger value="a" label="A"></es-tab-trigger></es-tab-list><es-tab-panel value="a">A</es-tab-panel></es-tabs>').appendTo('#stage')
      const chain = names($t.find('es-tab-trigger')[0])
      $t.find('es-tab-list').append('<es-tab-trigger value="c" label="Cee"></es-tab-trigger>')
      $t.append('<es-tab-panel value="c"><p class="pc">C panel</p></es-tab-panel>')
      ES.flush()
      const n2 = $t.find('[role=tab]').length
      const tc = $t.find('[role=tab]')[1]
      tc.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); tc.click()
      await new Promise((r) => setTimeout(r, 60))
      const cShown = $t.find('.pc:visible').length === 1
      $t.find('es-tab-trigger[value=c]').remove()
      const n3 = $t.find('[role=tab]').length
      return { ok: chain.includes('Tabs') && chain.includes('TabList') && chain.includes('EsRoot') && n2 === 2 && cShown && n3 === 1, info: { n2, cShown, n3, chain: chain.join('<') } }
    })
    await check('es-tooltip inside es-tooltip-provider shares the provider (inject through the slot) and shows on focus', async () => {
      const $p = $('<es-tooltip-provider><es-tooltip text="Tip text"><button class="tt">Hover me</button></es-tooltip></es-tooltip-provider>').appendTo('#stage')
      const chain = []; for (let i = $p.find('es-tooltip')[0].esComponent.$; i; i = i.parent) chain.push(i.type.name || i.type.__name)
      $p.find('button.tt')[0].focus()
      let tip = null
      for (let i = 0; i < 20 && !tip; i++) { await new Promise((r) => setTimeout(r, 50)); tip = [...document.querySelectorAll('[role=tooltip], [data-reka-popper-content-wrapper]')].find((x) => /Tip text/.test(x.textContent)) }
      return { ok: chain.includes('TooltipProvider') && !!tip, info: { chain: chain.slice(0, 6).join('<'), tip: !!tip } }
    })
    await check('es-radio-group with es-radio children (context through the slot)', async () => {
      const got = []
      const $g = $('<es-radio-group model-value="a"><es-radio value="a" label="A"></es-radio><es-radio value="b" label="B"></es-radio></es-radio-group>')
        .on('update:model-value', (e) => got.push(e.originalEvent.detail)).appendTo('#stage')
      const radios = $g.find('[role=radio]')
      const c0 = radios.eq(0).attr('aria-checked') || radios.eq(0).attr('data-state')
      radios[1].click()
      await new Promise((r) => setTimeout(r, 60))
      const c1 = radios.eq(1).attr('aria-checked') || radios.eq(1).attr('data-state')
      return { ok: radios.length === 2 && /true|checked/.test(c0) && /true|checked/.test(c1) && got[0] === 'b' && $g.prop('modelValue') === 'b', info: { n: radios.length, c0, c1, got } }
    })
    await check('es-dropdown menu opens positioned under its trigger; item onClick (a .prop function) runs', async () => {
      window.__picked = []
      const $d = $('<es-dropdown>').prop('options', [{ label: 'Edit', onClick: () => window.__picked.push('edit') }, { label: 'Delete', onClick: () => window.__picked.push('delete') }])
        .prop('button', { label: 'Actions' }).appendTo('#stage')
      const trig = $d.find('button')[0]
      trig.scrollIntoView()
      trig.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
      await new Promise((r) => setTimeout(r, 300))
      const menu = document.querySelector('[role=menu]')
      if (!menu) return { ok: false, info: 'no menu' }
      const tr = trig.getBoundingClientRect(), mr = menu.getBoundingClientRect()
      const items = [...menu.querySelectorAll('[role=menuitem]')]
      const inPortal = !!menu.closest('es-portal')
      items[1].click()
      await new Promise((r) => setTimeout(r, 300))
      return { ok: mr.top >= tr.bottom - 1 && mr.top - tr.bottom < 20 && Math.abs(mr.left - tr.left) < 60 && items.length === 2 && window.__picked[0] === 'delete' && inPortal && !document.querySelector('[role=menu]'),
        info: { trigger: [tr.left, tr.bottom].map(Math.round), menu: [mr.left, mr.top].map(Math.round), picked: window.__picked, inPortal } }
    })
    await check('es-dialog: a jQuery-bound button in its body works; close updates the element', async () => {
      let clicks = 0
      const $body = $('<div class="dlg-body"><button id="dlg-btn" type="button">Do it</button></div>')
      $body.find('#dlg-btn').on('click', () => clicks++)
      const $dlg = $('<es-dialog title="Hello">').append($body).appendTo('#stage')
      const closed = $('#dlg-btn').length === 1 && !$('#dlg-btn').is(':visible')
      $dlg.attr('open', '')
      await new Promise((r) => setTimeout(r, 300))
      const dlg = document.querySelector('[role=dialog]')
      const inside = dlg && dlg.contains(document.getElementById('dlg-btn'))
      $('#dlg-btn').trigger('click')
      document.getElementById('dlg-btn').click()
      const closes = []
      $dlg.on('update:open', (e) => closes.push(e.originalEvent.detail))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      dlg && dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await new Promise((r) => setTimeout(r, 400))
      const titleOk = !$dlg[0].hasAttribute('title') && $dlg.attr('es-title') === 'Hello' && $dlg.prop('title') === 'Hello'
      return { ok: titleOk && closed && inside && clicks === 2 && closes[0] === false && $dlg.prop('open') === false && !document.querySelector('[role=dialog]') && $('#dlg-btn').length === 1,
        info: { closed, inside, clicks, closes, open: $dlg.prop('open') } }
    })
    await check('app-wide plugins and provides: ES.configure(app => app.use(router)), app.provide reach every element', () => {
      const { createRouter, createMemoryHistory } = ES.VueRouter
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
      ES.configure((app) => { app.use(router); app.provide('es-test-key', 42) })
      const $b = $('<es-button label="R">').appendTo('#stage')
      const inst = $b[0].esComponent.$
      return { ok: inst.appContext.config.globalProperties.$router === router && inst.provides['es-test-key'] === 42 && inst.appContext.app === ES.app, info: 'ok' }
    })
    await check('two es-checkbox get distinct ids (one app, one useId counter)', () => {
      const $a = $('<es-checkbox label="A">').appendTo('#stage'), $b = $('<es-checkbox label="B">').appendTo('#stage')
      const ia = $a.find('[id]').attr('id'), ib = $b.find('[id]').attr('id')
      const la = $a.find('label').attr('for')
      return { ok: ia && ib && ia !== ib && (!la || la === ia), info: [ia, ib, la] }
    })
    await check('@framework/ui es-fw-link-field against a mocked backend: search, pick, update:model-value', async () => {
      const got = []
      const $f = $('<es-fw-link-field>').prop('field', { fieldname: 'user', fieldtype: 'Link', label: 'User', options: 'User' }).prop('modelValue', null)
        .on('update:model-value', (e) => got.push(e.originalEvent.detail)).appendTo('#stage')
      const inp = $f.find('input,button[role=combobox],[role=combobox]')[0]
      inp.focus()
      inp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); inp.click()
      await new Promise((r) => setTimeout(r, 200))
      const ti = document.activeElement && document.activeElement.tagName === 'INPUT' ? document.activeElement : $f.find('input')[0] || document.querySelector('es-portal input')
      if (ti) { ti.value = 'grace'; ti.dispatchEvent(new Event('input', { bubbles: true })) }
      let opt = null
      for (let i = 0; i < 30 && !opt; i++) { await new Promise((r) => setTimeout(r, 100)); opt = [...document.querySelectorAll('[role=option]')].find((o) => /Grace/.test(o.textContent)) }
      if (!opt) return { ok: false, info: 'no option; ' + document.querySelectorAll('[role=option]').length }
      opt.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); opt.click()
      await new Promise((r) => setTimeout(r, 200))
      return { ok: got.includes('grace@example.com') && $f.prop('modelValue') === 'grace@example.com', info: { got, v: $f.prop('modelValue') } }
    })

    // ---------------------------------------------------------------- CSS
    await check('host is display:contents but answers for its box (jQuery :visible, .offset())', () => {
      const $b = $('<es-button label="Box">').appendTo('#stage')
      const off = $b.offset(), r = $b.find('button')[0].getBoundingClientRect()
      return { ok: getComputedStyle($b[0]).display === 'contents' && $b.is(':visible') && Math.round(off.top) === Math.round(r.top + scrollY), info: [getComputedStyle($b[0]).display, off] }
    })
    await check('ES.batch: elements appended inside render together, before batch() returns', () => {
      let inside
      ES.batch(() => { for (let i = 0; i < 20; i++) $('<es-button>').attr('label', 'Q' + i).addClass('qb').appendTo('#stage'); inside = $('#stage .qb button').length })
      const after = $('#stage .qb button').length
      return { ok: inside === 0 && after === 20, info: [inside, after] }
    })
    await check('hidden-until-defined guard is in the shipped sheet', () => {
      const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules] } catch { return [] } }).map((r) => r.cssText)
      return { ok: rules.some((t) => t.includes('es-button') && t.includes(':not(:defined)') && t.includes('hidden')), info: rules.find((t) => t.includes(':not(:defined)')).slice(-60) }
    })
  } catch (e) { report('suite', false, e.message) }

  // ---------------------------------------------------------------- separate pages
  try {
    await p.goto('http://jq.test/test/pages/guard.html')
    const g = await ev(() => getComputedStyle(document.querySelector('es-button')).visibility)
    await p.waitForFunction(() => window.ES && document.querySelector('es-button button'), null, { timeout: 5000 })
    const g2 = await ev(() => [getComputedStyle(document.querySelector('es-button')).display, document.querySelector('es-button button').textContent.trim()])
    report('guard: markup before the script loads is hidden, then renders (parser-created elements)', g === 'hidden' && g2[0] === 'contents' && g2[1] === 'Parsed', [g, g2])

    await p.goto('http://jq.test/test/pages/desk.html')
    await p.waitForFunction(() => window.ES)
    const d = await ev(() => {
      const $b = $('<es-button label="Desk">').appendTo('#stage')
      const inner = getComputedStyle($b.find('button')[0])
      const outer = getComputedStyle(document.getElementById('plain'))
      const bodyMargin = getComputedStyle(document.body).marginTop
      return { innerH: inner.height, innerRadius: inner.borderTopLeftRadius, outerPad: outer.paddingLeft, outerBorder: outer.borderTopWidth, bodyMargin, styleTag: !!document.querySelector('style[data-es-ui-base]') }
    })
    report('scoped CSS (Desk): es-* styled, page markup with the same classes and body untouched', d.innerH === '28px' && d.outerPad !== '8px' && d.bodyMargin === '8px', d)

    await p.goto('http://jq.test/test/pages/esm.html')
    await p.waitForFunction(() => window.ES || window.__esmError, null, { timeout: 10000 })
    const m = await ev(() => {
      const $b = $('<es-button label="Esm">').appendTo('#stage')
      return { text: $b.find('button').text().trim(), vue: ES.Vue.version, deskVue: window.__deskVue && window.__deskVue.version, same: ES.Vue.createApp === (window.__deskVue && window.__deskVue.createApp), err: window.__esmError }
    })
    report('ESM build bundled by esbuild against frappe\'s vue: one Vue, Desk\'s copy', m.text === 'Esm' && m.same && m.vue === m.deskVue, m)
  } catch (e) { report('pages', false, e.message) }

  // ---------------------------------------------------------------- timing
  try {
    const measure = (url, N, mode) => p.evaluate(async ([N, mode]) => {
      const root = document.getElementById('stage'); root.innerHTML = ''
      await new Promise((r) => setTimeout(r, 50))
      const t0 = performance.now()
      if (mode === 'jquery') { const $r = $(root); for (let i = 0; i < N; i++) $('<es-button variant="subtle">').attr('label', 'B' + i).appendTo($r) }
      else if (mode === 'batch') ES.batch(() => { const $r = $(root); for (let i = 0; i < N; i++) $('<es-button variant="subtle">').attr('label', 'B' + i).appendTo($r) })
      else if (mode === 'vue') {
        const { createApp, h } = ES.Vue
        window.__ctl && window.__ctl.unmount()
        window.__ctl = createApp({ render: () => Array.from({ length: N }, (_, i) => h(ES.frappeUI.Button, { label: 'B' + i, variant: 'subtle' })) })
        window.__ctl.mount(root)
      } else { const f = document.createDocumentFragment(); for (let i = 0; i < N; i++) { const e = document.createElement('es-button'); e.label = 'B' + i; f.append(e) } root.append(f) }
      const t1 = performance.now()
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r)))
      const t2 = performance.now()
      const n = root.querySelectorAll('button').length
      if (mode === 'vue') { window.__ctl.unmount(); window.__ctl = null }
      root.innerHTML = ''
      return { sync: +(t1 - t0).toFixed(1), toPaint: +(t2 - t0).toFixed(1), buttons: n }
    }, [N, mode])
    const med = (a, k) => a.map((x) => x[k]).sort((x, y) => x - y)[Math.floor(a.length / 2)]
    const runs = async (url, N, mode) => {
      await p.goto(url); await p.waitForTimeout(200)
      const a = []
      for (let i = 0; i < 5; i++) a.push(await measure(url, N, mode))
      return { sync: med(a, 'sync'), toPaint: med(a, 'toPaint'), buttons: a[0].buttons }
    }
    const cdp = await p.context().newCDPSession(p)
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize }
    const heapPer = async (url, N) => {
      await p.goto(url); await p.waitForTimeout(200)
      const h0 = await heap()
      await p.evaluate((N) => { const f = document.createDocumentFragment(); for (let i = 0; i < N; i++) { const e = document.createElement('es-button'); e.label = 'B' + i; f.append(e) } document.getElementById('stage').append(f) }, N)
      await p.waitForTimeout(100)
      return +(((await heap()) - h0) / N / 1024).toFixed(1)
    }
    const T = {}
    for (const N of [200, 1000]) {
      T['one app, createElement x' + N] = await runs('http://jq.test/test/pages/smoke.html', N, 'create')
      T['one app, $(...).appendTo x' + N] = await runs('http://jq.test/test/pages/smoke.html', N, 'jquery')
      T['one app, $(...).appendTo inside ES.batch x' + N] = await runs('http://jq.test/test/pages/smoke.html', N, 'batch')
      T['plain Vue app, ' + N + ' <Button>'] = await runs('http://jq.test/test/pages/smoke.html', N, 'vue')
      T['per-element apps (wc/dist), createElement x' + N] = await runs('http://jq.test/test/pages/perelement.html', N, 'create')
    }
    T['heap KB per es-button (1000), one app'] = await heapPer('http://jq.test/test/pages/smoke.html', 1000)
    T['heap KB per es-button (1000), per-element apps'] = await heapPer('http://jq.test/test/pages/perelement.html', 1000)
    for (const [k, v] of Object.entries(T)) console.log('TIME ' + k + ' :: ' + JSON.stringify(v))
    const ok = Object.entries(T).every(([k, v]) => typeof v === 'number' || v.buttons === (k.includes('1000') ? 1000 : 200)) &&
      T['heap KB per es-button (1000), one app'] < T['heap KB per es-button (1000), per-element apps']
    report('timing: 200 and 1000 es-button all render (sync, on the next line); less heap per element than per-element apps', ok)
  } catch (e) { report('timing', false, e.message) }

  const real = errs.filter((e) => !/unmocked|404|Failed to load resource/.test(e))
  console.log('console errors:', real.length)
  real.slice(0, 15).forEach((e) => console.log('  ' + e))
  if (real.length) fails++
  await b.close()
  console.log(fails ? fails + ' FAILED' : 'ALL PASS')
  process.exitCode = fails ? 1 : 0
})()
