// The user's MobileNav on the es-* bundle, built through Frappe's esbuild + frappe-vue plugin, driven by mobile_nav.js (tag renamed).
const { run } = require('./lib.cjs')
const page = process.env.PAGE || 'mobile-desk.html'
run('mobile-' + page.replace('.html', ''), page, async ({ p, r, ev, errs }) => {
  await p.waitForFunction(() => frappe.ui.mobile_nav && window.ES)
  await p.waitForTimeout(300)
  const s0 = await ev(() => {
    const nav = frappe.ui.mobile_nav.nav
    return {
      sameVue: ES.Vue.createApp === frappe.Vue.createApp,
      appVersion: ES.app && ES.app.version, fVersion: frappe.Vue.version,
      items: $(nav).find('[data-slot=mobile-nav-item]').length, labels: $(nav).find('[data-slot=mobile-nav-item]').map((i, x) => x.getAttribute('aria-label')).get(),
      icons: $(nav).find('[data-slot=mobile-nav-item] svg[data-icon]').length,
      hasMobileNav: document.body.classList.contains('has-mobile-nav'), defined: frappe.ui.mobile_nav.defined,
      active: $(nav).find('[data-state=active]').attr('aria-label'), navRect: (() => { const b = nav.getBoundingClientRect(); return [Math.round(b.y), Math.round(b.height), Math.round(b.width)] })(),
    }
  })
  r('loads through Frappe esbuild (frappe-vue shim): ES uses Desk\'s one Vue, no hand-kept function list', s0.sameVue, s0)
  r('mobile_nav.js unchanged (tag renamed): 4 tabs with icons render, Home active, bar shown', s0.items === 4 && s0.icons === 4 && s0.active === 'Home' && s0.hasMobileNav && s0.navRect[1] >= 56, s0)
  // route change via tap
  const tag0 = await ev(() => { window.MARK = 1; return $('[data-slot=mobile-nav-item][aria-label=Search]')[0].localName + ' ' + $('[data-slot=mobile-nav-item][aria-label=Search]').attr('href') })
  await p.click('[data-slot=mobile-nav-item][aria-label=Search]')
  await p.waitForTimeout(400)
  const s1 = await ev(() => ({ sameDocument: window.MARK === 1, url: location.pathname, route: window.frappe && frappe.get_route && frappe.get_route(), active: window.jQuery && $('[data-slot=mobile-nav-item][data-state=active]').attr('aria-label') })).catch((e) => ({ err: e.message.slice(0, 100) }))
  r('tap on an item -> Desk router ($("body").on("click","a")) handles it, no full page load', s1.sameDocument && s1.active === 'Search', { rendered: tag0, ...s1 })
  if (!s1.sameDocument) { await p.goto('http://jq.test/review/pages/' + page); await p.waitForFunction(() => frappe.ui.mobile_nav && window.ES); await p.waitForTimeout(300) }

  // ISSUE 1: host class copied onto the inner root
  const s2 = await ev(() => {
    let n = 0
    const stop = (e) => e.preventDefault(); document.addEventListener('click', stop, true) // keep the page
    $(document).on('click.t', '.desk-mobile-nav', () => n++)
    $('[data-slot=mobile-nav-item][aria-label=Home]')[0].click()
    $(document).off('click.t'); document.removeEventListener('click', stop, true)
    const navEl = frappe.ui.mobile_nav.nav, inner = navEl.querySelector('[data-slot=mobile-nav]')
    return { matches: $('.desk-mobile-nav').length, innerHasClass: inner.classList.contains('desk-mobile-nav'), delegatedFires: n, innerOutline: getComputedStyle(inner).outlineStyle, hostDisplay: getComputedStyle(navEl).display }
  })
  r('ISSUE 1 host class is NOT copied onto the inner root (no double styles / double delegated handlers)', s2.matches === 1 && s2.delegatedFires === 1, s2)

  // ISSUE 2: children read only once at connect
  const s3 = await ev(() => {
    const tab = frappe.ui.mobile_nav.tabs[1]
    tab.el.innerHTML = frappe.utils.icon('star', 'md') // innerHTML after connect
    const icon1 = $(tab.el).find('svg').attr('data-icon')
    $(tab.el).html(frappe.utils.icon('moon', 'md')) // jQuery form
    const icon2 = $(tab.el).find('svg').attr('data-icon')
    // rebuild all tabs: nav.innerHTML = '' then make_tab again
    const mn = frappe.ui.mobile_nav
    mn.nav.innerHTML = ''
    mn.tabs = mn.get_tabs().map((t) => mn.make_tab(t)); mn.set_active()
    ES.flush()
    const items = $(mn.nav).find('[data-slot=mobile-nav-item]').length
    // add a 5th tab later with appendChild
    const extra = document.createElement('es-mobile-nav-item'); extra.setAttribute('label', 'Extra'); extra.setAttribute('to', '/desk/extra'); extra.innerHTML = frappe.utils.icon('plus', 'md'); mn.nav.appendChild(extra)
    const items2 = $(mn.nav).find('[data-slot=mobile-nav-item]').length
    const order = $(mn.nav).find('[data-slot=mobile-nav-item]').map((i, x) => x.getAttribute('aria-label')).get()
    return { icon1, icon2, items, items2, order, active: $(mn.nav).find('[data-state=active]').attr('aria-label') }
  })
  r('ISSUE 2 children are live: innerHTML / .html() after connect, rebuild, late appendChild', s3.icon1 === 'star' && s3.icon2 === 'moon' && s3.items === 4 && s3.items2 === 5 && s3.order[4] === 'Extra', s3)
  await p.waitForTimeout(300)

  // ISSUE 3: box-sizing without Tailwind preflight (only es-ui.scoped.css)
  const s4 = await ev(() => {
    const it = document.querySelector('[data-slot=mobile-nav-item]')
    const cs = getComputedStyle(it), pb = getComputedStyle(document.getElementById('plainbtn'))
    return { itemBoxSizing: cs.boxSizing, itemMinH: cs.minHeight, h: Math.round(it.getBoundingClientRect().height), plainBtnBoxSizing: pb.boxSizing, plainBtnWidth: Math.round(document.getElementById('plainbtn').getBoundingClientRect().width), bodyMargin: getComputedStyle(document.body).margin, sheets: [...document.styleSheets].map((s) => (s.href || 'inline').split('/').pop()) }
  })
  r('ISSUE 3 item gets border-box from the scoped preflight; the page\'s own elements are untouched', s4.itemBoxSizing === 'border-box' && s4.h >= 56, s4)

  // where do the styles come from / cost
  const s5 = await ev(() => ({ jsKB: Math.round(performance.getEntriesByType('resource').filter((e) => e.name.includes('mobile_nav_es')).map((e) => e.decodedBodySize)[0] / 1024), cssKB: Math.round(performance.getEntriesByType('resource').filter((e) => e.name.includes('scoped')).map((e) => e.decodedBodySize)[0] / 1024), tags: ES.registered.length }))
  r('INFO download cost for the tab bar', true, s5)
})
