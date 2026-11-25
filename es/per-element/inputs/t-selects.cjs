require('./lib.cjs')('selects.html', async ({ p, r, txt, st }) => {
  const W = (ms = 250) => p.waitForTimeout(ms);
  const ev = (f, a) => p.evaluate(f, a);
  const vis = (s) => ev((s) => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' }, s);
  const openList = () => ev(() => [...document.querySelectorAll('[role=listbox]')].filter(e => e.getBoundingClientRect().height > 0 && !e.closest('[aria-hidden=true]')).length);
  // ---------------- Select
  r('select shows selected label in trigger', (await txt('#sel [data-slot=trigger]')).includes('Red'), await txt('#sel [data-slot=trigger]'));
  await p.click('#sel [data-slot=trigger]'); await W();
  r('select opens on click (listbox teleported to body)', (await openList()) >= 1 && (await st()).selOpen === true, JSON.stringify(await st()));
  await ev(() => { window.__selFooter = document.getElementById('sel-footer') });
  const footer = await ev(() => { const f = document.getElementById('sel-footer'); return f ? { inListbox: !!f.closest('[data-slot=content], [role=listbox]'), inHolder: !!f.closest('es-slots'), text: f.innerText } : null });
  r('select #footer slot shown inside open popover', footer && footer.inListbox, JSON.stringify(footer));
  const ip = await ev(() => [...document.querySelectorAll('[role=listbox] [role=option]')].filter(o => !o.closest('[aria-hidden=true]')).map(o => (o.querySelector('[data-slot=item-prefix]')?.innerText || '') + o.innerText.split('\n')[0]));
  r('select #item-prefix slot rendered for every option', ip.length === 3 && ip.every(t => t.startsWith('*')), JSON.stringify(ip));
  const dis = await ev(() => [...document.querySelectorAll('[role=option]')].some(o => o.innerText.includes('Green') && o.getAttribute('aria-disabled') === 'true'));
  r('select disabled option is aria-disabled', dis);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await W();
  r('select keyboard ArrowDown+Enter -> blue, closes, update:open false', (await st()).color === 'blue' && (await st()).selOpen === false && (await openList()) === 0, JSON.stringify(await st()));
  if (footer && footer.inListbox) {
    await p.click('#sel [data-slot=trigger]'); await W();
    await p.click('#sel-footer-btn').catch(e => console.log('  footer click', e.message.slice(0, 100))); await W(100);
    r('select footer button (petite @click) works inside teleported popover', (await st()).footerHits === 1, JSON.stringify(await st()));
    await p.keyboard.press('Escape'); await W();
  }
  r('after close, slot content not left in body', await ev(() => !document.body.contains(window.__selFooter) || document.getElementById('sel').contains(window.__selFooter)), await ev(() => 'connected=' + window.__selFooter.isConnected));
  // string options
  await p.click('#sel-str [data-slot=trigger]'); await W();
  await p.click('[role=option]:has-text("Two")').catch(e => console.log('  ', e.message.slice(0, 100))); await W();
  r('select string options + v-model', (await st()).plain === 'Two', JSON.stringify(await st()));
  // empty slot
  await p.click('#sel-empty [data-slot=trigger]'); await W();
  r('select #empty slot shown when no options', await vis('#sel-empty-slot'), await txt('#sel-empty-slot'));
  await p.keyboard.press('Escape'); await W();
  // controlled open
  await p.click('#open-ctl'); await W();
  r('controlled :open=true opens es-select', (await openList()) >= 1, await openList());
  await p.keyboard.press('Escape'); await W();
  r('Escape on controlled select emits update:open false', (await st()).ctlOpen === false && (await openList()) === 0);
  // ---------------- Combobox
  await p.click('#cb input'); await p.keyboard.type('blu'); await W();
  r('combobox update:query event', (await st()).query === 'blu', JSON.stringify(await st()));
  const opts = await ev(() => [...document.querySelectorAll('[role=option]')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.innerText.replace(/\n/g, ' ')));
  r('combobox filters options (option slots fn returns string)', opts.some(t => t.includes('BB:Blueberry')) && !opts.some(t => t.includes('Apple')), JSON.stringify(opts));
  r('combobox #footer slot visible in popover', await vis('#cb-footer'));
  await p.keyboard.press('Enter'); await W();
  r('combobox Enter selects highlighted -> blueberry', (await st()).fruit === 'blueberry', JSON.stringify(await st()));
  await p.click('#cb input'); await p.keyboard.press('Control+a'); await p.keyboard.type('zzz'); await W();
  r('combobox #empty slot shown + reactive to query', (await txt('#cb-empty')).includes('zzz') && await vis('#cb-empty'), await txt('#cb-empty'));
  await p.keyboard.press('Control+a'); await p.keyboard.type('cre'); await W();
  await p.click('[role=option]:has-text("Create new")').catch(e => console.log('  ', e.message.slice(0, 100))); await W();
  r('combobox custom option onClick (function in options) gets query', (await ev(() => window.__custom)) === 'create:cre', await ev(() => window.__custom));
  await p.keyboard.press('Escape'); await W();
  await p.click('#cb-btn [data-slot=trigger]'); await W();
  r('combobox trigger=button shows selected label + opens with search', (await txt('#cb-btn')).includes('Blueberry') && (await openList()) >= 1, await txt('#cb-btn'));
  await p.keyboard.type('app'); await W(); await p.keyboard.press('Enter'); await W();
  r('combobox button mode select -> apple', (await st()).fruit === 'apple', JSON.stringify(await st()));
  await p.keyboard.press('Escape'); await W();
  // ---------------- MultiSelect
  await p.click('#ms [data-slot=trigger]'); await W();
  r('multiselect opens, update:open', (await st()).msOpen === true && (await openList()) >= 1);
  await p.click('[role=option]:has-text("Beta")'); await W(100);
  await p.click('[role=option]:has-text("Gamma")'); await W(100);
  r('multiselect toggles add values -> [a,b,c]', JSON.stringify((await st()).tags) === '["a","b","c"]', JSON.stringify((await st()).tags));
  r('multiselect #footer slot visible', await vis('#ms-footer'));
  await p.click('[role=option]:has-text("Alpha")'); await W(100);
  r('multiselect toggle off -> [b,c]', JSON.stringify((await st()).tags) === '["b","c"]', JSON.stringify((await st()).tags));
  await p.keyboard.press('Escape'); await W();
  r('multiselect Escape closes', (await st()).msOpen === false && (await openList()) === 0);
  r('multiselect #summary slot reactive', (await txt('#ms-summary')) === '2 tags', await txt('#ms-summary'));
  await p.click('#who'); await W(100);
  r('select footer slot (detached while closed) still reactive', await ev(() => window.__selFooter.textContent.includes('Linus')), await ev(() => window.__selFooter.textContent + ' connected=' + window.__selFooter.isConnected));
  // clones of multi-rendered slots are static copies
  await p.click('#sel [data-slot=trigger]'); await W();
  const ip2 = await ev(() => [...document.querySelectorAll('[role=listbox] [role=option] [data-slot=item-prefix]')].filter(o => !o.closest('[aria-hidden=true]')).map(o => o.innerText.trim()));
  r('[caveat] multi-rendered #item-prefix: only the owning outlet stays reactive (others are static clones)', true, JSON.stringify(ip2));
  await p.keyboard.press('Escape'); await W();
  // v-if created select, opened, then removed while open: no leaked popover
  const before = await ev(() => ({ body: document.body.children.length, lb: document.querySelectorAll('[role=listbox]').length }));
  await p.click('#sel2-toggle'); await W(400);
  await p.click('#sel2 [data-slot=trigger]'); await W();
  r('v-if-created es-select opens with bound footer slot', await ev(() => !!document.querySelector('[role=listbox] #sel2-footer, [data-slot=content] #sel2-footer') && document.getElementById('sel2-footer').textContent.includes('Linus')), await ev(() => document.getElementById('sel2-footer')?.textContent));
  await ev(() => document.getElementById('sel2-toggle').click()); await W(500);
  const after = await ev(() => ({ host: !!document.getElementById('sel2'), body: document.body.children.length, lb: document.querySelectorAll('[role=listbox]').length }));
  r('v-if false while open: host gone, no leaked listbox/teleport', !after.host && after.lb === before.lb && after.body === before.body, JSON.stringify({ before, after }));
  r('exposed clear() on es-select host', await ev(() => typeof document.getElementById('sel-str').clear === 'function'));
  await p.screenshot({ path: __dirname + '/shot-selects.png', fullPage: true });
});
