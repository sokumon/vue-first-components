const run = require('./lib.cjs');
run('apps.html', async ({ p, r, txt, st, stPoked, calls }) => {
  let s;
  // ---- InviteUser (controller spread with petite v-bind="obj": function props)
  r('InviteUser load() fn prop called once on mount', (await p.evaluate(() => window.__loaded)) === 1, await p.evaluate(() => window.__loaded));
  r('Send invites disabled until email + role', await p.isDisabled('#c-inv button[type=submit]'));
  const em = p.locator('#c-inv input').first();
  await em.click(); await p.keyboard.type('gra'); await p.waitForTimeout(500);
  r('typing in MultiEmailInput -> debounced searchUsers fn prop', (await p.evaluate(() => window.__search)) === 'gra', await p.evaluate(() => window.__search));
  await p.keyboard.press('Control+A'); await p.keyboard.type('new.person@example.com'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  r('email chip added', /new\.person@example\.com/.test(await txt('#c-inv')), (await txt('#c-inv')).replace(/\s+/g, ' '));
  await p.keyboard.press('Escape');
  await p.click('#c-inv button:has-text("Select roles")'); await p.waitForTimeout(300);
  await p.click('[role=option]:has-text("System Manager")').catch(() => {}); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  r('role picked, submit enabled', !(await p.isDisabled('#c-inv button[type=submit]')), (await txt('#c-inv')).replace(/\s+/g, ' '));
  await p.click('#c-inv button[type=submit]'); await p.waitForTimeout(400);
  s = await stPoked();
  r('submit -> invite(emails, roles) fn prop + invited event', JSON.stringify(await p.evaluate(() => window.__invite)) === '["new.person@example.com",["System Manager"]]' && s.invited[0] === 'new.person@example.com', JSON.stringify(await p.evaluate(() => window.__invite)) + ' ' + JSON.stringify(s.invited));
  r('form resets after invite', !/new\.person@example\.com/.test(await txt('#c-inv')));

  // ---- NotificationPanel
  s = await st(); r('NotificationPanel sets first tab on mount (update:activeTab)', s.tab === 'all', JSON.stringify(s.tab));
  r('tab count from "unread" count prop', /Unread \(1\)/.test(await txt('#c-np')));
  await p.click('#c-np button:has-text("Unread (1)")'); await p.waitForTimeout(300);
  s = await stPoked(); const np = (await txt('#c-np')).replace(/\s+/g, ' ');
  r('tab switch -> filter fn prop hides read rows', s.tab === 'unread' && /Ada mentioned you/.test(np) && !/Task assigned/.test(np), s.tab + ' :: ' + np);
  await p.click('#c-np [data-slot=item]'); await p.waitForTimeout(200);
  s = await stPoked(); r('row click -> mark-as-read (kebab event)', JSON.stringify(s.markRead) === '["N1"]', JSON.stringify(s.markRead));
  await p.click('#c-np button[aria-label="Mark all as read"]'); await p.click('#c-np button[aria-label="Close"]'); await p.waitForTimeout(200);
  s = await stPoked(); r('mark-all-as-read + close events', s.allRead === 1 && s.closed === 1, JSON.stringify([s.allRead, s.closed]));
  // NotificationItem: component emits "click" -> collides with the native click bubbling out of the light DOM
  await p.click('#c-ni [data-slot=item]'); await p.waitForTimeout(200);
  s = await stPoked(); r('NotificationItem @click gets only the component event', JSON.stringify(s.itemClicks) === '["custom:N1"]', JSON.stringify(s.itemClicks));
  await p.focus('#c-ni [data-slot=item]'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  s = await stPoked(); r('NotificationItem keyboard Enter -> click event', s.itemClicks.filter((x) => x === 'custom:N1').length === 2, JSON.stringify(s.itemClicks));

  const tn = await p.$$eval('#c-np-tpl .tplnote', (e) => e.map((x) => x.textContent));
  r('scoped #item <template> per notification', tn.length === 2 && tn[0] === 'Ada mentioned you', JSON.stringify(tn));
  if (tn.length) { await p.click('#c-np-tpl .tplnote >> nth=0'); await p.waitForTimeout(200) }
  s = await stPoked(); r('slot-prop function markAsRead() emits mark-as-read', s.markRead.includes('tpl:N1'), JSON.stringify(s.markRead));
  // ---- Link (standalone, backend search mocked)
  await p.click('#c-link input'); await p.waitForTimeout(500);
  s = await stPoked(); r('Link focus opens (v-model:open) + loads options', s.linkOpen === true && (await p.$$('[role=option]')).length >= 3, JSON.stringify(s.linkOpen) + ' opts=' + (await p.$$('[role=option]')).length);
  await p.keyboard.type('zed'); await p.waitForTimeout(700);
  const cr = await p.$('[role=option]:has-text("Create")');
  r('creatable shows Create "<query>" item', !!cr, (await p.$$eval('[role=option]', (e) => e.map((x) => x.innerText.trim()).join('|'))));
  if (cr) { await cr.click(); await p.waitForTimeout(300) }
  s = await stPoked(); r('Create -> create event with query', s.linkCreate === 'zed', JSON.stringify(s.linkCreate));
  await p.click('#c-link input'); await p.keyboard.press('Control+A'); await p.keyboard.type('ada'); await p.waitForTimeout(700);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  s = await stPoked(); r('Link keyboard pick (first option highlighted) -> v-model', s.link === 'ada@example.com', JSON.stringify(s.link));
  r('Link exposed reload() reachable on element', await p.evaluate(() => typeof document.getElementById('c-link').reload === 'function'));
  await p.keyboard.press('Escape');

  // ---- AutomationCanvas (vue-flow)
  r('canvas draws nodes + toolbar slot inside panel', /Ticket created/.test(await txt('#c-canvas')) && /Send email/.test(await txt('#c-canvas')) && await p.evaluate(() => !!document.getElementById('canvas-tool').closest('.vue-flow__panel')));
  r('canvas draws the edge', (await p.$$('#c-canvas .vue-flow__edge')).length === 1, (await p.$$('#c-canvas .vue-flow__edge')).length);
  await p.locator('#c-canvas').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const nodeEl = await p.$('#c-canvas [aria-label*="Send email"]');
  console.log('  node el:', !!nodeEl, nodeEl && JSON.stringify(await nodeEl.boundingBox()), 'at point:', nodeEl && await p.evaluate((e) => { const b = e.getBoundingClientRect(); const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return t && (t.className + '').slice(0, 80) }, nodeEl));
  if (nodeEl) { const b = await nodeEl.boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2) } await p.waitForTimeout(300);
  s = await stPoked(); r('node click -> select event, selectedId round-trip, slot reacts', s.selected === 'n2' && /Tool n2/.test(await txt('#canvas-tool')), JSON.stringify(s.cevents) + ' ' + (await txt('#canvas-tool')));
  const add = await p.$('#c-canvas button[aria-label="Add block"]');
  if (add) { await add.click(); await p.waitForTimeout(400); await p.click('[role=option]:has-text("Assign to"), [role=menuitem]:has-text("Assign to"), button:has-text("Assign to")').catch((e) => console.log('  picker', e.message.slice(0, 60))); await p.waitForTimeout(300) }
  s = await stPoked(); r('Add block picker -> add-node event', s.cevents.includes('add:assign'), JSON.stringify(s.cevents));
  // drag a node -> move
  const nb = await p.$('#c-canvas .vue-flow__node[data-id="n2"]');
  if (nb) { const b = await nb.boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + 10); await p.mouse.down(); await p.mouse.move(b.x + b.width / 2 + 80, b.y + 40, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300) }
  s = await stPoked(); r('node drag -> move event', s.cevents.includes('move:n2'), JSON.stringify(s.cevents));
  r('exposed fitView reachable on element', await p.evaluate(() => typeof document.getElementById('c-canvas').fitView === 'function'));
}, { wait: 1500, shot: 'shot-apps.png', viewport: { width: 1280, height: 1700 } });
