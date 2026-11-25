const run = require('./lib.cjs');
run('tables.html', async ({ p, r, txt, st }) => {
  let s;
  const cells = (sel) => p.$$eval(sel + ' [role=row], ' + sel + ' .list-row', (e) => e.map((x) => x.innerText.trim().replace(/\s+/g, ' ')));
  // ---- List
  const lt = await txt('#c-list');
  r('List renders header + 3 rows', /ID\s+Status\s+Hours/.test(lt) && /T-1/.test(lt) && /T-3/.test(lt), lt.replace(/\n/g, ' '));
  await p.click('#c-list [role=checkbox][aria-label="Select T-2"]'); await p.waitForTimeout(200);
  s = await st(); r('List row checkbox -> v-model:selection', JSON.stringify(s.selection) === '["T-2"]', JSON.stringify(s.selection));
  r('BulkBar appears with count', /1 selected/.test(await txt('#c-bulk')), await txt('#c-bulk'));
  await p.click('#c-bulk button:has-text("Archive")'); await p.waitForTimeout(100);
  r('BulkBar action fn prop gets selection', JSON.stringify(await p.evaluate(() => window.__bulk)) === '["T-2"]', JSON.stringify(await p.evaluate(() => window.__bulk)));
  await p.focus('#c-list [role=checkbox][aria-label="Select T-3"]'); await p.keyboard.press('Space'); await p.waitForTimeout(200);
  s = await st(); r('List keyboard Space toggles row', s.selection.length === 2, JSON.stringify(s.selection));
  await p.click('#c-bulk button[aria-label="Clear selection"], #c-bulk button:has-text("Clear selection")'); await p.waitForTimeout(400);
  s = await st(); r('BulkBar clear -> selection []', s.selection.length === 0 && !/selected/.test(await txt('#c-bulk')), JSON.stringify(s.selection));
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
  // ---- Footer
  r('Footer counts', /3 of 10/.test(await txt('#c-footer')));
  await p.click('#c-footer button:has-text("100")'); await p.waitForTimeout(200);
  s = await st(); r('Footer page size -> v-model:pageSize', s.pageSize === 100, s.pageSize);
  await p.click('#c-footer button:has-text("Load More")'); await p.waitForTimeout(100);
  s = await st(); r('Footer load-more (kebab event)', s.loadMore === 1, s.loadMore);
  // ---- GroupByTable
  const gt = (await txt('#c-gbt')).replace(/\s+/g, ' ');
  r('GroupByTable rows + aggregates + totals', /Open 2 3/.test(gt) && /Closed 1 5/.test(gt) && /Total 3 8/.test(gt), gt);
  await p.click('#c-gbt :text-is("Count")'); await p.waitForTimeout(200);
  s = await st(); r('GroupByTable header sort -> update:groupBy', JSON.stringify(s.gb.sort || []).includes('count'), JSON.stringify(s.gb.sort));
  // ---- Grid
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
}, { wait: 1200, shot: 'shot-tables.png' });
