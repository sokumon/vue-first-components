// SettingsDialog family: Dialog + reka Tabs context across 9 custom elements
require('./lib.cjs').run('settings.html', async ({ p, r, wait, txt, vis, rect, state, log, inside }) => {
  const ev = (f, a) => p.evaluate(f, a);
  const D = '[role=dialog]';
  r('closed: no dialog, panels not rendered', !(await p.$(D)) && !(await vis('#h-profile > :not(es-slots)')));
  await p.click('#open button'); await wait(500);
  r('open via petite :open', await vis(D), await state());
  r('title slot -> dialog accessible name (aria-labelledby)', await ev(() => { const d = document.querySelector('[role=dialog]'); const id = d && d.getAttribute('aria-labelledby'); return id && document.getElementById(id)?.innerText.trim() }) === 'App settings for Ada');
  r('description slot -> aria-describedby', await ev(() => { const d = document.querySelector('[role=dialog]'); const id = d && d.getAttribute('aria-describedby'); return id && document.getElementById(id)?.innerText.trim() }) === 'Change how the app behaves');
  const tabs = await p.$$eval(D + ' [role=tab]', ts => ts.map(t => t.innerText.trim().replace(/\n/g, ' ') + ':' + t.dataset.state));
  r('sidebar: tablist with 3 tabs (nav items get TabsRoot context)', tabs.length === 3 && !!(await p.$(D + ' [role=tablist]')), JSON.stringify(tabs));
  r('v-model:tab initial value selects Profile', tabs[0] && tabs[0].endsWith(':active'), tabs[0]);
  r('nav-group label prop + label slot', (await txt('#g1')).startsWith('User settings') && (await txt('#g2-label')) === 'Workspace (admin)' && await inside('#g2-label', '#g2'));
  r('nav-item prefix slot (avatar) inside the tab', await inside('#ni-profile-av', '#ni-profile [role=tab]'));
  r('nav-item suffix slot (badge) inside the tab', await inside('#ni-notif-badge', '#ni-notif [role=tab]') && (await txt('#ni-notif-badge')) === '3');
  r('sidebar left of content', await ev(() => { const a = document.querySelector('[role=tablist]').getBoundingClientRect(), b = document.querySelector('[role=tabpanel]').getBoundingClientRect(); return a.right <= b.left + 1 }));
  r('profile panel: header title/description + actions slot', (await txt('#h-profile')).includes('Profile') && (await txt('#h-profile')).includes('Your public identity') && await inside('#h-profile-act', '#h-profile'));
  r('row title/description + control slot (text input)', (await txt('#row-name')).includes('Display name') && (await txt('#row-name')).includes('Shown to teammates') && await inside('#name-input input', '#row-name'));
  const lab = await p.$eval('#row-name label', l => l.htmlFor).catch(() => null);
  r('row title becomes <label for> the detected control', !!lab && (await p.$eval('#name-input input', i => i.id)) === lab, lab);
  await p.fill('#name-input input', 'Grace'); await wait(100);
  r('control inside dialog -> petite; avatar/title slots reactive', (await state()).includes('name=Grace') && await ev(() => { const d = document.querySelector('[role=dialog]'); return document.getElementById(d.getAttribute('aria-labelledby')).innerText.includes('Grace') }), await state());
  await p.click('#h-profile-act button'); await wait(80);
  r('header action button click', (await log()).includes('save'), await log());
  // switch tabs by click
  await p.click('#ni-notif [role=tab]'); await wait(250);
  r('click tab -> update:tab -> petite; notifications panel shown, profile panel hidden/unmounted', (await state()).includes('tab=notifications') && await vis('#h-notif > :not(es-slots)') && !(await vis('#h-profile > :not(es-slots)')), await state());
  r('settings-body scrolls (ScrollArea viewport)', await ev(() => { const b = document.querySelector('#b-notif'); let n = document.querySelector('#row-digest'); while (n && n !== document.body && !(n.scrollHeight > n.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(n).overflowY))) n = n.parentElement; if (!n || n === document.body) return false; n.scrollTop = 300; return n.scrollTop > 100 && b.contains(n) }));
  await ev(() => { const n = document.querySelector('#row-digest'); n.scrollIntoView() }); await wait(100);
  // label-for toggles switch
  await p.click('#row-digest label').catch(e => console.log('   ', e.message.slice(0, 100))); await wait(150);
  r('clicking the row title (label) toggles the switch -> petite', (await state()).includes('digest=true'), await state());
  await p.click('#sw-sounds button, #sw-sounds [role=switch]'); await wait(150);
  r('row description slot (with link) + switch v-model', (await txt('#row-sounds-desc')).includes('Learn more') && await inside('#learn', '#row-sounds') && (await state()).includes('sounds=false'), await state());
  // petite -> tab
  await ev(() => document.querySelector('#ni-members [role=tab]').focus());
  // keyboard: roving focus + manual activation
  await p.focus('#ni-profile [role=tab]'); await p.keyboard.press('ArrowDown'); await wait(100);
  const f1 = await ev(() => document.activeElement?.innerText?.trim().replace(/\n/g, ' '));
  r('ArrowDown moves focus to next tab (manual activation: tab not yet selected)', /Notifications/.test(f1) && (await state()).includes('tab=notifications'), f1 + ' ' + await state());
  await p.keyboard.press('ArrowDown'); await wait(80); await p.keyboard.press('Enter'); await wait(250);
  r('Enter selects focused tab -> members panel, custom header slot', (await state()).includes('tab=members') && (await txt('#h-members-custom')) === 'Custom header (3)', await state() + ' ' + await txt('#h-members-custom'));
  // Escape closes
  await p.keyboard.press('Escape'); await wait(400);
  r('Escape closes -> update:open false', (await state()).includes('open=false') && !(await vis(D)), await state());
  // shortcut opens (Mod+Shift+Comma)
  await p.click('#outside-input'); await p.keyboard.press('Control+Shift+Comma'); await wait(500);
  r('Ctrl+Shift+, opens (keyboard-shortcut default) -> update:open', (await state()).includes('open=true') && await vis(D), await state());
  const tabs2 = await p.$$eval(D + ' [role=tab]', ts => ts.map(t => t.innerText.trim().split('\n').pop() + ':' + t.dataset.state));
  r('reopened: tabs work again (fresh TabsRoot context), selection kept from v-model:tab', tabs2.length === 3 && tabs2[2] === 'Members:active', JSON.stringify(tabs2));
  await p.click('#ni-profile [role=tab]'); await wait(250);
  r('reopened: switching tabs still works', (await state()).includes('tab=profile') && await vis('#h-profile > :not(es-slots)') && (await p.$eval('#name-input input', i => i.value).catch(() => '')) === 'Grace', await state());
  await p.keyboard.press('Control+Shift+Comma'); await wait(400);
  r('shortcut toggles closed', (await state()).includes('open=false') && !(await vis(D)), await state());
  // petite drives tab while closed, then open
  await ev(() => { document.querySelector('#sd').tab = 'notifications' });
  await p.click('#open button'); await wait(500);
  r('tab prop set from outside selects that panel on open', await vis('#h-notif > :not(es-slots)'), await p.$$eval(D + ' [role=tab]', ts => ts.map(t => t.dataset.state).join(',')).catch(() => ''));
  const lc = await ev(() => document.body.children.length);
  await p.keyboard.press('Escape'); await wait(400);
  r('closed again; slot hosts parked (no leaked dialog)', !(await p.$(D)), lc);
});
