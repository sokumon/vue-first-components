// jQuery-driven re-run of wc/sweep/framework-ui/t-fields.cjs + Desk-style operations per field.
require('./lib.cjs')('fields.html', async ({ p, r, txt, st, ev, W, vis, safe, calls, pageErrs, mark }) => {
  const ch = () => p.$eval('#changes', (e) => e.textContent)
  const S = async () => (await st()).doc
  let s
  await safe('es-fw-text-field', 'core', async () => {
    const t = 'es-fw-text-field'
    r(t, 'initial value from .prop(modelValue)', (await p.inputValue('#f-data input')) === 'Ada')
    r(t, 'label + description from .prop(field)', /Data field/.test(await txt('#f-data')) && /Plain text/.test(await txt('#f-data')), await txt('#f-data'))
    await p.fill('#f-data input', 'Grace'); s = await S()
    r(t, 'typing -> update:modelValue', s.data === 'Grace', s.data)
    await p.locator('#f-data input').blur(); await W(100)
    r(t, 'change on commit (component event, exactly once)', (await ch()) === 'data="Grace"', await ch())
    r(t, 'element keeps v-model value (el.modelValue)', await ev(() => document.getElementById('f-data').modelValue === 'Grace'))
  })
  await safe('es-fw-textarea-field', 'core', async () => { await p.fill('#f-notes textarea', 'two\nlines'); r('es-fw-textarea-field', 'v-model', (await S()).notes === 'two\nlines') })
  await safe('es-fw-password-field', 'core', async () => {
    await p.fill('#f-pw input', 's3cret'); r('es-fw-password-field', 'v-model', (await S()).pw === 's3cret')
    r('es-fw-password-field', 'masked', (await p.getAttribute('#f-pw input', 'type')) === 'password')
  })
  await safe('es-fw-phone-field', 'core', async () => { await p.fill('#f-phone input', '+1 555'); r('es-fw-phone-field', 'v-model', (await S()).phone === '+1 555') })
  await safe('es-fw-number-field', 'core', async () => {
    const t = 'es-fw-number-field'
    r(t, 'Float formatted', (await p.inputValue('#f-hours input')) === '1.50', await p.inputValue('#f-hours input'))
    await p.click('#f-hours input'); await p.fill('#f-hours input', '12.345'); await p.keyboard.press('Tab'); await W(100)
    s = await S(); r(t, 'Float parses to number + change', (s.hours === 12.345 || s.hours === 12.35) && /hours=/.test(await ch()), JSON.stringify(s.hours) + ' ' + (await ch()))
    r(t, 'Int initial', (await p.inputValue('#f-qty input')) === '3', await p.inputValue('#f-qty input'))
    await p.fill('#f-qty input', '7'); await p.keyboard.press('Tab'); await W(50)
    r(t, 'Int v-model number', (await S()).qty === 7, JSON.stringify((await S()).qty))
    r(t, 'Currency shows value', /10/.test(await p.inputValue('#f-amt input')), await p.inputValue('#f-amt input'))
  })
  await safe('es-fw-check-field', 'core', async () => {
    const t = 'es-fw-check-field', cb = '#f-done input[type=checkbox], #f-done button[role=checkbox]'
    r(t, 'starts unchecked', !(await p.isChecked(cb).catch(() => true)))
    await p.click(cb); await W(100)
    r(t, 'click -> 1 + change', (await S()).done === 1 && (await ch()).includes('done=1'), (await S()).done + ' ' + (await ch()))
    await p.focus(cb); await p.keyboard.press('Space'); await W(100)
    r(t, 'keyboard Space -> 0', (await S()).done === 0, (await S()).done)
  })
  await safe('es-fw-select-field', 'core', async () => {
    const t = 'es-fw-select-field'
    await p.click('#f-status button'); await W(300)
    await p.click('[role=option]:has-text("Closed")'); await W(200)
    r(t, 'picks option', (await S()).status === 'Closed', (await S()).status)
    r(t, 'trigger shows value', /Closed/.test(await txt('#f-status')))
    await p.focus('#f-status button'); await p.keyboard.press('Enter'); await W(250)
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await W(200)
    r(t, 'keyboard Enter/ArrowDown/Enter picks next', (await S()).status === 'Cancelled', (await S()).status)
  })
  await safe('es-fw-autocomplete-field', 'core', async () => {
    const t = 'es-fw-autocomplete-field'
    await p.click('#f-fruit input'); await W(300)
    const opts = await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim()))
    r(t, 'lists options on click', opts.join(',').includes('Banana'), opts.join(','))
    await p.click('[role=option]:has-text("Banana")').catch(() => {}); await W(200)
    r(t, 'pick', (await S()).fruit === 'Banana', (await S()).fruit)
    await p.keyboard.press('Escape')
  })
  await safe('es-fw-link-field', 'core', async () => {
    const t = 'es-fw-link-field'
    await p.click('#f-user input'); await W(300)
    await p.keyboard.type('grace'); await W(800)
    const lo = await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim().replace(/\s+/g, ' ')))
    r(t, 'fetches search_link with txt', calls.some((c) => c.method === 'frappe.desk.search.search_link' && c.body.txt === 'grace' && c.body.doctype === 'User'))
    r(t, 'shows options', lo.some((x) => x.includes('Grace Hopper')), lo.join('|'))
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await W(200)
    s = await S(); r(t, 'keyboard select -> v-model + change', s.user === 'grace@example.com' && (await ch()).includes('user="grace@example.com"'), s.user + ' ' + (await ch()))
    await p.keyboard.press('Escape')
  })
  await safe('es-fw-dynamic-link-field', 'core', async () => {
    r('es-fw-dynamic-link-field', '.prop(row, doc) -> enabled', !(await p.isDisabled('#f-dyn input')))
    r('es-fw-dynamic-link-field', 'without row/DocKey disabled', await p.isDisabled('#f-dyn-norow input'))
  })
  await safe('es-fw-date-field', 'core', async () => {
    const t = 'es-fw-date-field'
    r(t, 'displays value', /2026|Nov|20/.test(await p.inputValue('#f-due input').catch(() => '')), await p.inputValue('#f-due input').catch(() => 'ERR'))
    await p.click('#f-due input'); await W(400)
    const day = p.locator('[role=dialog] :text-is("25"), [data-reka-popper-content-wrapper] :text-is("25")').first()
    if (await day.count()) { await day.click(); await W(200) }
    r(t, 'picker picks a day', (await S()).due === '2026-11-25', (await S()).due)
    await p.keyboard.press('Escape')
  })
  await safe('es-fw-datetime-field', 'core', async () => r('es-fw-datetime-field', 'displays value', /10:30|2026/.test(await p.inputValue('#f-at input').catch(() => '')), await p.inputValue('#f-at input').catch(() => 'ERR')))
  await safe('es-fw-time-field', 'core', async () => r('es-fw-time-field', 'displays value', /9:15|09:15/.test(await p.inputValue('#f-tm input').catch(() => '')), await p.inputValue('#f-tm input').catch(() => 'ERR')))
  await safe('es-fw-duration-field', 'core', async () => {
    const d = (await txt('#f-dur')) + ' / ' + (await p.$$eval('#f-dur input', (e) => e.map((x) => x.value).join(',')))
    r('es-fw-duration-field', 'displays value', /1h|1 h|01:00|3600|\b1\b/.test(d), d)
  })
  await safe('es-fw-rating-field', 'core', async () => {
    const t = 'es-fw-rating-field'
    const stars = await p.$$('#f-stars button[data-slot=star]')
    const states = () => p.$$eval('#f-stars button[data-slot=star]', (e) => e.map((x) => x.dataset.state).join(','))
    r(t, '5 stars, 0.4 -> 2 filled', stars.length === 5 && (await states()) === 'filled,filled,empty,empty,empty', stars.length + ' ' + (await states()))
    if (stars.length >= 4) { const bb = await stars[3].boundingBox(); await p.mouse.move(bb.x + bb.width * 0.85, bb.y + bb.height / 2); await p.mouse.click(bb.x + bb.width * 0.85, bb.y + bb.height / 2); await W(200) }
    r(t, 'click 4th star -> 0.8', Math.abs((await S()).stars - 0.8) < 0.01, (await S()).stars + ' ' + (await states()))
  })
  await safe('es-fw-color-field', 'core', async () => {
    const t = 'es-fw-color-field'
    r(t, 'hex shown', (await p.inputValue('#f-color input')).toLowerCase().includes('ff0000'), await p.inputValue('#f-color input'))
    const sw = await p.$('#f-color button[data-slot=swatch]')
    r(t, 'swatch teleported into the field row', !!sw)
    if (sw) { await sw.click(); await W(400); const pick = await p.$$('[data-reka-popper-content-wrapper] button'); if (pick[1]) { await pick[1].click(); await W(200) } }
    r(t, 'pick -> change', (await ch()).includes('color='), await ch())
    await p.keyboard.press('Escape')
  })
  await safe('es-fw-heading-field', 'core', async () => r('es-fw-heading-field', 'renders label', (await txt('#f-heading h4')) === 'Section heading'))
  await safe('es-fw-html-field', 'core', async () => r('es-fw-html-field', 'sanitized', (await txt('#html-p')) === 'Hello bold' && !(await ev(() => window.__xss)), await p.$eval('#f-html', (e) => e.innerHTML.slice(0, 200))))
  await safe('es-fw-button-field', 'core', async () => {
    await p.click('#f-btn button'); await W(100)
    r('es-fw-button-field', 'native click bubbles to host .on(click), once', ((await ch()).match(/btn=1/g) || []).length === 1, await ch())
    await p.focus('#f-btn button'); await p.keyboard.press('Enter'); await W(100)
    r('es-fw-button-field', 'keyboard Enter clicks', ((await ch()).match(/btn=1/g) || []).length === 2, await ch())
  })
  await safe('es-fw-image-field', 'core', async () => r('es-fw-image-field', 'uses modelValue', (await p.getAttribute('#f-img img', 'src').catch(() => null)) === 'http://jq.test/dist/none.png'))
  await safe('es-fw-code-editor-field', 'core', async () => {
    const cm = await p.$('#f-json .cm-content')
    r('es-fw-code-editor-field', 'renders codemirror', !!cm)
    if (cm) { await cm.click(); await p.keyboard.press('Control+End'); await p.keyboard.type(' '); await W(500) }
    r('es-fw-code-editor-field', 'typing -> v-model', (await S()).json !== '{"a": 1}', JSON.stringify((await S()).json))
  })
  await safe('es-fw-geolocation-field', 'core', async () => {
    const t = 'es-fw-geolocation-field'
    r(t, 'summary of initial point', /12\.9|77\.5/.test(await p.inputValue('#f-loc input')), await p.inputValue('#f-loc input'))
    await p.click('#f-loc input'); await W(1500)
    r(t, 'dialog with leaflet map + marker', !!(await p.$('[role=dialog] .leaflet-container')) && !!(await p.$('[role=dialog] .leaflet-marker-icon')))
    await p.click('[role=dialog] button:has-text("Save")').catch(() => {}); await W(300)
    s = await S(); r(t, 'Save -> geojson v-model, dialog closed', typeof s.loc === 'string' && s.loc.includes('FeatureCollection') && !(await p.$('[role=dialog]')), String(s.loc).slice(0, 100))
  })
  await safe('es-fw-table-multi-select-field', 'core', async () => {
    const t = 'es-fw-table-multi-select-field'
    await p.click('#f-tags input, #f-tags button').catch(() => {}); await W(800)
    const tm = await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim().replace(/\s+/g, ' ')))
    r(t, 'options from search_link', tm.some((x) => x.includes('Ada')), tm.join('|'))
    await p.click('[role=option]:has-text("Ada")').catch(() => {}); await W(300); await p.keyboard.press('Escape')
    s = await S(); r(t, '-> child rows', Array.isArray(s.tags) && s.tags[0] && s.tags[0].tag === 'ada@example.com', JSON.stringify(s.tags))
  })
  await safe('es-fw-table-field', 'core', async () => {
    const t = 'es-fw-table-field'
    const mt = mark()
    await p.click('#f-rows button:has-text("Add Row")'); await W(400)
    s = await S(); r(t, 'add row -> v-model', Array.isArray(s.rows) && s.rows.length === 1, JSON.stringify(s.rows))
    const tr = await p.$$eval('#f-rows .grid-row', (e) => e.map((x) => x.querySelectorAll('.grid-cell[data-fieldname=item] input, .grid-cell[data-fieldname=item] textarea').length))
    r(t, 'row drawn with an editor (standalone, no FormLayout; needs ResolveFieldKey provided app-wide)', tr.length === 1 && tr[0] >= 1, JSON.stringify(tr) + ' frameworkUI exposed=' + (await ev(() => !!(ES.frameworkUI && ES.frameworkUI.ResolveFieldKey))))
    r(t, 'no render errors drawing the row', pageErrs(mt).length === 0, pageErrs(mt).join('|'))
  })
  await safe('es-fw-attach-field', 'core', async () => {
    const t = 'es-fw-attach-field'
    await p.click('#f-att input'); await W(1000)
    const dlg = await p.$('[role=dialog]')
    r(t, 'opens upload dialog', !!dlg)
    const fi = await p.$('input[type=file]')
    if (fi) {
      await fi.setInputFiles({ name: 'hello.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }); await W(400)
      await p.getByRole('dialog').getByRole('button', { name: 'Upload', exact: true }).click().catch(() => {}); await W(1500)
    }
    s = await S(); r(t, 'upload -> file_url v-model', s.att === '/files/hello.txt', JSON.stringify(s.att))
  })
  r('page', 'no page errors in core scenarios apart from TableField (native change never reaches .on(change) handlers)', pageErrs().filter((e) => !/is not a function/.test(e)).length === 0, pageErrs().join(' | '))

  // ------------------------------------------------------------ Desk-style jQuery operations
  const mDesk = mark()
  await safe('es-fw-text-field', 'desk', async () => {
    const m0 = mark(); const t = 'es-fw-text-field'
    // HTML string inside a larger jQuery template, field given as JSON attribute (Desk frappe.ui.form.make_control shape)
    await ev(() => {
      const $w = $(`<div class="frappe-control" data-fieldname="t1"><div class="help">help</div>
        <es-fw-text-field id="d-text" field='{"fieldname":"t1","fieldtype":"Data","label":"From template"}' model-value="tpl"></es-fw-text-field></div>`)
      own($w.find('es-fw-text-field'), 'update:modelValue', (v) => S.log.push('t1=' + v))
      $w.appendTo('#desk')
    }); await W(100)
    r(t, 'created from HTML string in a template, JSON field attr -> label + value', /From template/.test(await txt('#d-text')) && (await p.inputValue('#d-text input')) === 'tpl', await txt('#d-text'))
    // template appended first, props set after (very common: build markup, then wire up)
    const ml = mark(); const late = await ev(() => {
      const errs = []; const h = (e) => errs.push(e.message); window.addEventListener('error', h)
      const $w = $('<div class="frappe-control"><es-fw-text-field id="d-late"></es-fw-text-field></div>').appendTo('#desk')
      const ok1 = $w.find('es-fw-text-field').length
      $w.find('es-fw-text-field').prop('field', { fieldname: 'late', fieldtype: 'Data', label: 'Late props' }).prop('modelValue', 'L')
      window.removeEventListener('error', h)
      return { ok1, errs }
    }); await W(150)
    r(t, 'template appended BEFORE .prop(field): no crash, renders once props arrive', /Late props/.test(await txt('#d-late')) && (await p.inputValue('#d-late input').catch(() => '')) === 'L', JSON.stringify(late) + ' ' + await txt('#d-late'))
    r(t, 'no console error while the element sat connected without its required field prop', pageErrs(ml).length === 0, pageErrs(ml).join('|'))
    const mb = mark()
    await ev(() => ES.batch(() => { const $w = $('<div class="frappe-control"><es-fw-text-field id="d-late2"></es-fw-text-field></div>').appendTo('#desk'); $w.find('es-fw-text-field').prop('field', { fieldname: 'late2', fieldtype: 'Data', label: 'Batched' }) })); await W(100)
    r(t, 'same order inside ES.batch(): renders once with props, no console error', /Batched/.test(await txt('#d-late2')) && pageErrs(mb).length === 0, pageErrs(mb).join('|'))
    // .prop(modelValue) from the page after mount (frappe control set_value)
    await ev(() => $('#f-data').prop('modelValue', 'Set by page')); await W(50)
    r(t, '.prop(modelValue) after mount updates the input', (await p.inputValue('#f-data input')) === 'Set by page')
    // .prop(field, {...same, label changed})
    await ev(() => $('#f-data').prop('field', Object.assign({}, F.data, { label: 'Relabelled', reqd: 1 }))); await W(50)
    r(t, '.prop(field, new object) relabels', /Relabelled/.test(await txt('#f-data')), await txt('#f-data'))
    // in-place mutation of the same field object + re-set the same reference (Desk: df.label = x; refresh)
    await ev(() => { const f = $('#f-data').prop('field'); f.label = 'Mutated'; $('#f-data').prop('field', f) }); await W(50)
    r(t, 'in-place mutation of the field object + .prop(field, sameRef) re-renders', /Mutated/.test(await txt('#f-data')), await txt('#f-data'))
    // .attr('disabled'/'readonly') if the component has such props
    const hasRO = await ev(() => { const d = ES.def('es-fw-text-field'); return [...d.props.keys()].join(',') })
    r(t, 'props of the field element (for reference)', true, hasRO)
    // detach + reappend keeps typed state
    await p.fill('#f-data input', 'typed'); await W(50)
    await ev(() => $('#f-data').detach().appendTo('#desk')); await W(100)
    r(t, '.detach().appendTo() keeps value and stays live', (await p.inputValue('#f-data input')) === 'typed' && await vis('#f-data input'))
    await p.fill('#f-data input', 'after move'); await W(50)
    r(t, 'events still reach the page after the move', (await S()).data === 'after move', (await S()).data)
    // .empty() on host: remount, props and listeners kept
    await ev(() => $('#f-data').empty()); await W(100)
    r(t, '.empty() on host remounts with props kept', (await p.inputValue('#f-data input').catch(() => 'GONE')) === 'after move' && /Mutated/.test(await txt('#f-data')), await p.inputValue('#f-data input').catch(() => 'GONE'))
    await p.fill('#f-data input', 'after empty'); await W(50)
    r(t, 'listeners kept after .empty()', (await S()).data === 'after empty')
    // .html('<b>') on host: there is no default slot -> content kept as slot content, component remounts
    await ev(() => $('#f-data').html('<span id="junk">junk</span>')); await W(100)
    r(t, '.html(x) on host: component still rendered', !!(await p.$('#f-data input')), await p.$eval('#f-data', (e) => e.innerHTML.slice(0, 200)))
    // clone
    await ev(() => { $('#d-text').clone().attr('id', 'd-text-c').appendTo('#desk') }); await W(150)
    r(t, '.clone() of attr-configured field renders independently', /From template/.test(await txt('#d-text-c')) && (await p.inputValue('#d-text-c input')) === 'tpl')
    await p.fill('#d-text-c input', 'clone typed', { timeout: 1000 }).catch(() => {}); await W(50)
    r(t, 'clone has its own state', (await p.inputValue('#d-text input')) === 'tpl')
    const mc = mark(); const cl2 = await ev(() => { const $c = $('#f-phone').clone().attr('id', 'f-phone-c').appendTo('#desk'); return { field: $c.prop('field'), html: $c.html().length } }); await W(100)
    r(t, '.clone() of a .prop-configured field: props are not copied (contract) - renders without crash', pageErrs(mc).length === 0, JSON.stringify(cl2) + ' ' + pageErrs(mc).slice(-2).join('|'))
    // remove
    await ev(() => { $('#d-text-c').remove(); $('#f-phone-c').remove() }); await W(100)
    r(t, '.remove() unmounts (no leftover rendered nodes)', !(await p.$('#d-text-c')) && (await ev(() => ES.stats().top)) > 0)
  })
  await safe('es-fw-select-field', 'desk', async () => {
    const m0 = mark(); const t = 'es-fw-select-field'
    // detach while menu open, then re-append
    await ev(() => $('#f-status').detach().appendTo('#desk')); await W(100)
    await p.click('#f-status button'); await W(300)
    await p.click('[role=option]:has-text("Open")'); await W(200)
    r(t, 'after .detach().appendTo(): dropdown still positions + picks', (await S()).status === 'Open', (await S()).status)
    await ev(() => $('#f-status').prop('field', Object.assign({}, F.status, { options: 'Open\nClosed\nCancelled\nOn Hold' }))); await W(50)
    await p.click('#f-status button'); await W(300)
    const o = await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim()))
    r(t, '.prop(field) with new options -> menu shows them', o.includes('On Hold'), o.join(','))
    await p.keyboard.press('Escape'); await W(150)
    await ev(() => $('#f-status').remove()); await W(150)
    r(t, '.remove() closes cleanly (no orphan listbox)', !(await p.$('[role=listbox]')) && pageErrs(m0).length === 0, pageErrs(m0).join('|'))
  })
  await safe('es-fw-check-field', 'desk', async () => {
    const m0 = mark(); const t = 'es-fw-check-field'
    const n0 = (await ch()).length
    await ev(() => $('#f-done').prop('modelValue', 1)); await W(50)
    r(t, '.prop(modelValue,1) checks without emitting change', (await p.isChecked('#f-done button[role=checkbox], #f-done input[type=checkbox]')) && (await ch()).length === n0)
    await ev(() => $('#f-done').detach().appendTo('#desk')); await W(50)
    r(t, 'detach/append keeps checked', await p.isChecked('#f-done button[role=checkbox], #f-done input[type=checkbox]'))
  })
  await safe('es-fw-link-field', 'desk', async () => {
    const m0 = mark(); const t = 'es-fw-link-field'
    await ev(() => $('<div class="frappe-control"><es-fw-link-field id="d-link"></es-fw-link-field></div>').find('es-fw-link-field').prop('field', F.user).end().appendTo('#desk')); await W(150)
    await p.click('#d-link input'); await W(400)
    const o = await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim()))
    r(t, 'built in a fragment with .find().prop() then appended: opens + lists', o.some((x) => /Ada/.test(x)), o.join('|'))
    await p.keyboard.press('Escape'); await W(100)
    await ev(() => $('#d-link').closest('.frappe-control').remove()); await W(150)
    r(t, '.remove() of the wrapper unmounts the field', !(await p.$('#d-link')) && pageErrs(m0).length === 0)
  })
  await safe('es-fw-date-field', 'desk', async () => {
    const m0 = mark(); const t = 'es-fw-date-field'
    await ev(() => $('#f-due').prop('modelValue', '2026-01-02')); await W(50)
    r(t, '.prop(modelValue) shows new date', /2026-01-02|Jan/.test(await p.inputValue('#f-due input')), await p.inputValue('#f-due input'))
    await ev(() => $('#f-due').detach().appendTo('#desk')); await W(100)
    await p.click('#f-due input'); await W(400)
    const pop = await p.$('[data-reka-popper-content-wrapper]')
    const pr = pop ? await pop.boundingBox() : null, ir = await p.$eval('#f-due input', (e) => e.getBoundingClientRect().toJSON())
    r(t, 'after move: picker opens anchored under the input', !!pr && Math.abs(pr.x - ir.x) < 40 && (Math.abs(pr.y - (ir.y + ir.height)) < 20 || Math.abs(pr.y + pr.height - ir.y) < 20), JSON.stringify([pr, ir]))
    await p.keyboard.press('Escape')
  })
  await safe('es-fw-table-field', 'desk', async () => {
    const m0 = mark(); const t = 'es-fw-table-field'
    await ev(() => $('#f-rows').prop('modelValue', [{ item: 'A' }, { item: 'B' }])); await W(150)
    r(t, '.prop(modelValue, rows) redraws rows', (await p.$$('#f-rows .grid-row')).length === 2)
    await ev(() => $('#f-rows').detach().appendTo('#desk')); await W(150)
    r(t, 'detach/append keeps rows', (await p.$$('#f-rows .grid-row')).length === 2)
  })
  await safe('es-fw-geolocation-field', 'desk', async () => {
    const m0 = mark(); const t = 'es-fw-geolocation-field'
    await ev(() => $('#f-loc').detach().appendTo('#desk')); await W(200)
    await p.click('#f-loc input'); await W(1200)
    r(t, 'after move: dialog + leaflet map', !!(await p.$('[role=dialog] .leaflet-container')))
    await p.keyboard.press('Escape'); await W(300)
    await ev(() => $('#f-loc').remove()); await W(200)
    r(t, '.remove() no errors', pageErrs(m0).length === 0, pageErrs(m0).join('|'))
  })
  await safe('es-fw-code-editor-field', 'desk', async () => {
    const m0 = mark(); const t = 'es-fw-code-editor-field'
    await ev(() => $('#f-json').prop('modelValue', '{"b": 2}')); await W(200)
    r(t, '.prop(modelValue) updates codemirror', /"b": 2/.test(await txt('#f-json .cm-content')), await txt('#f-json .cm-content'))
    await ev(() => $('#f-json').detach().appendTo('#desk')); await W(200)
    r(t, 'detach/append keeps the editor content', /"b": 2/.test(await txt('#f-json .cm-content')))
    await ev(() => $('#f-json').remove()); await W(150)
  })
  await safe('es-fw-rating-field', 'desk', async () => {
    const m0 = mark()
    await ev(() => $('#f-stars').prop('modelValue', 1)); await W(50)
    r('es-fw-rating-field', '.prop(modelValue,1) -> 5 filled', (await p.$$eval('#f-stars [data-slot=star][data-state=filled]', (e) => e.length)) === 5, await p.$$eval('#f-stars [data-slot=star]', (e) => e.map((x) => x.dataset.state).join()) + ' model=' + (await ev(() => $('#f-stars').prop('modelValue'))))
    await ev(() => $('#f-stars').clone().attr('id', 'f-stars-c').prop('field', F.stars).prop('modelValue', 0.2).appendTo('#desk')); await W(100)
    r('es-fw-rating-field', 'clone + .prop renders its own value', (await p.$$eval('#f-stars-c [data-slot=star][data-state=filled]', (e) => e.length)) === 1)
  })
  r('page', 'page errors during Desk operations (all)', true, pageErrs(mDesk).join(' | '))
}, {
  wait: 1200,
  api: (m) => (m === 'upload_file' ? { name: 'F1', file_name: 'hello.txt', file_url: '/files/hello.txt', is_private: 0 } : undefined),
})
