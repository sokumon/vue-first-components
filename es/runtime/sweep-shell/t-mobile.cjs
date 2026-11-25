// jQuery-driven re-run of wc/sweep/shell/t-mobile.cjs + Desk-style operations.
require('./lib.cjs')('mobile.html', async ({ p, r, txt, st, ev, W, vis, rect, inside, log, safe, errs, errCount }) => {
  const sst = (id) => p.$eval(id + ' [data-slot=mobile-nav-item]', (e) => e.dataset.state + ':' + e.tagName).catch(() => 'ERR')
  const cols = () => ev(() => { const ws = [...document.querySelectorAll('[data-slot=mobile-nav-item]')].map((e) => Math.round(e.getBoundingClientRect().width)); return ws.length >= 4 && ws.every((w) => Math.abs(w - ws[0]) <= 1) ? ws.length : ws })
  let t = 'es-mobile-shell'
  await safe(t, 'core', async () => {
    const shell = await rect('[data-slot=mobile-shell]')
    r(t, 'fills the viewport (fixed inset-0)', shell && shell.w === 390 && shell.h === 800, shell)
    const hdr = await rect('header'), nav = await rect('[data-slot=mobile-nav]'), sc = await rect('[data-slot=mobile-shell-scroll]')
    r(t, 'header on top, scroll region middle, nav at the bottom', hdr && nav && sc && hdr.y === 0 && sc.y >= hdr.h - 1 && nav.y + nav.h === 800 && sc.y + sc.h <= nav.y + 1, { hdr, sc, nav })
    r('es-page-header-mobile', 'teleported into MobileShell header target', await ev(() => { const h = document.querySelector('#phmt')?.closest('header'); const s = document.querySelector('[data-slot=mobile-shell]'); return !!h && s.firstElementChild.contains(h) }))
    r('es-mobile-nav', 'inside the shell (nav slot)', await inside('[data-slot=mobile-nav]', '[data-slot=mobile-shell]'))
    r(t, 'content default slot inside the scroll region', await inside('#mcontent', '[data-slot=mobile-shell-scroll]'))
    r('es-page-header-mobile', 'prefix slot: back button in the prefix box', await inside('#back button', 'header .absolute.start-0'))
    r('es-page-header-mobile', 'suffix slot: action in the suffix box', await inside('#phm-act button', 'header .absolute.end-0'))
    r('es-page-header-mobile-title', 'inside <h1>, with its own prefix slot', await inside('#phmt', 'header h1') && await inside('#phmt-prefix', '#phmt'))
    r('es-page-header-mobile-title', 'title from .prop', (await txt('#phmt')) === 'Inbox (home)', await txt('#phmt'))
    const tt = await rect('header h1'), pre = await rect('#back button')
    r('es-page-header-mobile', 'title centred and inset past the prefix control', tt && pre && tt.x >= pre.x + pre.w - 1 && Math.abs((tt.x + tt.w / 2) - 195) < 3, { tt, pre })
    await p.click('#phm-act button'); await W(100)
    r('es-page-header-mobile', 'suffix button click -> jQuery handler, title follows', (await log()).includes('plus') && (await txt('#phmt')) === 'Drafts (home)', await txt('#phmt'))
  })
  t = 'es-mobile-nav-item'
  await safe(t, 'core', async () => {
    r(t, 'equal columns (no host-page CSS needed)', (await cols()) === 4, await cols())
    r(t, ':active from .prop', (await sst('#mn-home')) === 'active:BUTTON' && (await sst('#mn-search')) === 'inactive:BUTTON')
    r(t, 'icon rendered', !!(await p.$('#mn-home [data-slot=mobile-nav-item] .lucide-home, #mn-home [data-slot=mobile-nav-item] svg')))
    await p.click('#mn-search [data-slot=mobile-nav-item]'); await W(100)
    r(t, 'click -> delegated .on("click", item) exactly once, active moves', (await st()).tab === 'search' && (await sst('#mn-search')) === 'active:BUTTON' && (await sst('#mn-home')) === 'inactive:BUTTON' && (await log()).split(',').filter((x) => x === 'search').length === 1, await log())
    r(t, 'default slot (custom glyph) replaces icon, label kept', await inside('#mn-me-slot', '#mn-me button') && (await txt('#mn-me button')).includes('Me'))
    r(t, 'href -> <a href>', (await p.$eval('#mn-link a', (a) => a.getAttribute('href')).catch(() => '')) === 'https://example.com/docs')
    await p.focus('#mn-me button'); await p.keyboard.press('Enter'); await W(100)
    r(t, 'keyboard Enter activates', (await st()).tab === 'me')
    const scrolled = await ev(() => { const s = document.querySelector('[data-slot=mobile-shell-scroll]'); s.scrollTop = 500; return s.scrollTop })
    r('es-mobile-shell', 'scroll region scrolls, header stays', scrolled > 400 && (await rect('header')).y === 0, scrolled)
  })
  t = 'es-mobile-nav'
  await safe(t, 'desk ops', async () => {
    await ev(() => $('#nav').append('<es-mobile-nav-item id="mn-new" label="New" icon="lucide-plus" data-tab="new"></es-mobile-nav-item>')); await W(150)
    r(t, '.append() an item from a string: 5 equal columns', (await cols()) === 5, await cols())
    await p.click('#mn-new [data-slot=mobile-nav-item]'); await W(100)
    r(t, 'delegated handler fires for the appended item', (await st()).tab === 'new')
    await ev(() => $('#mn-new').remove()); await W(150)
    r(t, '.remove() an item: 4 columns again', (await cols()) === 4, await cols())
    const e0 = await errCount()
    await ev(() => { const $i = $('#mn-home').detach(); $('#nav').append($i) }); await W(150)
    r(t, 'reorder: .detach() first item + .append() to the same nav (same task): moved last, no error', await ev(() => { const xs = [...document.querySelectorAll('[data-slot=mobile-nav-item]')]; return xs.length === 4 && document.querySelector('#mn-home [data-slot=mobile-nav-item]') === xs[3] }) && (await errCount()) === e0, errs.slice(e0))
    await p.click('#mn-home [data-slot=mobile-nav-item]'); await W(100)
    r(t, 'moved item still works', (await st()).tab === 'home' && (await sst('#mn-home')) === 'active:BUTTON')
    await ev(() => $('#mn-search').clone().attr({ id: 'mn-search2', label: 'Find', 'data-tab': 'find' }).appendTo('#nav')); await W(150)
    r(t, '.clone() of an item with .attr changes: 5 columns, clone label', (await cols()) === 5 && (await txt('#mn-search2 button')).includes('Find'), await txt('#mn-search2'))
    await ev(() => $('#mn-search2').remove())
  })
  t = 'es-page-header-mobile-title'
  await safe(t, 'desk ops', async () => {
    await ev(() => $('#phmt').html('<span slot="prefix" id="phmt-p2" class="lucide-star size-4"></span>')); await W(150)
    r(t, '.html() on host with a named-slot child: prefix replaced, title prop kept', await inside('#phmt-p2', 'header h1') && !(await p.$('#phmt-prefix')) && (await txt('#phmt')).includes('Drafts'), await txt('#phmt'))
  })
  t = 'es-page-header-mobile'
  await safe(t, 'desk ops', async () => {
    await ev(() => $('#phm').append('<es-button slot="suffix" id="phm-act2" icon="lucide-search" variant="ghost"></es-button>')); await W(150)
    r(t, '.append() a second suffix button: both in the suffix box', await inside('#phm-act2 button', 'header .absolute.end-0') && await inside('#phm-act button', 'header .absolute.end-0'))
    const e0 = await errCount()
    await ev(() => { const $h = $('#phm').detach(); $('#ms').prepend($h) }); await W(200)
    r(t, '.detach() + .prepend() back into the shell: header still teleported, no error', await ev(() => { const h = document.querySelector('#phmt')?.closest('header'); const s = document.querySelector('[data-slot=mobile-shell]'); return !!h && s.firstElementChild.contains(h) }) && (await ev(() => document.querySelectorAll('header').length)) === 1 && (await errCount()) === e0, errs.slice(e0))
  })
  await safe('es-page-header-back-button', 'no router', async () => {
    const url0 = p.url(), e0 = await errCount()
    await p.click('#back button'); await W(300)
    r('es-page-header-back-button', 'works without vue-router (no throw, navigates)', (await errCount()) === e0 && p.url() !== url0, errs.slice(e0).join('; ') + ' url=' + p.url())
    // workaround: the component needs vue-router; install one on the one app, then a NEW back button gets it
    await ev(() => {
      const R = ES.VueRouter
      ES.configure((app) => app.use(R.createRouter({ history: R.createWebHashHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] })))
      $('#desk-back, #app').first().append('<es-page-header-back-button id="back2" fallback-route="/home"></es-page-header-back-button>')
    }); await W(300)
    const e1 = await errCount(), u1 = p.url()
    await p.click('#back2 button').catch((e) => console.log('   ', e.message.slice(0, 80))); await W(900)
    r('es-page-header-back-button', 'with ES.configure(app => app.use(router)): a new back button navigates to fallback-route', (await errCount()) === e1 && /#\/home$/.test(p.url()), errs.slice(e1).join('; ') + ' url=' + p.url())
  })
}, { viewport: { width: 390, height: 800 } })
