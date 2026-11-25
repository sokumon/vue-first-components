const run = require('./lib.cjs');
const opts = (p) => p.$$eval('[role=option]', (e) => e.filter((x) => x.offsetParent).map((x) => x.innerText.trim().replace(/\s+/g, ' ')));
run('listcontrols.html', async ({ p, r, txt, st, calls }) => {
  let s;
  // Shell: meta fetched once (memoized) though 7 controls ask for it
  const metaCalls = calls.filter((c) => c.method === 'frappe.desk.form.load.getdoctype');
  r('meta fetched via getdoctype (ToDo once + Nope once)', metaCalls.filter((c) => c.body.doctype === 'ToDo').length === 1, metaCalls.map((c) => c.body.doctype).join(','));
  r('shell default table slot from meta', /7 fields in meta/.test(await txt('#c-shell')) && /Status/.test(await txt('#c-shell')));
  r('shell named slot toolbar placed in toolbar region', await p.evaluate(() => { const t = document.getElementById('toolbar-slot'); return !!t.closest('es-slot') && t.closest('#c-shell') && t.parentElement.closest('.border-b') !== null }));
  r('shell footer slot bound + placed', /0 filters · 0 sorts/.test(await txt('#c-shell')) && await p.evaluate(() => !!document.getElementById('footer-slot').closest('.border-t')));
  r('shell custom #table slot replaces default', (await txt('#c-shell2')).includes('custom table for 2 columns') && !(await txt('#c-shell2')).includes('fields in meta'));
  r('shell missing doctype -> error text', /not found for "Nope"/.test(await txt('#c-shell-missing')));

  // SortBy
  await p.click('#c-sort button'); await p.waitForTimeout(300);
  const so = await opts(p);
  r('SortBy offers meta fields', so.includes('Priority'), so.join('|'));
  await p.click('[role=option]:has-text("Priority")'); await p.waitForTimeout(300);
  s = await st(); r('SortBy add -> v-model', s.sort.length === 1 && s.sort[0].fieldname === 'priority', JSON.stringify(s.sort));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  r('SortBy trigger reflects sort', /Priority|1/.test(await txt('#c-sort')), await txt('#c-sort'));
  r('footer slot reacts (1 sorts)', /1 sorts/.test(await txt('#footer-slot')), await txt('#footer-slot'));

  // Filter: add Status filter, set value
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
  await p.click('#c-quick button:has-text("more")').catch(() => {}); await p.waitForTimeout(300);
  r('QuickFilter shares filters (Status quick input shows Closed)', /Closed/.test(await txt('#c-quick')), await txt('#c-quick'));
  // QuickFilter typing
  const qi = await p.$('#c-quick input');
  if (qi) { await qi.fill('bug'); await p.waitForTimeout(600) }
  s = await st(); r('QuickFilter input -> filters v-model', s.filters.some((f) => f.fieldname === 'name' && JSON.stringify(f.value).includes('bug')), JSON.stringify(s.filters));
  // Filter clear-all
  await p.click('#c-filter button[aria-label="Clear All Filters"]'); await p.waitForTimeout(300);
  s = await st(); r('Filter clear all', s.filters.length === 0, JSON.stringify(s.filters));

  // GroupBy
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

  // ColumnSettings
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

  // QuickFilter customize mode (host-driven v-model:customizing)
  await p.click('#customize'); await p.waitForTimeout(400);
  r('QuickFilter customizing view', /Done/.test(await txt('#c-quick')), await txt('#c-quick'));
  await p.click('#c-quick button:has-text("Done")').catch(() => {}); await p.waitForTimeout(300);
  s = await st(); r('QuickFilter Done -> done event + customizing=false', s.done === 1 && s.customizing === false, JSON.stringify([s.done, s.customizing]));
}, { wait: 1200, shot: 'shot-listcontrols.png' });
