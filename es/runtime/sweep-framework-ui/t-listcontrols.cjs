// jQuery-driven re-run of wc/sweep/framework-ui/t-listcontrols.cjs (checks ported 1:1) + Desk-style operations.
const opts = (p) => p.$$eval('[role=option]', (e) => e.filter((x) => x.offsetParent).map((x) => x.innerText.trim().replace(/\s+/g, ' ')));
require('./lib.cjs')('listcontrols.html', async ({ p, r: R, txt, st, ev, W, vis, safe, calls, pageErrs, mark }) => {
  let s, tag = 'es-fw-list-view-shell'
  const r = (k, v, x) => R(tag, k, v, x)
  const T = (t) => { tag = t }

  // Shell: meta fetched once (memoized) though 7 controls ask for it
  const metaCalls = calls.filter((c) => c.method === 'frappe.desk.form.load.getdoctype');
  r('meta fetched via getdoctype (ToDo once + Nope once)', metaCalls.filter((c) => c.body.doctype === 'ToDo').length === 1, metaCalls.map((c) => c.body.doctype).join(','));
  r('shell default table slot from meta', /7 fields in meta/.test(await txt('#c-shell')) && /Status/.test(await txt('#c-shell')));
  r('shell named slot toolbar placed in toolbar region', await p.evaluate(() => { const t = document.getElementById('toolbar-slot'); return !!t.closest('es-slot') && t.closest('#c-shell') && t.parentElement.closest('.border-b') !== null }));
  r('shell footer slot bound + placed', /0 filters · 0 sorts/.test(await txt('#c-shell')) && await p.evaluate(() => !!document.getElementById('footer-slot').closest('.border-t')));
  r('shell custom #table slot replaces default', (await txt('#c-shell2')).includes('custom table for 2 columns') && !(await txt('#c-shell2')).includes('fields in meta'));
  r('shell missing doctype -> error text', /not found for "Nope"/.test(await txt('#c-shell-missing')));

  T('es-fw-sort-by')
  await p.click('#c-sort button'); await p.waitForTimeout(300);
  const so = await opts(p);
  r('SortBy offers meta fields', so.includes('Priority'), so.join('|'));
  await p.click('[role=option]:has-text("Priority")'); await p.waitForTimeout(300);
  s = await st(); r('SortBy add -> v-model', s.sort.length === 1 && s.sort[0].fieldname === 'priority', JSON.stringify(s.sort));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  r('SortBy trigger reflects sort', /Priority|1/.test(await txt('#c-sort')), await txt('#c-sort'));
  r('footer slot reacts (1 sorts)', /1 sorts/.test(await txt('#footer-slot')), await txt('#footer-slot'));

  T('es-fw-filter')
  await p.click('#c-filter button'); await p.waitForTimeout(300);
  const fo = await opts(p);
  r('Filter offers meta fields', fo.includes('Status'), fo.join('|'));
  await p.click('[role=option]:has-text("Status")'); await p.waitForTimeout(500);
  s = await st(); r('Filter add -> v-model', s.filters.length === 1 && s.filters[0].fieldname === 'status', JSON.stringify(s.filters));
  const pop = await p.$('[role=dialog]');
  r('Filter popover opens with a Where row', !!pop && /Where/.test(await pop.innerText()), pop ? (await pop.innerText()).replace(/\s+/g, ' ').slice(0, 120) : 'no popover');
  if (pop) {
    // value control for Select fieldtype
    const valBtn = await p.$('[role=dialog] .w-\\[180px\\] button, [role=dialog] .w-\\[180px\\] input');
    if (valBtn) { await valBtn.click(); await p.waitForTimeout(300); await p.click('[role=option]:has-text("Closed")').catch(() => {}); await p.waitForTimeout(300) }
    s = await st(); r('Filter value -> v-model', s.filters[0] && JSON.stringify(s.filters[0].value).includes('Closed'), JSON.stringify(s.filters));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  }
  r('Filter count badge', /Filter\s*1/.test(await txt('#c-filter')), await txt('#c-filter'));
  T('es-fw-quick-filter')
  await p.click('#c-quick button:has-text("more")').catch(() => {}); await p.waitForTimeout(300);
  r('QuickFilter shares filters (Status quick input shows Closed)', /Closed/.test(await txt('#c-quick')), await txt('#c-quick'));
  // QuickFilter typing
  const qi = await p.$('#c-quick input');
  if (qi) { await qi.fill('bug'); await p.waitForTimeout(600) }
  s = await st(); r('QuickFilter input -> filters v-model', s.filters.some((f) => f.fieldname === 'name' && JSON.stringify(f.value).includes('bug')), JSON.stringify(s.filters));
  T('es-fw-filter')
  await p.click('#c-filter button[aria-label="Clear All Filters"]'); await p.waitForTimeout(300);
  s = await st(); r('Filter clear all', s.filters.length === 0, JSON.stringify(s.filters));

  T('es-fw-group-by')
  await p.click('#c-group button'); await p.waitForTimeout(400);
  const gp = await p.$('[role=dialog]');
  r('GroupBy popover opens', !!gp, gp ? (await gp.innerText()).replace(/\s+/g, ' ').slice(0, 120) : '');
  if (gp) {
    await p.click('[role=dialog] button:has-text("Add Group By")').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[role=dialog] [placeholder="Select field"], [role=dialog] button:has-text("Select field")').catch((e) => console.log('  no field combobox', e.message.slice(0, 60))); await p.waitForTimeout(300);
    await p.click('[role=option]:has-text("Status")').catch(() => {}); await p.waitForTimeout(300);
    await p.click('[role=dialog] button:has-text("Apply")').catch(() => {}); await p.waitForTimeout(300);
  }
  s = await st(); r('GroupBy apply -> v-model', s.groupBy && JSON.stringify(s.groupBy).includes('status'), JSON.stringify(s.groupBy));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  T('es-fw-column-settings')
  await p.click('#c-cols button'); await p.waitForTimeout(400);
  const cp = await p.$('[role=dialog]');
  const colVals = () => p.$$eval('[role=dialog] input', (e) => e.map((x) => x.value).join(','));
  r('ColumnSettings popover lists columns', !!cp && (await colVals()) === 'Status,Priority', await colVals());
  await p.click('[role=dialog] input >> nth=0'); await p.keyboard.press('Control+A'); await p.keyboard.type('State'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  s = await st(); r('ColumnSettings rename (click, type, Enter)', s.columns[0].label === 'State', JSON.stringify(s.columns.map((c) => c.label)));
  const hs = await p.$$('[role=dialog] .column-drag-handle');
  if (hs.length === 2) { const a = await hs[0].boundingBox(), b = await hs[1].boundingBox(); await p.mouse.move(a.x + 10, a.y + 10); await p.mouse.down(); await p.mouse.move(a.x + 10, a.y + 25, { steps: 5 }); await p.mouse.move(b.x + 10, b.y + b.height - 2, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(400) }
  s = await st(); r('ColumnSettings drag reorder (sortablejs)', s.columns[0].fieldname === 'priority', JSON.stringify(s.columns.map((c) => c.fieldname)));
  await p.click('[role=dialog] button:has-text("Add Column")').catch(() => {}); await p.waitForTimeout(300);
  await p.click('[role=option]:has-text("Due Date")').catch(() => {}); await p.waitForTimeout(300);
  s = await st(); r('ColumnSettings add column', s.columns.length === 3 && s.columns.some((c) => c.fieldname === 'date'), JSON.stringify(s.columns.map((c) => c.fieldname)));
  await p.click('[role=dialog] button[aria-label="Remove column"]').catch(() => {}); await p.waitForTimeout(300);
  s = await st(); r('ColumnSettings remove column', s.columns.length === 2, JSON.stringify(s.columns.map((c) => c.fieldname)));
  await p.click('[role=dialog] button:has-text("Reset")').catch(() => {}); await p.waitForTimeout(200);
  await p.click('[role=dialog] button:has-text("Confirm Reset")').catch(() => {}); await p.waitForTimeout(300);
  s = await st(); r('ColumnSettings reset emits', s.resets === 1, JSON.stringify(s.resets));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  r('Escape closed popover', !(await p.$('[role=dialog]')));

  T('es-fw-quick-filter')
  await p.click('#customize'); await p.waitForTimeout(400);
  r('QuickFilter customizing view', /Done/.test(await txt('#c-quick')), await txt('#c-quick'));
  await p.click('#c-quick button:has-text("Done")').catch(() => {}); await p.waitForTimeout(300);
  s = await st(); r('QuickFilter Done -> done event + customizing=false', s.done === 1 && s.customizing === false, JSON.stringify([s.done, s.customizing]));
  r('no page errors in core scenarios', pageErrs().length === 0, pageErrs().join('|'))
  // ------------------------------------------------------------ Desk-style
  const m0 = mark()
  await safe('es-fw-list-view-shell', 'desk', async () => {
    T('es-fw-list-view-shell')
    const q = await ev(() => ({ chain: (() => { const n = []; let i = document.getElementById('c-filter').esComponent; i = i && i.$; while (i) { n.push(i.type.__name || i.type.name); i = i.parent } return n.join('<') })() }))
    r('nested es-fw-filter is a Vue descendant of ListViewShell (one tree)', /ListViewShell/.test(q.chain), q.chain)
    // jQuery appends one more control into the toolbar slot node (inside a handed-out slot node, jQuery owns the DOM)
    await ev(() => { $('#toolbar-slot').append('<es-fw-sort-by id="c-sort2" doctype="ToDo"></es-fw-sort-by>') }); await W(300)
    r('es-fw-sort-by appended into the toolbar slot node renders', /Sort/.test(await txt('#c-sort2')), await txt('#c-sort2'))
    await p.click('#c-sort2 button'); await W(300)
    const so = await opts(p)
    r('appended sort-by opens and lists meta fields (shell meta cache shared)', so.includes('Priority'), so.join('|'))
    await p.keyboard.press('Escape'); await W(200)
    await ev(() => $('#c-sort2').remove()); await W(150)
    r('.remove() the appended control', !(await p.$('#c-sort2')) && pageErrs(m0).length === 0, pageErrs(m0).join('|'))
    // .detach()/.appendTo() the whole list view keeps filters
    await ev(() => $('#c-shell').detach().appendTo('#desk')); await W(300)
    r('.detach().appendTo() whole shell: toolbar + footer kept', /filters/.test(await txt('#footer-slot')) && !!(await p.$('#c-filter button')))
    const before = JSON.stringify((await st()).sort)
    await p.click('#c-sort button >> nth=0'); await W(300)
    s = await st(); r('sort-by still drives update:modelValue after the move', JSON.stringify(s.sort) !== before, before + ' -> ' + JSON.stringify(s.sort))
    await p.keyboard.press('Escape'); await W(200)
    // .html() on the footer slot node (jQuery owns it)
    await ev(() => $('#footer-slot').html('<b id="foot-b">rewritten</b>')); await W(100)
    r('.html() on a slot node stays in place', await p.evaluate(() => !!document.getElementById('foot-b').closest('.border-t')))
    // .html() on the shell2 host: new table slot content
    await ev(() => $('#c-shell2').html('<div slot="table" id="custom-table2">second table</div>')); await W(300)
    r('.html() on a host with a new named slot child: remount shows it', /second table/.test(await txt('#c-shell2')) && !/custom table/.test(await txt('#c-shell2')), await txt('#c-shell2'))
    // clone the missing-doctype shell: attribute-only config, so a full copy
    await ev(() => $('#c-shell-missing').clone().attr('id', 'c-shell-missing2').attr('doctype', 'ToDo').appendTo('#desk')); await W(500)
    r('.clone() + .attr(doctype) renders the default table from meta', /fields in meta|Status/.test(await txt('#c-shell-missing2')), await txt('#c-shell-missing2'))
    // remove whole shell: nested controls unmount with it
    await ev(() => $('#c-shell').remove()); await W(200)
    r('.remove() whole shell (nested elements unmount too, no errors)', !(await p.$('#c-filter')) && pageErrs(m0).length === 0 && !(await p.$('[role=dialog]')), pageErrs(m0).join('|'))
  })
  await safe('es-fw-filter', 'desk', async () => {
    T('es-fw-filter')
    await ev(() => { const $f = $('<es-fw-filter id="d-filter" doctype="ToDo"></es-fw-filter>').prop('modelValue', [{ fieldname: 'status', operator: 'equals', value: 'Open' }]); own($f, 'update:modelValue', (v) => { S.filters = v }); $f.appendTo('#desk') }); await W(400)
    r('standalone filter with .prop(modelValue) shows count 1', /1/.test(await txt('#d-filter')), await txt('#d-filter'))
    await p.click('#d-filter button'); await W(400)
    r('popover opens with the given row', /Where/.test(await txt('[role=dialog]')), await txt('[role=dialog]'))
    await ev(() => $('#d-filter').remove()); await W(200)
    r('.remove() while popover open closes it', !(await p.$('[role=dialog]')) && pageErrs(m0).length === 0, pageErrs(m0).join('|'))
  })
}, { wait: 1200 })
