// Mobile shell: MobileShell + PageHeaderMobile(+Title, BackButton) + MobileNav(+Item)
require('./lib.cjs').run('mobile.html', async ({ p, r, wait, txt, vis, rect, state, log, inside }) => {
  const ev = (f, a) => p.evaluate(f, a);
  const shell = await rect('[data-slot=mobile-shell]');
  r('mobile-shell fills the viewport (fixed inset-0)', shell && shell.w === 390 && shell.h === 800, JSON.stringify(shell));
  const hdr = await rect('header'), nav = await rect('[data-slot=mobile-nav]'), sc = await rect('[data-slot=mobile-shell-scroll]');
  r('header on top, scroll region in the middle, nav slot at the bottom', hdr && nav && sc && hdr.y === 0 && sc.y >= hdr.h - 1 && nav.y + nav.h === 800 && sc.y + sc.h <= nav.y + 1, JSON.stringify({ hdr, sc, nav }));
  r('page-header-mobile teleported into MobileShell header target', await ev(() => { const h = document.querySelector('#phmt')?.closest('header'); const s = document.querySelector('[data-slot=mobile-shell]'); return !!h && s.firstElementChild.contains(h) }));
  r('mobile nav is inside the shell (nav slot)', await inside('[data-slot=mobile-nav]', '[data-slot=mobile-shell]'));
  r('content default slot inside the native scroll region', await inside('#mcontent', '[data-slot=mobile-shell-scroll]'));
  // header slots
  r('prefix slot: back button inside the absolutely placed prefix box', await inside('#back button', 'header .absolute.start-0'));
  r('suffix slot: action inside suffix box', await inside('#phm-act button', 'header .absolute.end-0'));
  r('default slot: mobile title inside <h1>, with its own prefix slot', await inside('#phmt', 'header h1') && await inside('#phmt-prefix', '#phmt'));
  r('mobile title text from :title binding', (await txt('#phmt')) === 'Inbox (home)', await txt('#phmt'));
  const t = await rect('header h1'), pre = await rect('#back button');
  r('title centred and inset past the prefix control', t && pre && t.x >= pre.x + pre.w - 1 && Math.abs((t.x + t.w / 2) - 195) < 3, JSON.stringify({ t, pre }));
  await p.click('#phm-act button'); await wait(100);
  r('suffix button click -> petite, title reactive', (await log()).includes('plus') && (await txt('#phmt')) === 'Drafts (home)', await log() + ' / ' + await txt('#phmt'));
  // nav items
  const st = (id) => p.$eval(id + ' [data-slot=mobile-nav-item]', e => e.dataset.state + ':' + e.tagName).catch(() => 'ERR');
  r('nav items: equal columns', await ev(() => { const ws = [...document.querySelectorAll('[data-slot=mobile-nav-item]')].map(e => Math.round(e.getBoundingClientRect().width)); return ws.length === 4 && ws.every(w => Math.abs(w - ws[0]) <= 1) }));
  await p.addStyleTag({ content: 'es-mobile-nav-item { display: contents }' }); await wait(50);
  r('host-page CSS es-mobile-nav-item{display:contents} -> buttons fill equal columns', await ev(() => { const ws = [...document.querySelectorAll('[data-slot=mobile-nav-item]')].map(e => Math.round(e.getBoundingClientRect().width)); return ws.length === 4 && ws.every(w => Math.abs(w - ws[0]) <= 1) }));
  r('nav item :active from petite', (await st('#mn-home')) === 'active:BUTTON' && (await st('#mn-search')) === 'inactive:BUTTON');
  r('nav item icon rendered (lucide class)', !!(await p.$('#mn-home [data-slot=mobile-nav-item] .lucide-home, #mn-home [data-slot=mobile-nav-item] svg')));
  await p.click('#mn-search [data-slot=mobile-nav-item]'); await wait(100);
  r('nav item click -> petite (exactly once), active moves', (await state()).includes('tab=search') && (await st('#mn-search')) === 'active:BUTTON' && (await st('#mn-home')) === 'inactive:BUTTON' && (await log()).split(',').filter(x => x === 'search').length === 1, await state() + ' / ' + await log());
  r('nav item default slot (custom glyph) replaces icon, label kept', await inside('#mn-me-slot', '#mn-me button') && (await txt('#mn-me button')).includes('Me'));
  r('nav item href -> <a href>', (await p.$eval('#mn-link a', a => a.getAttribute('href')).catch(() => '')) === 'https://example.com/docs');
  await p.focus('#mn-me button'); await p.keyboard.press('Enter'); await wait(100);
  r('keyboard Enter on nav item activates it', (await state()).includes('tab=me'), await state());
  // scroll
  const scrolled = await ev(() => { const s = document.querySelector('[data-slot=mobile-shell-scroll]'); s.scrollTop = 500; return s.scrollTop });
  r('shell scroll region scrolls, header stays', scrolled > 400 && (await rect('header')).y === 0, scrolled);
  // back button without a router
  const perr = []; p.on('pageerror', e => perr.push(e.message));
  const url0 = p.url();
  await p.click('#back button'); await wait(300);
  r('page-header-back-button works without vue-router (no throw / navigates)', !perr.length && p.url() !== url0, perr.join('; ') + ' url=' + p.url());
}, { viewport: { width: 390, height: 800 } });
