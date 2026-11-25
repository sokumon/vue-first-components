// jQuery-driven re-run of wc/sweep/framework-ui/t-tables.cjs (checks ported 1:1) + Desk-style operations.
require('./lib.cjs')('tables.html', async ({ p, r: R, txt, st, ev, W, vis, safe, calls, pageErrs, mark }) => {
  let s, tag = 'es-fw-list'
  const r = (k, v, x) => R(tag, k, v, x)
  const T = (t) => { tag = t }

  const cells = (sel) => p.$$eval(sel + ' [role=row], ' + sel + ' .list-row', (e) => e.map((x) => x.innerText.trim().replace(/\s+/g, ' ')));
  T('es-fw-list')
  const lt = await txt('#c-list');
  r('List renders header + 3 rows', /ID\s+Status\s+Hours/.test(lt) && /T-1/.test(lt) && /T-3/.test(lt), lt.replace(/\n/g, ' '));
  await p.click('#c-list [role=checkbox][aria-label="Select T-2"]'); await p.waitForTimeout(200);
  s = await st(); r('List row checkbox -> v-model:selection', JSON.stringify(s.selection) === '["T-2"]', JSON.stringify(s.selection));
  T('es-fw-list-bulk-bar')
  r('BulkBar appears with count', /1 selected/.test(await txt('#c-bulk')), await txt('#c-bulk'));
  await p.click('#c-bulk button:has-text("Archive")'); await p.waitForTimeout(100);
  r('BulkBar action fn prop gets selection', JSON.stringify(await p.evaluate(() => window.__bulk)) === '["T-2"]', JSON.stringify(await p.evaluate(() => window.__bulk)));
  T('es-fw-list')
  await p.focus('#c-list [role=checkbox][aria-label="Select T-3"]'); await p.keyboard.press('Space'); await p.waitForTimeout(200);
  s = await st(); r('List keyboard Space toggles row', s.selection.length === 2, JSON.stringify(s.selection));
  T('es-fw-list-bulk-bar')
  await p.click('#c-bulk button[aria-label="Clear selection"], #c-bulk button:has-text("Clear selection")'); await p.waitForTimeout(400);
  s = await st(); r('BulkBar clear -> selection []', s.selection.length === 0 && !/selected/.test(await txt('#c-bulk')), JSON.stringify(s.selection));
  T('es-fw-list')
  await p.click('#c-list [aria-label="Select all"]'); await p.waitForTimeout(200);
  s = await st(); r('List select all', s.selection.length === 3, JSON.stringify(s.selection));
  await p.click('#c-list [aria-label="Select all"]'); await p.waitForTimeout(200);
  await p.click('#c-list [role=columnheader] >> text=Status').catch(async () => p.click('#c-list :text-is("Status")')); await p.waitForTimeout(200);
  s = await st(); r('List header click -> v-model:sort', s.sort.length === 1 && s.sort[0].fieldname === 'status', JSON.stringify(s.sort));
  // column resize via pointer drag on the handle
  const h = await p.$$('#c-list .cursor-col-resize');
  if (h[0]) { const b = await h[0].boundingBox(); await p.mouse.move(b.x + 2, b.y + 5); await p.mouse.down(); await p.mouse.move(b.x + 60, b.y + 5, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(200) }
  s = await st(); r('List column-resize event (kebab emit name)', s.resized.length >= 1, JSON.stringify(s.resized));
  // ---- slots
  const cellCount = await p.$$eval('#c-list-cell .cellslot', (e) => e.length);
  r('List #cell slot rendered in every cell (9)', cellCount === 9, 'light-DOM cell slot nodes found in ' + cellCount + ' cell(s); rows text: ' + (await txt('#c-list-cell')).replace(/\n/g, ' '));
  const tc = await p.$$eval('#c-list-tpl .tplcell', (e) => e.map((x) => x.textContent));
  r('scoped #cell <template> stamped per cell with slot props', tc.length === 9 && tc[0] === 'name=T-1' && tc.includes('hours=5'), JSON.stringify(tc));
  r('List #empty slot bound', (await txt('#c-list-empty')).includes('Nothing for 3 columns'));
  r('List rowLink (RouterLink) renders the row (needs an installed router)', /T-1/.test(await txt('#c-list-link')), (await txt('#c-list-link')).replace(/\n/g, ' '));
  const href = await p.getAttribute('#c-list-link a[href]', 'href').catch(() => null);
  r('rowLink row is a link to the route', !!href && href.includes('/todo/T-1'), String(href));
  T('es-fw-list-footer')
  r('Footer counts', /3 of 10/.test(await txt('#c-footer')));
  await p.click('#c-footer button:has-text("100")'); await p.waitForTimeout(200);
  s = await st(); r('Footer page size -> v-model:pageSize', s.pageSize === 100, s.pageSize);
  await p.click('#c-footer button:has-text("Load More")', { timeout: 1500 }).catch(() => {}); await p.waitForTimeout(100);
  s = await st(); r('Footer load-more (kebab event)', s.loadMore === 1, s.loadMore);
  T('es-fw-group-by-table')
  const gt = (await txt('#c-gbt')).replace(/\s+/g, ' ');
  r('GroupByTable rows + aggregates + totals', /Open 2 3/.test(gt) && /Closed 1 5/.test(gt) && /Total 3 8/.test(gt), gt);
  await p.click('#c-gbt :text-is("Count")'); await p.waitForTimeout(200);
  s = await st(); r('GroupByTable header sort -> update:groupBy', JSON.stringify(s.gb.sort || []).includes('count'), JSON.stringify(s.gb.sort));
  T('es-fw-grid')
  const gr = (await txt('#c-grid')).replace(/\s+/g, ' ');
  r('Grid renders label, reqd marker, rows', /Items/.test(gr) && /Item \*/.test(gr) && /Apple/.test(gr) && /Pear/.test(gr), gr);
  await p.click('#c-grid button:has-text("Add Row")'); await p.waitForTimeout(300);
  s = await st(); r('Grid Add Row uses newRow fn prop, emits add+change, v-model', s.grows.length === 3 && s.grows[2].item === 'New' && s.gev.includes('add') && s.gev.includes('change'), JSON.stringify(s.grows) + ' ' + s.gev.join(','));
  r('Grid cellError fn marks invalid cell', (await p.$$eval('#c-grid [data-invalid]', (e) => e.length)) === 1, await p.$$eval('#c-grid [data-invalid]', (e) => e.length));
  await p.click('#c-grid [aria-label="Select row 1"]'); await p.waitForTimeout(200);
  await p.click('#c-grid button:has-text("Delete")'); await p.waitForTimeout(300);
  s = await st(); r('Grid select + Delete -> remove event, v-model', s.grows.length === 2 && s.grows[0].item === 'Pear' && s.gev.includes('remove:1'), JSON.stringify(s.grows.map((x) => x.item)) + ' ' + s.gev.join(','));
  // Grid with a scoped #cell editor template (update/commit slot props)
  const gi = await p.$$('#c-grid-tpl input.gcell');
  r('Grid scoped #cell editor stamped per cell', gi.length === 2 * (await st()).grows.length, gi.length);
  if (gi[0]) {
    await p.locator('#c-grid-tpl input.gcell').first().click(); await p.keyboard.press('Control+A'); await p.keyboard.type('Banana'); await p.waitForTimeout(100)
    r('Grid editor keeps focus while typing (slot scope updated in place)', await p.evaluate(() => document.activeElement.classList.contains('gcell') && document.activeElement.value === 'Banana'), await p.evaluate(() => document.activeElement.tagName + ' ' + document.activeElement.value));
    await p.keyboard.press('Tab'); await p.waitForTimeout(300)
  }
  s = await st(); r('Grid editor update() -> v-model, commit() -> commit event', s.grows[0].item === 'Banana' && s.gev.includes('commit:item'), JSON.stringify(s.grows.map((x) => x.item)) + ' ' + s.gev.join(','));
  if (gi[0]) { await p.click('#c-grid-tpl input.gcell >> nth=0'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100) }
  const fi = await p.evaluate(() => { const a = document.activeElement; return a && a.closest('.grid-row') ? a.closest('.grid-row').dataset.idx + ':' + a.className : String(a && a.tagName) });
  r('Grid ArrowDown moves to the editor below', /^2:/.test(fi), fi);
  // (Grid keyboard cell navigation acts on editors drawn by the scoped #cell slot; default cells are text only.)
  T('page'); r('no page errors in core scenarios', pageErrs().length === 0, pageErrs().join('|'))
  // ------------------------------------------------------------ Desk-style
  const m0 = mark()
  await safe('es-fw-list', 'desk', async () => {
    T('es-fw-list')
    await ev(() => { const rows = S.rows.concat([{ name: 'T-4', status: 'Open', hours: 9 }]); S.rows = rows; $('#c-list').prop('rows', rows); $('#c-footer').attr('row-count', rows.length) }); await W(200)
    r('.prop(rows, more) adds a row', /T-4/.test(await txt('#c-list')))
    await p.click('#c-list [role=checkbox][aria-label="Select T-4"]'); await W(150)
    await ev(() => $('#c-list').closest('div').detach().appendTo('#desk')); await W(200)
    r('.detach().appendTo() of the list box keeps selection', (await p.isChecked('#c-list [role=checkbox][aria-label="Select T-4"]').catch(() => false)) && /selected/.test(await txt('#c-bulk')), await txt('#c-bulk'))
    // replace the scoped template with .html() on the host
    await ev(() => $('#c-list-tpl').html('<template slot="cell"><i class="tpl2" data-es-text="value"></i></template>')); await W(200)
    const t2 = await p.$$eval('#c-list-tpl .tpl2', (e) => e.map((x) => x.textContent))
    r('.html(<template slot=cell>) on the host swaps the per-cell template', t2.length === 9 && t2[0] === 'T-1' && !(await p.$('#c-list-tpl .tplcell')), JSON.stringify(t2))
    // clone of a list with a plain cell slot: slot content copied, props re-set
    await ev(() => $('#c-list-cell').clone().attr('id', 'c-list-cell2').prop({ columns: S.cols, rows: S.rows.slice(0, 2) }).appendTo($('<div class="flex h-40 flex-col border mt-2">').appendTo('#desk'))); await W(200)
    const cc = await p.$$eval('#c-list-cell2 .cellslot', (e) => e.length)
    r('.clone() + .prop(columns/rows): cell slot copied into each cell', cc === 6, cc)
    await ev(() => $('#c-list-cell2').remove()); await W(150)
    r('.remove() of the clone', !(await p.$('#c-list-cell2')) && (await p.$$eval('#c-list-cell .cellslot', (e) => e.length)) >= 1)
    // List from an HTML string inside a bigger template with rowLink: router shared app-wide
    await ev(() => $('<section class="h-24 flex flex-col"><h3>Linked</h3><es-fw-list id="c-list-link2" class="flex min-h-0 flex-1 flex-col"></es-fw-list></section>').find('es-fw-list').prop({ columns: S.cols, rows: S.rows.slice(1, 2), rowLink: () => (r) => '/todo/' + r.name }).end().appendTo('#desk')); await W(200)
    r('second rowLink list (router from ES.configure) links its row', ((await p.getAttribute('#c-list-link2 a[href]', 'href').catch(() => '')) || '').includes('/todo/T-2'))
  })
  await safe('es-fw-grid', 'desk', async () => {
    T('es-fw-grid')
    const n = (await st()).grows.length
    await ev(() => { const v = S.grows.concat([{ item: 'Fig', qty: 3 }]); S.grows = v; $('#c-grid, #c-grid-tpl').prop('modelValue', v) }); await W(200)
    r('.prop(modelValue) with a new row redraws both grids', (await p.$$('#c-grid-tpl input.gcell')).length === 2 * (n + 1) && /Fig/.test(await txt('#c-grid')), (await p.$$('#c-grid-tpl input.gcell')).length)
    await ev(() => $('#c-grid-tpl').detach().appendTo('#desk')); await W(200)
    await p.locator('#c-grid-tpl input.gcell').last().click().catch(() => {}); await p.keyboard.press('Control+A'); await p.keyboard.type('4'); await p.keyboard.press('Tab'); await W(200)
    r('after detach/append the per-cell editors still update + commit', (await st()).grows.slice(-1)[0].qty == 4 && (await st()).gev.some((x) => x === 'commit:qty'), JSON.stringify((await st()).grows.slice(-1)) + ' ' + (await st()).gev.join(','))
    await ev(() => $('#c-grid').remove()); await W(150)
    r('.remove() grid', !(await p.$('#c-grid')) && pageErrs(m0).length === 0, pageErrs(m0).join('|'))
  })
  await safe('es-fw-list-footer', 'desk', async () => {
    T('es-fw-list-footer')
    await ev(() => $('#c-footer').attr('total-count', '50')); await W(100)
    r('.attr(total-count) shows', /of 50/.test(await txt('#c-footer')), await txt('#c-footer'))
    const ty = await ev(() => [typeof $('#c-footer').prop('rowCount'), typeof $('#c-footer').prop('totalCount'), ES.def('es-fw-list-footer').props.get('rowCount').types.map(String).join()])
    r('.attr(row-count/total-count) strings become Number props (needs runtime prop types)', ty[0] === 'number' && ty[1] === 'number', ty)
  })
  T('page'); r('no page errors in Desk operations', pageErrs(m0).length === 0, pageErrs(m0).join('|'))
}, { wait: 1200 })
