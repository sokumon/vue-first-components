// Desk patterns, jQuery only.
const { run } = require('./lib.cjs')
run('desk', 'desk.html', async ({ p, r, ev, errs }) => {
  const fresh = async () => { await p.reload(); await p.waitForFunction(() => window.ES && window.jQuery) }
  const E0 = () => errs.length
  // ---------- 1. frappe.render_template-style refresh of a container holding many es-* elements
  await fresh()
  let e0 = E0()
  const a = await ev(async () => {
    const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    const row = (d, i) => `<div class="row-item" data-name="${escape(d.name)}">
        <es-checkbox class="sel" label="${escape(d.name)}"></es-checkbox>
        <es-badge label="${escape(d.status)}" theme="${d.status === 'Open' ? 'green' : 'gray'}"></es-badge>
        <es-tooltip text="${escape(d.owner)}"><span class="owner">${escape(d.owner)}</span></es-tooltip>
        <es-button class="act" label="Open"></es-button>
        <es-avatar label="${escape(d.owner)}" size="sm"></es-avatar>
      </div>`
    const data = (k) => Array.from({ length: 40 }, (_, i) => ({ name: 'DOC-' + k + '-' + i, status: i % 2 ? 'Open' : 'Closed', owner: 'user' + i + '@x.com' }))
    let clicks = 0
    $('#body').on('click', '.act button', () => clicks++) // delegated, Desk style
    const times = []
    for (let k = 0; k < 25; k++) {
      const t = performance.now()
      $('#body').html(data(k).map(row).join(''))
      times.push(performance.now() - t)
    }
    const els = $('#body').find('*').filter((i, x) => x.localName.startsWith('es-')).length
    $('#body .act button').eq(3).trigger('click'); $('#body .act button')[5].click()
    await new Promise((r) => setTimeout(r, 200))
    const st = ES.stats()
    const rendered = $('#body es-button > button').length
    return { els, rendered, top: st.top, buckets: st.buckets, groups: st.groups, clicks, first: Math.round(times[0]), avg: Math.round(times.slice(1).reduce((a, b) => a + b, 0) / (times.length - 1)) }
  })
  r('render_template refresh x25 of 200 es-* elements: all rendered, no leaked entries, delegated clicks once', a.rendered === 40 && a.top === 200 && a.clicks === 2, a)
  r('  no errors during refreshes', E0() === e0, errs.slice(e0, e0 + 3))

  // ---------- 2. two routes reusing one container, and coming back
  await fresh()
  e0 = E0()
  const b = await ev(async () => {
    const pages = {
      list: `<es-tabs model-value="a"><es-tab-list><es-tab-trigger value="a" label="All"></es-tab-trigger><es-tab-trigger value="b" label="Mine"></es-tab-trigger></es-tab-list><es-tab-panel value="a"><es-text-input class="q" placeholder="Search"></es-text-input></es-tab-panel><es-tab-panel value="b">mine</es-tab-panel></es-tabs>`,
      form: `<es-dialog title="Form"><div slot="body-content"><es-select class="s"></es-select></div></es-dialog><es-sidebar-item label="Back"></es-sidebar-item><es-switch label="On"></es-switch>`,
    }
    const res = []
    for (let i = 0; i < 30; i++) {
      const route = i % 2 ? 'form' : 'list'
      $('#page-a').html(pages[route])
      if (route === 'form') $('#page-a .s').prop('options', [{ label: 'A', value: 'a' }])
      ES.flush()
      res.push(route === 'list' ? $('#page-a [role=tab]').length : $('#page-a button[role=switch]').length)
    }
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i)
    return { ok: res.every((x, i) => x === (i % 2 ? 1 : 2)), res: res.slice(0, 6), dup, top: ES.stats().top, children: $('#page-a').children().length }
  })
  r('two routes swapping .html() into the same container 30x', b.ok && !b.dup.length && b.top === 3, b)
  r('  no errors', E0() === e0, errs.slice(e0, e0 + 3))

  // ---------- 3. moving elements between containers (Desk moves sidebars, grids)
  await fresh()
  e0 = E0()
  const c = await ev(async () => {
    const $wrap = $('<div class="moving">').appendTo('#side')
    for (let i = 0; i < 20; i++) $('<es-text-input>').attr('placeholder', 'f' + i).appendTo($wrap)
    $wrap.find('input').each((i, x) => { x.value = 'v' + i })
    // move the whole subtree (like mobile_nav moves sidebar.$items_container into a sheet)
    $wrap.appendTo('#stage')
    $wrap.children().eq(0).appendTo('#stage2') // move one element alone
    await new Promise((r) => setTimeout(r, 300))
    const kept = $wrap.find('input').toArray().map((x) => x.value).filter((v, i) => v === 'v' + (i + 1)).length
    // move into another element's slot and back to top level (documented: state resets)
    const $d = $('<es-popover><div slot="body">pop</div></es-popover>').appendTo('#stage2')
    return { kept, single: $('#stage2 input').val(), top: ES.stats().top }
  })
  r('moving a subtree / single elements between containers keeps state', c.kept === 19 && c.single === 'v0', c)

  // ---------- 4. elements created detached, inserted much later
  await fresh()
  e0 = E0()
  const d = await ev(async () => {
    const $sel = $('<es-select>').prop('options', [{ label: 'One', value: '1' }, { label: 'Two', value: '2' }]).prop('modelValue', '2')
    const $btn = $('<es-button label="Later">').on('click', () => (window.LATER = (window.LATER || 0) + 1))
    const $frag = $('<div>').append('<es-checkbox label="in frag"></es-checkbox>', $btn) // detached parent
    await new Promise((r) => setTimeout(r, 1500))
    $btn.attr('label', 'Later2')
    await new Promise((r) => setTimeout(r, 500))
    $sel.appendTo('#stage'); $frag.appendTo('#stage2'); ES.flush()
    $('#stage2 es-button button')[0].click()
    return { sel: $('#stage es-select').text().trim(), btn: $('#stage2 es-button').text().trim(), cb: $('#stage2 es-checkbox input').length, LATER: window.LATER }
  })
  r('created detached (in and out of a detached div), inserted 2 s later', d.sel.includes('Two') && d.btn === 'Later2' && d.cb === 1 && d.LATER === 1, d)

  // ---------- 5. $.cleanData-based teardown vs native removal; mounted entries go away
  await fresh()
  const f = await ev(async () => {
    const mk = () => Array.from({ length: 50 }, (_, i) => `<es-button label="b${i}"></es-button>`).join('')
    $('#stage').html(mk()); const s1 = ES.stats().top
    $('#stage').empty(); const s2 = ES.stats().top // jQuery: cleanData -> unmount now
    $('#stage').html(mk())
    document.getElementById('stage').innerHTML = '' // native: unmount after a frame
    const s3 = ES.stats().top
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)))
    const s4 = ES.stats().top
    // frappe-style: container removed with its parent
    $('#stage2').html(mk()); $('#stage2').parent().find('#stage2').remove(); const s5 = ES.stats().top
    return { s1, s2, s3, s4, s5 }
  })
  r('teardown: $.cleanData unmounts at once; native innerHTML after a frame', f.s1 === 50 && f.s2 === 0 && f.s4 === 0 && f.s5 === 0, f)

  async function modalSuite(L, patch) {
  // ---------- 6. Bootstrap modal shown/hidden by jQuery, with es-* overlays inside
  await fresh()
  e0 = E0()
  await ev((patch) => {
    if (patch) { const C = $.fn.modal.Constructor.prototype, orig = C._enforceFocus
      C._enforceFocus = function () { orig.call(this); const el = this._element; $(document).off('focusin.bs.modal').on('focusin.bs.modal', (e) => { if (document !== e.target && el !== e.target && !$(el).has(e.target).length && !(e.target.closest && e.target.closest('es-portal'))) el.focus() }) } }
    $('#mbody').html(`<es-text-input class="mi" placeholder="in modal"></es-text-input>
      <es-dropdown class="dd"></es-dropdown>
      <es-select class="ms"></es-select>
      <es-combobox class="mc"></es-combobox>`)
    $('#mbody .dd').prop('button', { label: 'Actions' }).prop('options', [{ label: 'Edit', onClick: () => (window.EDIT = 1) }, { label: 'Delete', onClick: () => {} }])
    $('#mbody .ms').prop('options', [{ label: 'Alpha', value: 'a' }, { label: 'Beta', value: 'b' }])
    $('#mbody .mc').prop('options', [{ label: 'Apple', value: 'apple' }, { label: 'Banana', value: 'banana' }])
    ES.flush()
    $('#m').modal('show')
  }, patch)
  await p.waitForTimeout(500)
  const m1 = await ev(() => ({ shown: $('#m').hasClass('show'), inputs: $('#m input').length, focusable: !!$('#mbody .mi')[0].focus() || document.activeElement === $('#mbody .mi input')[0] }))
  r(L + 'Bootstrap modal: es-* inside render and focus', m1.shown && m1.focusable, m1)
  // open dropdown inside modal
  await p.click('#mbody .dd button')
  await p.waitForTimeout(300)
  const m2 = await ev(() => {
    const item = [...document.querySelectorAll('[role=menuitem]')].find((x) => x.textContent.includes('Edit'))
    if (!item) return { item: false }
    const rc = item.getBoundingClientRect()
    const top = document.elementFromPoint(rc.x + rc.width / 2, rc.y + rc.height / 2)
    const z = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n).zIndex; if (s !== 'auto') return s } return 'auto' }
    return { item: true, inPortal: !!item.closest('es-portal'), onTop: item.contains(top) || top === item, topIs: top && top.className.slice(0, 40), z: z(item), modalZ: getComputedStyle($('#m')[0]).zIndex, active: document.activeElement && (document.activeElement.getAttribute('role') || document.activeElement.className.slice(0, 30)) }
  })
  r(L + 'Bootstrap modal: dropdown menu from inside the modal is on top and clickable', m2.item && m2.onTop, m2)
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100)
  const m3 = await ev(() => ({ open: !!document.querySelector('[role=menu]'), active: document.activeElement && (document.activeElement.getAttribute('role') || document.activeElement.tagName), inModal: $('#m')[0].contains(document.activeElement) }))
  r(L + 'Bootstrap modal: keyboard focus stays in the menu (Bootstrap enforceFocus does not steal it)', m3.open && m3.active === 'menuitem', m3)
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  const m4 = await ev(() => ({ menu: !!document.querySelector('[role=menu]'), modal: $('#m').hasClass('show') }))
  r(L + 'Bootstrap modal: Esc closes the menu only, not the modal too', !m4.menu && m4.modal, m4)
  const m4b = await ev(() => ({ orphanMenu: !!document.querySelector('[role=menu]') }))
  await p.mouse.click(5, 5); await p.waitForTimeout(300)
  await ev(() => $('#m').modal('show')); await p.waitForTimeout(600)
  // mouse click on a menu item inside a modal
  await p.click('#mbody .dd button'); await p.waitForTimeout(300)
  await p.click('[role=menuitem]:has-text("Edit")').catch(() => {}); await p.waitForTimeout(200)
  r(L + 'Bootstrap modal: mouse click on a dropdown item still works', await ev(() => window.EDIT === 1), await ev(() => window.EDIT))
  // combobox typing in modal
  await p.click('#mbody .mc input').catch(() => ev(() => $('#mbody .mc input')[0].focus()))
  await p.keyboard.type('Ban'); await p.waitForTimeout(400)
  const m5 = await ev(() => ({ val: $('#mbody .mc input').val(), opts: [...document.querySelectorAll('[role=option]')].map((x) => x.textContent.trim()), active: document.activeElement && document.activeElement.tagName, shown: $('#m').hasClass('show') }))
  r(L + 'Bootstrap modal: typing into es-combobox inside modal filters options', m5.val === 'Ban' && m5.opts.length >= 1, m5)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  await ev(() => { if (!$('#m').hasClass('show')) $('#m').modal('show') }); await p.waitForTimeout(600)
  await ev(() => $('#m').modal('hide')); await p.waitForTimeout(600)
  await ev(() => $('#m').modal('show')); await p.waitForTimeout(600)
  const m6 = await ev(() => ({ shown: $('#m').hasClass('show'), rendered: $('#mbody es-text-input input').length, ddBtn: $('#mbody .dd button').length, portalLeft: document.querySelector('es-portal').children.length }))
  r(L + 'Bootstrap modal hide + show: elements still rendered', m6.shown && m6.rendered === 1 && m6.ddBtn === 1, m6)
  // select in modal: open and pick via keyboard
  await p.click('#mbody .ms button'); await p.waitForTimeout(300)
  const m7 = await ev(() => ({ opts: document.querySelectorAll('[role=option]').length, active: document.activeElement && (document.activeElement.getAttribute('role') || document.activeElement.tagName) }))
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  const m8 = await ev(() => ({ mv: $('#mbody .ms').prop('modelValue'), open: !!document.querySelector('[role=listbox]') }))
  r(L + 'Bootstrap modal: es-select opens and keyboard-selects inside a modal', m7.opts === 2 && m8.mv, { m7, m8 })
  r(L + '  errors during modal checks', E0() === e0, errs.slice(e0, e0 + 4))
  }
  await modalSuite('', false)
  await modalSuite('[es-portal-aware enforceFocus] ', true)
  // same keyboard check with Bootstrap's focus trap disabled: is enforceFocus the cause?
  await fresh()
  await ev(() => {
    $.fn.modal.Constructor.prototype._enforceFocus = function () {}
    $('#mbody').html('<es-dropdown class="dd"></es-dropdown>')
    $('#mbody .dd').prop('button', { label: 'Actions' }).prop('options', [{ label: 'Edit', onClick: () => {} }, { label: 'Delete', onClick: () => {} }]); ES.flush()
    $('#m').modal('show')
  })
  await p.waitForTimeout(500)
  await p.click('#mbody .dd button'); await p.waitForTimeout(300)
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100)
  const k = await ev(() => ({ active: document.activeElement && (document.activeElement.getAttribute('role') || document.activeElement.tagName) }))
  r('  with Bootstrap _enforceFocus disabled, keyboard reaches the menu', k.active === 'menuitem', k)
})
