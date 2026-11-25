// Desktop shell: DesktopShell + SidebarRail(+Item) + Sidebar family + PageHeader(+Title)
require('./lib.cjs').run('shell.html', async ({ p, r, wait, txt, vis, rect, state, log, inside }) => {
  const ev = (f, a) => p.evaluate(f, a);
  // --- layout
  const rail = await rect('[data-slot=sidebar-rail]'), sb = await rect('[data-slot=sidebar]'), ct = await rect('[data-slot=desktop-shell-content]');
  r('desktop-shell: rail | sidebar | content side by side, full height', rail && sb && ct && rail.x < sb.x && sb.x < ct.x && ct.h > 800 && sb.h > 800, JSON.stringify({ rail, sb, ct }));
  r('desktop-shell: rail slot inside shell, sidebar slot inside shell', await inside('[data-slot=sidebar-rail]', '[data-slot=desktop-shell]') && await inside('[data-slot=sidebar]', '[data-slot=desktop-shell]'));
  // --- page header teleported into the shell's header target, above the scroll region
  const hdrInTarget = await ev(() => { const h = document.querySelector('#pht')?.closest('header'); const c = document.querySelector('[data-slot=desktop-shell-content]'); return !!h && c.firstElementChild.contains(h) });
  r('page-header teleported into DesktopShell header target (first child of content)', hdrInTarget);
  r('page-header-title renders title prop inside header', (await txt('header')).includes('Page inbox') && await inside('#pht', 'header'), await txt('header'));
  r('page-header default slot: action button inside header', await inside('#ph-act button', 'header'));
  await p.click('#ph-act button'); await wait(80);
  r('page-header action button click reaches petite', (await log()).includes('new'), await log());
  // scroll region + pinned header
  const h0 = await rect('header');
  const scrolled = await ev(() => { const v = document.querySelector('#content').closest('[data-reka-scroll-area-viewport], [style*=overflow]') || document.querySelector('#content').parentElement; let n = document.querySelector('#content'); while (n && !(n.scrollHeight > n.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(n).overflowY))) n = n.parentElement; if (!n) return null; n.scrollTop = 600; return { tag: n.tagName, top: n.scrollTop, inShell: !!n.closest('[data-slot=desktop-shell-content]') } });
  await wait(150);
  const h1 = await rect('header');
  r('default slot sits in the shell scroll region; scrolling keeps the header pinned', scrolled && scrolled.top > 500 && scrolled.inShell && h0 && h1 && h0.y === h1.y, JSON.stringify({ scrolled, h0, h1 }));
  // --- sidebar items
  const st = (id) => p.$eval(id + ' [data-slot=sidebar-item]', e => e.dataset.state).catch(() => 'ERR');
  r('sidebar-item :active from petite (inbox active, drafts inactive)', (await st('#si-inbox')) === 'active' && (await st('#si-drafts')) === 'inactive');
  r('sidebar-item suffix prop rendered in suffix zone', (await p.$eval('#si-inbox [data-slot=sidebar-item-suffix]', e => e.innerText.trim()).catch(() => '')) === '12');
  r('sidebar-item named slot prefix inside the button prefix box', await inside('#si-drafts-prefix', '#si-drafts button'));
  r('sidebar-item default slot label inside button, interpolated', await inside('#si-drafts-label', '#si-drafts button') && (await txt('#si-drafts-label')) === 'Drafts (3)', await txt('#si-drafts-label'));
  r('sidebar-item named slot suffix inside suffix zone', await inside('#si-drafts-suffix', '#si-drafts [data-slot=sidebar-item-suffix]'));
  await p.click('#si-drafts button'); await wait(120);
  r('sidebar-item click -> petite state + active flips + header title reactive', (await state()).includes('cur=drafts') && (await st('#si-drafts')) === 'active' && (await st('#si-inbox')) === 'inactive' && (await txt('#pht')) === 'Page drafts', await state() + ' / ' + await txt('#pht'));
  r('sidebar-item onClick function prop (:on-click) called with MouseEvent', (await ev(() => window.__fn)) === 'click', await ev(() => window.__fn));
  r('sidebar-item href renders <a href>', (await p.$eval('#si-link a', a => a.getAttribute('href')).catch(() => null)) === 'https://example.com/docs');
  r('sidebar-item aria-label from slot text (tooltip/accessible name)', (await p.$eval('#si-drafts button', b => b.getAttribute('aria-label')).catch(() => null)) === 'Drafts (3) new' || /Drafts/.test(await p.$eval('#si-drafts button', b => b.getAttribute('aria-label')).catch(() => '')), await p.$eval('#si-drafts button', b => b.getAttribute('aria-label')).catch(() => null));
  r('sidebar-label slot text rendered', (await txt('#sl')) === 'Projects', await txt('#sl'));
  // --- section collapse (v-model:collapsed)
  r('sidebar-section label + items visible', (await txt('#ss')).includes('Teams') && await vis('#si-team-a button'));
  await p.click('#ss button[aria-expanded]'); await wait(450);
  r('sidebar-section collapse button -> update:collapsed -> petite, body hidden', (await state()).includes('sec=true') && !(await vis('#si-team-a button')) && (await p.$eval('#ss button[aria-expanded]', b => b.getAttribute('aria-expanded'))) === 'false', await state());
  await p.click('#ss button[aria-expanded]'); await wait(450);
  r('sidebar-section expands again', (await state()).includes('sec=false') && await vis('#si-team-a button'), await state());
  await p.click('#si-team-b button'); await wait(80);
  r('item inside section click -> state', (await state()).includes('cur=b'), await state());
  // --- header menu
  r('sidebar-header title/subtitle rendered', (await txt('#sh')).includes('Acme') && (await txt('#sh')).includes('ada@acme.io'), await txt('#sh'));
  await p.click('#sh button'); await wait(350);
  r('sidebar-header menu opens (Dropdown with menu-items)', await vis('[role=menuitem]:has-text("Switch workspace")'));
  await p.click('[role=menuitem]:has-text("Log out")').catch(() => {}); await wait(250);
  r('sidebar-header menu item onClick fires, menu closes', (await ev(() => window.__ws)) === 'logout' && !(await vis('[role=menu]')), await ev(() => window.__ws));
  // --- cards
  r('sidebar-card title/description props', (await txt('#card')).includes('Trial ends soon') && (await txt('#card')).includes('5 days left'), await txt('#card'));
  await p.click('#card [data-slot=action]').catch(e => console.log('  ', e.message.slice(0, 80))); await wait(100);
  r('sidebar-card action object (label + onClick fn)', (await txt('#card [data-slot=action]')) === 'Upgrade now' && (await ev(() => window.__up)) === 1, await txt('#card [data-slot=action]') + ' up=' + await ev(() => window.__up));
  r('sidebar-card named slots title/description in their zones', await inside('#card2-title', '#card2 [data-slot=title]') && await inside('#card2-desc', '#card2 [data-slot=description]'));
  r('sidebar-card actions slot (scoped slot used without props) in actions zone', await inside('#card2-act', '#card2 [data-slot=actions]'));
  await p.click('#card2-act button'); await wait(120);
  r('slot content stays reactive: card title, item label, rail badge follow n', (await txt('#card2-title')) === 'Slot title 4' && (await txt('#si-drafts-label')) === 'Drafts (4)', await txt('#card2-title') + ' / ' + await txt('#si-drafts-label'));
  await p.click('#card [data-slot=dismiss]').catch(e => console.log('  ', e.message.slice(0, 80))); await wait(200);
  r('sidebar-card dismiss -> @dismiss -> v-if removes it', (await log()).includes('dismiss') && !(await p.$('#card')), await log());
  // --- rail
  await p.click('#ri-home [data-slot=sidebar-rail-item]'); await wait(120);
  r('rail item active indicator on Home', !!(await p.$('#ri-home [data-slot=sidebar-rail-item-indicator]')) && (await p.$eval('#ri-home [data-slot=sidebar-rail-item]', e => e.dataset.state).catch(() => '')) === 'active');
  r('rail item aria-label folds badge count', (await p.$eval('#ri-bell [data-slot=sidebar-rail-item]', e => e.getAttribute('aria-label')).catch(() => '')) === 'Notifications, 4 unread', await p.$eval('#ri-bell [data-slot=sidebar-rail-item]', e => e.getAttribute('aria-label')).catch(() => ''));
  const pill = await ev(() => { const s = [...document.querySelectorAll('body > span, body span')].find(e => /^\s*4\s*$/.test(e.innerText) && e.querySelector('*')); const a = document.querySelector('#ri-bell [data-slot=sidebar-rail-item]').getBoundingClientRect(); if (!s) return null; const b = s.getBoundingClientRect(); return { txt: s.innerText.trim(), dx: Math.round(b.x - a.x), dy: Math.round(b.y - a.y), vis: !s.className.includes('invisible') } });
  r('rail badge pill teleported + positioned next to its item, count reactive', pill && pill.vis && Math.abs(pill.dx) < 40 && Math.abs(pill.dy) < 30, JSON.stringify(pill));
  r('rail dot badge rendered', !!(await p.$('#ri-dot [data-slot=sidebar-rail-item-badge-dot]')));
  r('rail custom default slot inside <a href> cell', await inside('#ri-custom-slot', '#ri-custom a[data-slot=sidebar-rail-item]') && (await p.$eval('#ri-custom a', a => a.getAttribute('href')).catch(() => '')) === 'https://example.com/p');
  await p.hover('#ri-bell [data-slot=sidebar-rail-item]'); await wait(500);
  const tip = await ev(() => [...document.querySelectorAll('[role=tooltip], [data-reka-popper-content-wrapper]')].map(e => e.innerText.trim()).join('|'));
  r('rail item tooltip on hover shows label', /Notifications/.test(tip), tip);
  await p.click('#ri-bell [data-slot=sidebar-rail-item]'); await wait(80);
  r('rail item click event reaches petite @click exactly once', (await log()).split(',').filter(x => x === 'rail-bell').length === 1, await log());
  // --- collapse via toggle (inject sidebarToggleKey / sidebarCollapsedKey)
  r('collapse toggle label Collapse while expanded', (await txt('#toggle')) === 'Collapse', await txt('#toggle'));
  await p.mouse.move(600, 600);
  await p.click('#toggle button'); await wait(450);
  const sb2 = await rect('[data-slot=sidebar]');
  r('collapse toggle -> Sidebar toggles -> update:collapsed -> petite', (await state()).includes('collapsed=true'), await state());
  r('sidebar collapsed width (3rem) + data-state', sb2 && sb2.w <= 50 && (await p.$eval('[data-slot=sidebar]', e => e.dataset.state)) === 'collapsed', JSON.stringify(sb2));
  const labOpacity = await p.$eval('#si-inbox button > span:last-child', e => getComputedStyle(e).opacity).catch(() => 'ERR');
  r('items see collapsed via inject (label hidden)', labOpacity === '0', labOpacity);
  r('toggle label switches to Expand (inject)', (await p.$eval('#toggle button', b => b.getAttribute('aria-label')).catch(() => '')) === 'Expand', await p.$eval('#toggle button', b => b.getAttribute('aria-label')).catch(() => ''));
  await p.hover('#si-team-a [data-state=closed]'); await wait(1500);
  const tip2 = await ev(() => [...document.querySelectorAll('[role=tooltip], [data-reka-popper-content-wrapper]')].map(e => e.innerText.trim()).join('|') + ' tooltipTriggers=' + document.querySelectorAll('#si-team-a [data-state*=open], #si-team-a [data-state=closed]').length);
  r('collapsed sidebar: item tooltip shows its label (Tooltip enabled via injected collapsed)', /Team A/.test(tip2), tip2);
  await p.mouse.move(600, 600); await wait(200);
  await p.click('#toggle button'); await wait(450);
  r('toggle again expands', (await state()).includes('collapsed=false') && (await rect('[data-slot=sidebar]')).w > 200, await state());
  // petite -> collapsed prop
  await ev(() => { document.querySelector('#app').__vue_app__; });
});
