// Shared-app risks.
const { run } = require('./lib.cjs')
run('shared', 'base.html', async ({ p, r, ev, errs }) => {
  const fresh = async (pg = 'base.html') => { await p.goto('http://jq.test/review/pages/' + pg); await p.waitForFunction(() => window.ES && window.jQuery) }
  const probe = () => ev(() => { const $b = $('<es-button label="probe">'); let err = null; try { $b.appendTo('body'); ES.flush() } catch (e) { err = e.message } const ok = $b.find('button').length === 1; return { ok, err } })

  // 1. a Vue-style attribute written in a jQuery template by habit
  await fresh()
  const a = await ev(() => { let err = null; try { $('#stage').html('<es-button label="Vue habit" @click="save"></es-button>'); ES.flush() } catch (e) { err = e.message } return { err, rendered: $('#stage button').length } })
  const a2 = await probe()
  r('an @click attribute on one element does not break the page', a2.ok, { a, after: a2 })

  // 2. render-time error in one element (FieldFor without its required object prop)
  await fresh()
  const b = await ev(() => { let err = null; try { $('<es-fw-text-field>').appendTo('#stage'); $('<es-alert title="t">').prop('description', { toString() { throw new Error('boom in render') } }).appendTo('#stage'); ES.flush() } catch (e) { err = e.message } return { err } })
  const b2 = await probe()
  r('a render-function error in one element is contained (others still render)', b2.ok, { b, after: b2 })

  // 3. a throwing jQuery handler on update:modelValue
  await fresh()
  const c = await ev(async () => {
    const $c = $('<es-checkbox label="x">').appendTo('#stage').on('update:modelValue', () => { throw new Error('handler boom') })
    $c.find('input')[0].click(); ES.flush()
    return { v: $c.prop('modelValue') }
  })
  const c2 = await probe()
  r('a throwing page handler does not break the element or the app', c.v === true && c2.ok, { c, after: c2 })

  // 4. Fragment-root .html() crash (claimed) and what it does to an UNRELATED element already on the page
  await fresh()
  const d = await ev(async () => {
    const $in = $('<es-text-input>').appendTo('#stage2'); ES.flush()
    const $sel = $('<es-select>').prop('options', [{ label: 'A', value: 'a' }]).appendTo('#stage'); ES.flush()
    let err = null; try { $sel.html('<span>x</span>'); ES.flush() } catch (e) { err = e.message }
    let err2 = null; try { $in.prop('modelValue', 'still alive?'); ES.flush() } catch (e) { err2 = e.message }
    await new Promise((r) => setTimeout(r, 100))
    return { err, err2, existingUpdated: $in.find('input').val() }
  })
  r('Fragment-root .html() crash also freezes elements that were already mounted', d.existingUpdated !== 'still alive?', d)

  // 5. memory: 1000 create/remove cycles (mixed elements; jQuery .remove and native innerHTML)
  await fresh()
  const cdp = await p.context().newCDPSession(p)
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); const u = await cdp.send('Runtime.getHeapUsage'); const dc = await cdp.send('Memory.getDOMCounters'); return { mb: +(u.usedSize / 1e6).toFixed(2), nodes: dc.nodes, listeners: dc.jsEventListeners } }
  const html = `<es-button label="b"></es-button><es-text-input placeholder="t"></es-text-input><es-checkbox label="c"></es-checkbox><es-tooltip text="tip"><span>x</span></es-tooltip><es-dialog title="D"><p slot="body-content">body</p></es-dialog><es-badge label="n"></es-badge>`
  const cycle = (n, mode) => ev(async ([n, html, mode]) => {
    for (let i = 0; i < n; i++) {
      if (mode === 'jq') { const $x = $('<div>').html(html).appendTo('#stage'); ES.flush(); $x.remove() }
      else { const st = document.getElementById('stage'); st.innerHTML = html; await new Promise((r) => setTimeout(r)); st.innerHTML = '' }
      if (i % 50 === 0) await new Promise((r) => setTimeout(r))
    }
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 200)))
    return { stats: ES.stats(), portal: document.querySelector('es-portal').children.length }
  }, [n, html, mode])
  for (const mode of ['jq', 'native']) {
    await cycle(100, mode); const h0 = await heap()
    await cycle(1000, mode); const h1 = await heap()
    const s = await cycle(1000, mode); const h2 = await heap()
    const per = ((h2.mb - h1.mb) / 1000) * 1e3
    r(`memory ${mode}: 1000 create/remove cycles retain < 1 KB/cycle; no leaked entries`, per < 1 && s.stats.top === 0, { h0, h1, h2, perCycleKB: per.toFixed(2), s })
  }
  const after = await probe()
  r('  page still works after 2000+ cycles', after.ok, after)

  // 6. child defined/connected before parent: bundle loaded after the markup exists
  await p.goto('http://jq.test/review/pages/lazy.html')
  const lz = await Promise.race([
    p.waitForFunction(() => window.LOADED, null, { timeout: 15000 }).then(() => p.waitForTimeout(800)).then(() => ev(() => {
      const chain = (el) => { const o = []; for (let i = el && el._es && el._es.node; i; i = i.parent) o.push(i.type.name || i.type.__name); return o.join('<') }
      return {
        tabs: $('#t [role=tab]').length, panels: $('#t [role=tabpanel]').length, triggerChain: chain($('#t es-tab-trigger')[0]).slice(0, 160),
        radios: $('#rg [role=radio]').length, radioUnderGroup: chain($('#rg es-radio')[0]).includes('RadioGroup'),
        navItems: $('#mn [data-slot=mobile-nav-item]').length, tip: $('#tt').length,
        top: ES.stats().top,
      }
    })),
    new Promise((res) => setTimeout(() => res({ hang: true }), 20000)),
  ]).catch((e) => ({ err: e.message.slice(0, 200) }))
  r('markup present before the bundle loads (lazy load): children upgraded before parents still end up inside their parent', lz.tabs === 2 && lz.radios === 2 && lz.radioUnderGroup && lz.triggerChain.includes('Tabs'), lz)
  // 6b. a child element connected at top level first, then moved into its parent
  await fresh()
  const mv = await Promise.race([ev(async () => {
    const $trig = $('<es-tab-list><es-tab-trigger value="a" label="A"></es-tab-trigger></es-tab-list>').appendTo('#stage'); ES.flush()
    const $tabs = $('<es-tabs model-value="a">').appendTo('#stage2'); ES.flush()
    $trig.appendTo($tabs); ES.flush()
    await new Promise((r) => setTimeout(r, 300))
    return { tabs: $tabs.find('[role=tab]').length, top: ES.stats().top }
  }), new Promise((res) => setTimeout(() => res({ hang: true }), 8000))])
  r('child built first at top level, then appended into its parent', mv.tabs === 1, mv)
})
