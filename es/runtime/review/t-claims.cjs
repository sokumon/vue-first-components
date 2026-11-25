// Re-verify sweep claims, each on a fresh page so a crash cannot cascade.
const { run } = require('./lib.cjs')
run('claims', 'base.html', async ({ p, r, ev }) => {
  const fresh = async () => { await p.reload(); await p.waitForFunction(() => window.ES && window.jQuery) }
  // ---- WORKS claims
  await fresh()
  r('WORKS es-checkbox: one change event with value, .attr(disabled) reaches input', await ev(() => {
    const log = []
    const $c = $('<es-checkbox label="Agree">').appendTo('#stage').on('change', (e) => log.push(['change', e.originalEvent && e.originalEvent.detail])).on('update:modelValue', (e) => log.push(['upd', e.originalEvent.detail]))
    $c.find('input')[0].click()
    ES.flush()
    const checked = $c.prop('modelValue')
    $c.attr('disabled', true); ES.flush()
    return { ok: log.filter((x) => x[0] === 'change').length === 1 && checked === true && $c.find('input').prop('disabled') === true, log, checked }
  }).then((x) => x.ok) , null)
  await fresh()
  const ti = await ev(async () => {
    const $t = $('<es-text-input placeholder="Name">').appendTo('#stage')
    $t[0].focus()
    const focused = document.activeElement === $t.find('input')[0]
    const vals = []
    $t.on('update:modelValue', (e) => vals.push(e.originalEvent.detail))
    const inp = $t.find('input')[0]; inp.value = 'abc'; inp.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 400))
    $t.prop('modelValue', 'set-from-jq'); ES.flush()
    return { focused, vals, prop: $t.prop('modelValue'), shown: $t.find('input').val() }
  })
  r('WORKS es-text-input: focus right after append, update:modelValue out, .prop in', ti.focused && ti.vals.includes('abc') && ti.shown === 'set-from-jq', ti)
  await fresh()
  await ev(() => {
    $(`<es-tabs id="ct" model-value="a"><es-tab-list><es-tab-trigger value="a" label="A"></es-tab-trigger><es-tab-trigger value="b" label="B"></es-tab-trigger></es-tab-list>
      <es-tab-panel value="a">Panel A</es-tab-panel><es-tab-panel value="b">Panel B</es-tab-panel></es-tabs>`).appendTo('#stage')
  })
  await p.click('#ct [role=tab] >> nth=1')
  const tabs = await ev(() => {
    const $t = $('#ct'), tr = $t.find('[role=tab]')
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id)
    const chain = []; for (let i = $t.find('es-tab-trigger')[0]._es.node; i; i = i.parent) chain.push(i.type.name || i.type.__name)
    return { tabs: tr.length, dup: ids.filter((x, i) => ids.indexOf(x) !== i), sel: $t.find('[role=tab][aria-selected=true]').text().trim(), panel: $t.find('[role=tabpanel]').filter(':visible').text().trim(), mv: $t.prop('modelValue'), chain: chain.join('<') }
  })
  r('WORKS compound es-tabs from a jQuery string: one tree, unique ids, switching', tabs.tabs === 2 && !tabs.dup.length && tabs.sel === 'B' && tabs.mv === 'b', tabs)
  await fresh()
  const det = await ev(async () => {
    const $d = $('<es-dialog title="Keep"><div slot="body-content"><input id="din"></div></es-dialog>').appendTo('#stage')
    $d.prop('modelValue', true); ES.flush(); await ES.tick()
    $('#din').val('typed')
    const node = $d[0]._es.node
    $d.detach(); $d.appendTo('#stage2'); ES.flush()
    await new Promise((r) => setTimeout(r, 300))
    return { same: $d[0]._es.node === node, open: !!document.querySelector('[role=dialog]'), val: $('#din').val() }
  })
  r('WORKS detach + re-append same task keeps an open dialog and its input', det.same && det.open && det.val === 'typed', det)

  // ---- BROKEN / CAVEAT claims
  await fresh()
  const tp = await ev(() => {
    const $p = $('<es-tooltip-provider><span id="kid">kid</span></es-tooltip-provider>').appendTo('#stage')
    let err = null
    try { $p.html('<span>new</span>'); ES.flush() } catch (e) { err = e.message }
    let err2 = null
    const $b = $('<es-button label="After">')
    try { $b.appendTo('#stage2'); ES.flush() } catch (e) { err2 = e.message }
    return { err, err2, after: $b.find('button').length }
  })
  r('BROKEN(dist) es-tooltip-provider .html() crash then later es-button does not render', !!tp.err && tp.after === 0, tp)
  await fresh()
  const sl = await ev(() => {
    const $s = $('<es-slider step="10" min="0" max="100">').appendTo('#stage')
    $s.prop('modelValue', [30]); ES.flush()
    const th = $s.find('[role=slider]')[0]; th.focus()
    th.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); ES.flush()
    return { val: $s.prop('modelValue'), stepType: typeof $s.prop('step'), types: ES.def('es-slider').props.get('step').types.map((t) => t.name) }
  })
  r('BROKEN(dist) es-slider step="10" stays a string (ArrowRight from 30 does not give 40)', JSON.stringify(sl.val) !== '[40]' && sl.stepType === 'string', sl)
  await fresh()
  const bd = await ev(() => {
    const $b = $('<es-badge label="New">').appendTo('#stage'); ES.flush()
    const $c = $b.clone().appendTo('#stage2'); ES.flush()
    return { orig: $b[0].querySelectorAll('div,span').length, cloneHTML: $c[0].innerHTML.slice(0, 400), nested: $c.find('es-slot').length, txt: $c.text().trim() }
  })
  r('CAVEAT(dist) es-badge .clone() renders the stale badge inside the clone', bd.nested > 0, bd)
  await fresh()
  const dd = await ev(() => {
    let err = null
    const $d = $(`<es-dropdown button='{"label":"Menu"}'>`)
    try { $d.appendTo('#stage'); ES.flush() } catch (e) { err = e.message }
    let err2 = null
    const $b = $('<es-button label="After">')
    try { $b.appendTo('#stage2'); ES.flush() } catch (e) { err2 = 'appendTo of an unrelated es-button threw: ' + e.message }
    const $o = $('<div id="far">').appendTo('body')
    for (let i = 0; i < 20; i++) try { $('<es-badge label="b' + i + '">').appendTo($o) } catch (e) { err2 += ' | badge ' + i + ' threw' }
    return { err, err2, badgesRendered: $o.find('es-badge > div').length, rendered: $d.find('button').length, after: $b.find('button').length }
  })
  r('CAVEAT(dist) es-dropdown JSON button attr fails (TS-typed prop has no runtime type)', !!dd.err || dd.rendered === 0, dd)
  await fresh()
  const to = await ev(async () => {
    $('<es-frappe-ui-provider><span>x</span></es-frappe-ui-provider>').appendTo('#stage'); ES.flush()
    ES.toast.success('Hello twice?')
    await new Promise((r) => setTimeout(r, 600))
    return { toasters: document.querySelectorAll('[data-sonner-toaster]').length, shown: [...document.querySelectorAll('[data-sonner-toast]')].length }
  })
  r('CAVEAT(dist) toast shows twice with es-frappe-ui-provider on page', to.shown === 2, to)
  await fresh()
  const pf = await ev(() => {
    let called = 0
    const fn = () => { called++; return 'ret' }
    const $b = $('<es-sidebar-item label="x">').appendTo('#stage')
    $b.prop('onClick', fn)
    return { called, stored: typeof $b[0].onClick, val: String($b[0].onClick).slice(0, 40) }
  })
  r('CAVEAT jQuery .prop(name, fn) calls fn instead of storing it', pf.called === 1 && pf.stored !== 'function' || pf.val === 'ret', pf)
})
