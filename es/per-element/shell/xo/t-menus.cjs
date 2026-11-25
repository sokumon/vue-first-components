require('./lib.cjs').run('menus.html', async ({ p, r, wait, txt, vis, rect, state, log, inside }) => {
  const menu = '[role=menu]';
  const tr = await rect('#dd-trigger button');
  r('dropdown trigger: es-button in default slot renders', tr && tr.w > 20 && (await txt('#dd-trigger')).includes('Menu'), JSON.stringify(tr));
  await p.click('#dd-trigger button'); await wait(300);
  r('dropdown opens on click -> update:open', await vis(menu) && (await state()).includes('dd=true'), await state());
  const mr = await rect(menu);
  r('dropdown menu positioned under trigger', mr && tr && Math.abs(mr.x - tr.x) < 20 && mr.y >= tr.y + tr.h - 2 && mr.y < tr.y + tr.h + 30, JSON.stringify({ tr, mr }));
  r('trigger button carries aria-expanded / data-state=open', await p.$eval('#dd-trigger button', b => b.getAttribute('aria-expanded') + '/' + b.getAttribute('data-state')).then(v => (console.log('   button attrs', v), v === 'true/open')));
  const labels = await p.$$eval(menu + ' [role=menuitem], ' + menu + ' [role=menuitemcheckbox]', es => es.map(e => e.innerText.trim().replace(/\n/g, ' ')));
  console.log('   items:', JSON.stringify(labels));
  r('group labels rendered', (await txt(menu)).includes('Actions') && (await txt(menu)).includes('Danger'), await txt(menu));
  r('per-item named slot (option.slot -> slot="item-danger") rendered inside its row, bound', await inside('#dd-danger', menu) && (await txt('#dd-danger')).startsWith('Delete forever'), await txt('#dd-danger'));
  // keyboard: arrow down navigation + Enter
  await p.keyboard.press('ArrowDown'); await wait(80);
  const focused1 = await p.evaluate(() => document.activeElement?.innerText?.trim());
  r('keyboard ArrowDown moves focus into menu', /Edit|Share/.test(focused1 || ''), focused1);
  // submenu
  await p.hover(menu + ' [role=menuitem]:has-text("Share")'); await wait(400);
  r('submenu opens on hover', await vis('[role=menu] [role=menuitem]:has-text("Email")'));
  await p.click('[role=menuitem]:has-text("Email")'); await wait(300);
  r('submenu item onClick (fn prop) fires and menu closes', (await log()).includes('email') && !(await vis(menu)) && (await state()).includes('dd=false'), await log() + ' ' + await state());
  // switch item
  await p.click('#dd-trigger button'); await wait(300);
  await p.click(menu + ' [role=switch]'); await wait(200);
  r('switch item toggles host state through onClick(value)', (await state()).includes('notify=false'), await state() + ' ' + await log());
  await p.keyboard.press('Escape'); await wait(300);
  r('dropdown Escape closes', !(await vis(menu)) && (await state()).includes('dd=false'), await state());
  r('focus returns to trigger button after Escape', await p.evaluate(() => !!document.activeElement?.closest('#dd-trigger')), await p.evaluate(() => document.activeElement?.tagName));
  // open by keyboard
  await p.focus('#dd-trigger button'); await p.keyboard.press('Enter'); await wait(300);
  r('dropdown opens from keyboard (Enter)', await vis(menu));
  await p.keyboard.press('Escape'); await wait(200);
  // controlled open from host
  await p.click('#dd-open'); await wait(300);
  r('dropdown opens from host state (:open)', await vis(menu));
  await p.click(menu + ' [role=menuitem]:has-text("Delete")'); await wait(300);
  r('item with slot clicked -> onClick', (await log()).includes('delete') && !(await vis(menu)), await log());

  // empty dropdown
  await p.click('#dd2-trigger'); await wait(300);
  r('slot="trigger" plain button opens dropdown', await vis(menu));
  r('slot="empty" rendered in empty menu', await inside('#dd2-empty', menu) && await vis('#dd2-empty'));
  const t2 = await rect('#dd2-trigger'), m2 = await rect(menu);
  r('empty menu positioned under slot trigger', m2 && t2 && Math.abs(m2.x - t2.x) < 20 && m2.y >= t2.y + t2.h - 2 && m2.y < t2.y + t2.h + 30, JSON.stringify({ t2, m2 }));
  await p.keyboard.press('Escape'); await wait(300);

  // per-row slot
  await p.click('#dd3 button'); await wait(300);
  const suffixes = await p.$$eval(menu + ' .dd-suffix', es => es.length);
  r('item-suffix slot appears on every row (one light-DOM slot rendered 3 times)', suffixes === 3, `suffix nodes in menu=${suffixes} of 3 rows; ` + await txt(menu));
  await p.keyboard.press('Escape'); await wait(300);
  // context menu
  const a = await rect('#cm-area');
  await p.click('#cm-area', { button: 'right', position: { x: 40, y: 20 } }); await wait(300);
  r('context menu opens on right click -> update:open', await vis(menu) && (await state()).includes('cm=true'), await state());
  const cr = await rect(menu);
  r('context menu at pointer', cr && Math.abs(cr.x - (a.x + 40)) < 10 && Math.abs(cr.y - (a.y + 20)) < 10, JSON.stringify({ a, cr }));
  r('disabled option is disabled', await p.$eval(menu + ' [role=menuitem]:has-text("Paste")', e => e.hasAttribute('data-disabled') || e.getAttribute('aria-disabled') === 'true').catch(() => false));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await wait(300);
  r('keyboard select Copy', (await log()).includes('copy') && !(await vis(menu)) && (await state()).includes('cm=false'), await log() + ' ' + await state());
  r('context-menu region slot still reactive', (await txt('#cm-area')).includes('(' + (await log()).split(',').length + ')'), await txt('#cm-area'));
  await p.click('#cm-area', { button: 'right' }); await wait(300);
  await p.hover(menu + ' [role=menuitem]:has-text("More")'); await wait(400);
  await p.click('[role=menuitem]:has-text("Deep")'); await wait(300);
  r('context submenu item', (await log()).includes('deep'), await log());
});
