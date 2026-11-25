const run = require('./lib.cjs');
run('formlayout.html', async ({ p, r, txt, st }) => {
  let s = await st();
  r('tabs strip rendered', (await p.$$eval('#c-form [role=tab]', (e) => e.map((x) => x.innerText.trim()))).join(',') === 'Details,More', await p.$$eval('#c-form [role=tab]', (e) => e.map((x) => x.innerText.trim()).join(',')));
  r('update:activeTab announced on mount', s.active === 'details', s.active);
  r('fields rendered with labels', /Subject/.test(await txt('#c-form')) && /Status/.test(await txt('#c-form')));
  r('reason hidden by dependsOn', !(await p.isVisible('#c-form [data-fieldname=reason]')));
  await p.fill('#c-form [data-fieldname=subject] input', 'Fix it');
  s = await st(); r('typing writes into host doc (in-place mutation)', s.doc.subject === 'Fix it', s.doc.subject);
  // pick Closed through the field itself -> dependsOn should re-evaluate
  await p.click('#c-form [data-fieldname=status] button'); await p.waitForTimeout(300);
  await p.click('[role=option]:has-text("Closed")'); await p.waitForTimeout(300);
  s = await st(); r('select writes doc.status', s.doc.status === 'Closed', s.doc.status);
  r('dependsOn re-evaluates after in-form edit', await p.isVisible('#c-form [data-fieldname=reason]'));
  await p.click('#c-form [data-fieldname=done] button[role=checkbox], #c-form [data-fieldname=done] input[type=checkbox]'); await p.waitForTimeout(150);
  r('ui.on.change function in layout object fires', JSON.stringify(await p.evaluate(() => window.__commits)) === '[1]', JSON.stringify(await p.evaluate(() => window.__commits)));
  // host-driven change of a nested key (petite reactivity, not Vue's)
  await p.evaluate(() => { document.querySelector('#c-form [data-fieldname=status]') }); 
  // tab switching via click
  await p.click('#c-form [role=tab]:has-text("More")'); await p.waitForTimeout(300);
  s = await st(); r('tab click -> v-model:tab + activeTab', s.tab === 'more' && s.active === 'more', JSON.stringify([s.tab, s.active]));
  r('Table field inside FormLayout renders', /Add Row/.test(await txt('#c-form')));
  await p.click('#c-form button:has-text("Add Row")'); await p.waitForTimeout(300);
  s = await st(); r('Table add row in FormLayout', s.doc.items.length === 1, JSON.stringify(s.doc.items));
  const tr = await p.$$eval('#c-form .grid-row', (e) => e.map((x) => x.querySelectorAll('.grid-cell[data-fieldname=item] input, .grid-cell[data-fieldname=item] textarea').length));
  r('Table row editor drawn inside FormLayout', tr.length === 1 && tr[0] === 1, JSON.stringify(tr));
  if (tr[0]) { await p.click('#c-form .grid-cell[data-fieldname=item] input'); await p.keyboard.type('Bolt'); await p.keyboard.press('Tab'); await p.waitForTimeout(200) }
  s = await st(); r('typing in Table cell writes the child row', s.doc.items[0] && s.doc.items[0].item === 'Bolt', JSON.stringify(s.doc.items));
  await p.click('#c-form [role=tab]:has-text("Details")'); await p.waitForTimeout(300);
  // keyboard: arrow between tabs
  await p.focus('#c-form [role=tab][aria-selected=true]'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
  s = await st(); r('keyboard ArrowRight moves tab', s.active === 'more', s.active);
  await p.click('#c-form [role=tab]:has-text("Details")'); await p.waitForTimeout(300);
  await p.click('#set-subject'); await p.waitForTimeout(200);
  r('host nested mutation (doc.subject=) reaches the field', (await p.inputValue('#c-form [data-fieldname=subject] input')) === 'From host', await p.inputValue('#c-form [data-fieldname=subject] input'));
  await p.click('#replace-doc'); await p.waitForTimeout(200);
  r('host replacing doc reaches the field', (await p.inputValue('#c-form [data-fieldname=subject] input')) === 'Replaced', await p.inputValue('#c-form [data-fieldname=subject] input'));
  r('select trigger shows Closed (Vue saw in-form edit)', /Closed/.test(await txt('#c-form [data-fieldname=status]')), await txt('#c-form [data-fieldname=status]'));
}, { wait: 1200, shot: 'shot-formlayout.png' });
