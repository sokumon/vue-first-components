// jQuery-driven re-run of wc/sweep/overlays/t-tabs.cjs + Desk-style operations.
require('./lib.cjs')('tabs.html', async ({ p, r, txt, st, ev, W, vis, rect, inside, log, safe }) => {
  const later = []
  const desk = (t, f) => later.push([t, f])
  const tabs = (root) => p.$$eval(root + ' [role=tab]', (es) => es.map((e) => e.innerText.trim().replace(/\n/g, ' ') + ':' + e.getAttribute('data-state') + (e.disabled || e.hasAttribute('data-disabled') ? ':dis' : '')))
  const activePanel = (root) => txt(root + ' [role=tabpanel][data-state=active]')
  let t = 'es-tabs (composed: es-tab-list/es-tab-trigger/es-tab-panel)'
  await safe(t, 'core', async () => {
    const ct = await tabs('#ct')
    r(t, '3 triggers inside a tablist', ct.length === 3 && !!(await p.$('#ct [role=tablist] [role=tab]')), ct)
    r(t, 'model-value="two" attribute selects Two', ct.some((x) => x.startsWith('Two') && x.includes(':active')), ct)
    r(t, 'disabled attribute (boolean) on es-tab-trigger', ct[2] && ct[2].endsWith(':dis'), ct)
    r(t, 'suffix slot inside trigger', await p.$eval('#ct-count', (e) => e.closest('[role=tab]') && e.closest('[role=tab]').innerText.includes('Two')).catch(() => false) && (await txt('#ct-count')) === '(3)')
    r(t, 'only panel two visible', await vis('#ct-p2') && !(await vis('#ct-p1')) && !(await vis('#ct-p3')))
    r(t, 'panel inside [role=tabpanel]', await p.$eval('#ct-p2', (e) => !!e.closest('[role=tabpanel]')).catch(() => false))
    r(t, 'trigger aria-controls points at its panel id (one useId counter)', await ev(() => { const tr = document.querySelector('#ct [role=tab][data-state=active]'); const id = tr && tr.getAttribute('aria-controls'); const pnl = id && document.getElementById(id); return !!pnl && pnl.contains(document.getElementById('ct-p2')) }))
    await p.click('#ct [role=tab]:has-text("One")'); await W()
    r(t, 'click One -> update:modelValue on es-tabs host, panel one shown', (await st()).tab === 'one' && await vis('#ct-p1') && !(await vis('#ct-p2')))
    await p.keyboard.press('ArrowRight'); await W()
    r(t, 'ArrowRight activates Two', (await st()).tab === 'two')
    await p.keyboard.press('ArrowRight'); await W()
    r(t, 'disabled Three is skipped', (await st()).tab !== 'three', (await st()).tab)
    await p.click('#inc'); await W()
    r(t, 'jQuery .text() on slot nodes stays visible', (await txt('#ct-count')) === '(4)' && (await txt('#ct-p2')).includes('4'))
    r(t, 'es-tab-trigger is a Vue descendant of TabList and Tabs (one tree)', await ev(() => { const names = []; let i = document.querySelector('#ct es-tab-trigger').esComponent; i = i && i.$; while (i) { names.push(i.type.__name || i.type.name); i = i.parent } return names.includes('TabList') && names.includes('Tabs') }))
  })
  desk(t, async (t) => {
    // add a tab at runtime: jQuery appends a trigger to the list and a panel to the tabs
    await ev(() => { $('#ct es-tab-list').append('<es-tab-trigger value="four" label="Four"></es-tab-trigger>'); $('#ct').append('<es-tab-panel value="four"><p id="ct-p4">Panel four</p></es-tab-panel>') }); await W(200)
    const ct = await tabs('#ct')
    r(t, '.append() a new es-tab-trigger into es-tab-list: 4 triggers', ct.length === 4 && ct[3].startsWith('Four'), ct)
    await p.click('#ct [role=tab]:has-text("Four")'); await W()
    r(t, 'new tab selects and shows its appended panel', (await st()).tab === 'four' && await vis('#ct-p4'))
    // remove a trigger + panel
    await ev(() => { $('#ct es-tab-trigger[value=one]').remove(); $('#ct es-tab-panel[value=one]').remove() }); await W(200)
    r(t, '.remove() a trigger and its panel', (await tabs('#ct')).length === 3 && !(await p.$('#ct-p1')), await tabs('#ct'))
    await p.focus('#ct [role=tab][data-state=active]'); await p.keyboard.press('ArrowLeft'); await W()
    r(t, 'keyboard roving still works after DOM changes', (await st()).tab === 'two', (await st()).tab)
    // .html() on a panel host: new panel content
    await ev(() => $('#ct es-tab-panel[value=two]').html('<p id="ct-p2b">Panel two rewritten</p>')); await W(200)
    r(t, '.html() on es-tab-panel: new content in the active panel', await vis('#ct-p2b') && await p.$eval('#ct-p2b', (e) => !!e.closest('[role=tabpanel]')).catch(() => false))
    // .html() on es-tab-list: replace all triggers with an HTML string
    await ev(() => $('#ct es-tab-list').html('<es-tab-trigger value="two" label="Two!"></es-tab-trigger><es-tab-trigger value="four" label="Four!"></es-tab-trigger>')); await W(200)
    const ct2 = await tabs('#ct')
    r(t, '.html() on es-tab-list with new es-tab-trigger children', ct2.length === 2 && ct2[0].startsWith('Two!') && ct2[0].includes(':active'), ct2)
    await p.click('#ct [role=tab]:has-text("Four!")'); await W()
    r(t, 'rewritten triggers still drive es-tabs', (await st()).tab === 'four' && await vis('#ct-p4'))
    // .detach()/.appendTo() the whole compound
    await ev(() => $('#ct').detach().appendTo('#desk')); await W(200)
    r(t, '.detach().appendTo() whole es-tabs: selection kept, panel shown', (await tabs('#ct')).some((x) => x.startsWith('Four!') && x.includes(':active')) && await vis('#ct-p4'))
    // .clone()
    await ev(() => { const $c = $('#ct').clone(); $c.attr('id', 'ctc').find('[id]').each(function () { this.id = 'c-' + this.id }); $c.appendTo('#desk') }); await W(200)
    const cc = await tabs('#ctc')
    r(t, '.clone() of the compound renders its own triggers', cc.length === 2, cc)
    await p.click('#ctc [role=tab]:has-text("Two!")'); await W()
    r(t, 'clone switches independently of the original', await vis('#c-ct-p2b') && (await st()).tab === 'four' && await vis('#ct-p4'), { s: (await st()).tab })
    await ev(() => $('#ctc').remove()); await W(100)
    r(t, '.remove() of the clone leaves the original working', (await tabs('#ct')).length === 2)
  })

  t = 'es-tabs (shorthand: tabs prop)'
  await safe(t, 'core', async () => {
    const s = await tabs('#st')
    r(t, 'tabs prop renders triggers (condition fn honoured)', s.length === 3 && s[1].startsWith('Beta:active'), s)
    const panels = await p.$$eval('#st [role=tabpanel] .st-panel', (es) => es.length)
    r(t, 'tab-panel slot (one plain node) shown in the active panel', panels === 1 && (await activePanel('#st')).includes('short=b'), panels + ' / ' + await activePanel('#st'))
    await p.click('#st [role=tab]:has-text("Gamma")'); await W()
    r(t, 'click Gamma -> page state, panel follows', (await st()).short === 'c' && (await activePanel('#st')).includes('short=c'))
    await p.click('#st [role=tab]:has-text("Alpha")'); await W(300)
    r(t, 'back to an EARLIER tab keeps the slot', (await st()).short === 'a' && (await activePanel('#st')).includes('short=a'), await activePanel('#st'))
    const s2 = await p.$$eval('#st2 .st2-panel', (es) => es.map((e) => e.innerText + ':' + e.getAttribute('data-tab')))
    r(t, '<template slot="tab-panel"> stamped with scope (data-es-text tab.label + es-slot)', s2.length >= 1 && s2.some((x) => x === 'Panel for Ex:x'), s2)
    await p.click('#st2 [role=tab]:has-text("Why")'); await W()
    r(t, 'template slot re-stamped for the new tab', (await activePanel('#st2')) === 'Panel for Why', await activePanel('#st2'))
  })
  desk(t, async (t) => {
    await ev(() => $('#st').prop('tabs', [{ value: 'a', label: 'Alpha' }, { value: 'd', label: 'Delta' }])); await W(200)
    r(t, '.prop("tabs", new) re-renders triggers', (await tabs('#st')).map((x) => x.split(':')[0]).join() === 'Alpha,Delta', await tabs('#st'))
    await ev(() => $('#st').prop('modelValue', 'd')); await W(200)
    r(t, '.prop("modelValue") selects programmatically', (await tabs('#st'))[1].includes(':active'))
  })

  t = 'es-tab-buttons'
  await safe(t, 'core', async () => {
    const tb = await p.$$eval('#tb [data-slot=tab-button]', (es) => es.map((e) => e.innerText.trim() + ':' + (e.getAttribute('data-state') || e.getAttribute('aria-checked'))))
    r(t, 'options render, Week checked', tb.length === 3 && tb.some((x) => x.startsWith('Week') && /active|checked|true/.test(x)), tb)
    await p.click('#tb [data-slot=tab-button]:has-text("Month")'); await W()
    r(t, 'click Month -> update:modelValue + option onClick', (await st()).tb === 'month' && (await log()).includes('month-click'))
    await p.focus('#tb [data-slot=tab-button][data-state=active]'); await p.keyboard.press('ArrowLeft'); await W(400)
    const f = await ev(() => document.activeElement && document.activeElement.innerText.trim())
    await p.keyboard.press('Space'); await W(300)
    r(t, 'ArrowLeft moves focus to Week, Space selects', f === 'Week' && (await st()).tb === 'week', f + ' ' + (await st()).tb)
    const ind = await p.$eval('#tb', (e) => { const i = e.querySelector('[data-slot=tab-indicator]'); const a = e.querySelector('[data-state=active],[aria-checked=true]'); return i && a ? Math.abs(i.getBoundingClientRect().x - a.getBoundingClientRect().x) : -1 })
    r(t, 'sliding indicator sits on the active button', ind >= 0 && ind < 6, ind)
  })
  desk(t, async (t) => {
    await ev(() => $('#tb').detach().appendTo('#desk')); await W(400)
    const ind = await p.$eval('#tb', (e) => { const i = e.querySelector('[data-slot=tab-indicator]'); const a = e.querySelector('[data-state=active],[aria-checked=true]'); return i && a ? Math.abs(i.getBoundingClientRect().x - a.getBoundingClientRect().x) + Math.abs(i.getBoundingClientRect().y - a.getBoundingClientRect().y) : -1 })
    r(t, '.detach().appendTo(): state kept, indicator still on active', (await st()).tb === 'week' && ind >= 0 && ind < 8, ind)
    await ev(() => $('#tb').clone().attr('id', 'tbc').appendTo('#desk').prop('options', [{ value: 'p', label: 'P' }, { value: 'q', label: 'Q' }])); await W(200)
    r(t, '.clone() + .prop("options")', (await p.$$eval('#tbc [data-slot=tab-button]', (es) => es.length)) === 2)
    await ev(() => $('#tb').remove()); await W(100)
    r(t, '.remove()', !(await p.$('#tb')))
  })

  t = 'es-tab-trigger (alone)'
  await safe(t, 'core', async () => {
    r(t, 'outside es-tabs: page survives (other tabs still work)', await (async () => { await p.click('#st [role=tab]:has-text("Alpha")'); await W(); return (await st()).short === 'a' })())
  })
  for (const [t, f] of later) await safe(t, 'desk ops', () => f(t))
})
