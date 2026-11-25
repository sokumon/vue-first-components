// Desk-style jQuery operations on every inputs-group element (pages/desk.html SPECS):
// create from an HTML string inside a larger template, .detach()/.appendTo() (same task and after a frame),
// .clone(), .html()/.empty() on the host, overlay open + .remove() while open, .remove(), ancestor .empty().
const run = require('./lib.cjs')
run('desk.html', async ({ p, r, ev, W }) => {
  const specs = await ev(() => SPECS.map((s, i) => ({ i, name: s.name || s.tag, open: s.open, openProp: s.openProp, slot: !!s.slot, slotWhenOpen: !!s.slotWhenOpen })))
  const per = {}
  for (const s of specs) {
    const res = (per[s.name] = {})
    const ok = (k, v, info) => { res[k] = v ? 'ok' : 'FAIL' + (info ? ' ' + String(info).slice(0, 160) : ''); r(s.name + ': ' + k, v, info) }
    try {
    // fresh page per component, so one component's crash does not hide the others' results
    await p.goto('http://jq.test/sweep-inputs/pages/desk.html'); await p.waitForFunction(() => window.READY)
    await ev(() => { $('#stage').empty(); window.__errs = [] })
    // 1 create
    const c = await ev((i) => {
      const spec = SPECS[i], $el = make(spec), el = $el[0]
      const uid = el.esComponent && el.esComponent.$.uid
      return { rendered: spec.probe ? $el.find(spec.probe).length > 0 : !!el.esComponent, uid, mark: $el.find('.mark').length, markVis: $el.find('.mark').is(':visible'), visible: spec.probe ? $el.is(':visible') : true }
    }, s.i)
    ok('create in template string renders synchronously', c.rendered && c.uid != null, JSON.stringify(c))
    if (s.slot && !s.slotWhenOpen) ok('slot child rendered', c.mark >= 1 && c.markVis, JSON.stringify(c))
    // 2 detach + re-append in the same task: same instance
    const d1 = await ev((i) => { const spec = SPECS[i], $el = $('#stage ' + spec.tag).first(), u = $el[0].esComponent.$.uid; const $p = $el.parent(); $el.detach(); $el.appendTo($p); ES.flush(); return { same: $el[0].esComponent && $el[0].esComponent.$.uid === u, rendered: spec.probe ? $el.find(spec.probe).length > 0 : true } }, s.i)
    ok('detach+appendTo same task keeps instance', d1.same && d1.rendered, JSON.stringify(d1))
    // 3 detach, wait 2 frames, re-append into a different parent
    await ev((i) => { const $el = $('#stage ' + SPECS[i].tag).first(); window.__u = $el[0].esComponent.$.uid; window.__det = $el.detach() }, s.i)
    await W(120)
    const d2 = await ev((i) => { const spec = SPECS[i], $el = window.__det; $('<div class="moved">').appendTo('#stage').append($el); return { rendered: spec.probe ? $el.find(spec.probe).length > 0 : !!$el[0].esComponent, newInst: $el[0].esComponent && $el[0].esComponent.$.uid !== window.__u, model: JSON.stringify($el.prop(spec.modelName || 'modelValue')), mark: $el.find('.mark').length } }, s.i)
    ok('detach, re-append after a frame: remounts fresh, props kept', d2.rendered && (!s.slot || s.slotWhenOpen || d2.mark >= 1), JSON.stringify(d2))
    // 4 clone
    const cl = await ev((i) => {
      const spec = SPECS[i], $el = $('#stage ' + spec.tag).first(), mark = $el.find('.mark')[0]
      // .prop() values are not cloned (as for native elements): set them before inserting the clone
      const $c = $el.clone().removeAttr('id')
      if (spec.props) $c.prop(spec.props)
      $c.appendTo('#stage'); ES.flush()
      const ids = {}; let dup = 0; document.querySelectorAll('[id]').forEach((e) => { if (ids[e.id]) dup++; ids[e.id] = 1 })
      return { rendered: spec.probe ? $c.find(spec.probe).length > 0 : !!$c[0].esComponent, other: $c[0].esComponent && $c[0].esComponent.$.uid !== $el[0].esComponent.$.uid, cmark: $c.find('.mark').length, omark: $el.find('.mark')[0] === mark, dup, stale: $c.children('es-slots').length <= 1 }
    }, s.i)
    ok('clone renders independently, slot copied, original intact, no duplicate ids', cl.rendered && cl.other && cl.omark && cl.dup === 0 && (!s.slot || s.slotWhenOpen || cl.cmark >= 1), JSON.stringify(cl))
    await ev((i) => $('#stage ' + SPECS[i].tag).slice(1).closest('#stage > *').remove(), s.i)
    // 5 .html() on the host: new slot content, remount, never dead
    const hh = await ev((i) => {
      const spec = SPECS[i], $el = $('#stage ' + spec.tag).first(), u = $el[0].esComponent.$.uid
      const slotAttr = spec.slot && /slot="([^"]+)"/.exec(spec.slot)
      const inner = spec.tag === 'es-radio-group' ? '<es-radio value="z" label="Z" class="mark2"></es-radio>' : `<span class="mark2"${slotAttr ? ` slot="${slotAttr[1]}"` : ''}>new</span>`
      $el.html(inner); ES.flush()
      return { rendered: spec.probe ? $el.find(spec.probe).length > 0 : !!$el[0].esComponent, remount: $el[0].esComponent && $el[0].esComponent.$.uid !== u, mark2: $el.find('.mark2').length, oldMark: $el.find('.mark').length, model: JSON.stringify($el.prop(spec.modelName || 'modelValue')) }
    }, s.i)
    ok('.html(x) on host: remounts with x as slot content', hh.rendered && hh.remount && hh.oldMark === 0 && (!s.slot || s.slotWhenOpen || hh.mark2 >= 1), JSON.stringify(hh))
    const em = await ev((i) => { const spec = SPECS[i], $el = $('#stage ' + spec.tag).first(); $el.empty(); ES.flush(); return { rendered: spec.probe ? $el.find(spec.probe).length > 0 : !!$el[0].esComponent, mark2: $el.find('.mark2').length } }, s.i)
    ok('.empty() on host: still renders, no slot content', em.rendered && em.mark2 === 0, JSON.stringify(em))
    // 6 .text() on host
    const tx = await ev((i) => { const spec = SPECS[i], $el = $('#stage ' + spec.tag).first(); $el.text('Plain'); ES.flush(); return { rendered: spec.probe ? $el.find(spec.probe).length > 0 : !!$el[0].esComponent } }, s.i)
    ok('.text() on host: still renders', tx.rendered, JSON.stringify(tx))
    // 7 overlay: open, then .remove() while open
    const base = await ev(() => ({ portal: document.querySelector('es-portal').childElementCount, body: document.body.childElementCount, top: ES.stats().top, dialogs: document.querySelectorAll('[role=dialog],[role=listbox],[role=menu],[data-slot=content][data-state=open]').length }))
    if (s.open || s.openProp) {
      // restore slot content for the open check
      await ev((i) => { const spec = SPECS[i]; $('#stage').empty(); make(spec) }, s.i)
      if (s.openProp) await ev((i) => { $('#stage ' + SPECS[i].tag).prop(SPECS[i].openProp, true) }, s.i)
      else await p.click(`#stage ${s.name.split('(')[0]} ${s.open}`, { timeout: 3000 }).catch((e) => console.log('  open click', e.message.split('\n')[0]))
      await W(350)
      const o = await ev((i) => ({ portal: document.querySelector('es-portal').childElementCount, open: document.querySelectorAll('[role=dialog],[role=listbox],[role=menu],[data-slot=content][data-state=open]').length, markInPortal: !!document.querySelector('es-portal .mark') }), s.i)
      ok('overlay opens into es-portal', o.open > base.dialogs && (!s.slotWhenOpen || o.markInPortal), JSON.stringify(o))
      await ev((i) => $('#stage ' + SPECS[i].tag).remove(), s.i)
      await W(400)
      const a = await ev(() => ({ portal: document.querySelector('es-portal').childElementCount, body: document.body.childElementCount, open: document.querySelectorAll('[role=dialog],[role=listbox],[role=menu],[data-slot=content][data-state=open]').length, mark: document.querySelectorAll('.mark').length, top: ES.stats().top }))
      ok('.remove() while open: overlay, slot nodes and teleports gone', a.open === base.dialogs && a.mark === 0 && a.body === base.body, JSON.stringify({ base, a }))
      await p.keyboard.press('Escape'); await W(100)
    }
    // 8 .remove() and ancestor .empty()
    const rm = await ev((i) => {
      const spec = SPECS[i]; $('#stage').empty(); const t0 = ES.stats().top
      const $a = make(spec), $b = make(spec); const t1 = ES.stats().top
      $a.remove(); const t2 = ES.stats().top
      $('#stage').empty(); const t3 = ES.stats().top
      return { t0, t1, t2, t3, nested: document.querySelectorAll('#stage es-radio').length }
    }, s.i)
    ok('.remove() unmounts at once; ancestor .empty() unmounts all', rm.t1 === rm.t0 + 2 && rm.t2 === rm.t0 + 1 && rm.t3 === rm.t0, JSON.stringify(rm))
    } catch (e) { ok('exception (later ops skipped)', false, e.message.split('\n').slice(0, 3).join(' | ')); await ev(() => { try { $('#stage').empty() } catch (e) {} }).catch(() => {}) }
  }
  // leak check after everything
  await W(300)
  const fin = await ev(() => ({ top: ES.stats().top, portal: document.querySelector('es-portal').childElementCount, portalHtml: document.querySelector('es-portal').innerHTML.slice(0, 200), stage: $('#stage').children().length }))
  r('after the last spec: no top-level entries, portal empty', fin.top === 0 && fin.portal <= 2, JSON.stringify(fin))
  require('fs').writeFileSync(__dirname + '/desk-matrix' + (process.env.PROTO ? '-proto' : '') + '.json', JSON.stringify(per, null, 1))
}, { api: () => ({}) })
