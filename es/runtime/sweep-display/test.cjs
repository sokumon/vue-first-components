// jQuery-driven re-run of wc/sweep/display on wc/jq/dist. Usage: . ~/fb/env.sh && node wc/jq/sweep-display/test.cjs [dist-prefix]
// dist-prefix defaults to /dist (the shared build); pass /sweep-display/fix-dist to try a prototype fix.
const { open } = require('../test/lib.cjs')
const fs = require('fs')
const DIST = process.argv[2] || '/dist'
const pageFile = __dirname + '/page-run.html'
fs.writeFileSync(pageFile, fs.readFileSync(__dirname + '/page.html', 'utf8').replace('/dist/es-ui.iife.js', DIST + '/es-ui.iife.js').replace('/dist/es-ui.css', DIST === '/dist' ? '/dist/es-ui.css' : DIST + '/es-wc-spike.css'))
// (a prototype build has its own scoped-style hashes, so it brings its own CSS)

;(async () => {
  const { b, p, errs } = await open()
  p.on('console', (m) => m.type() === 'warning' && errs.push('warning: ' + m.text().slice(0, 240)))
  await p.setViewportSize({ width: 1200, height: 1400 })
  await p.goto('http://jq.test/sweep-display/page-run.html')
  await p.waitForFunction(() => window.__built)
  await p.waitForTimeout(400)
  const results = {}; let fails = 0
  const r = (tag, k, v, info = '') => {
    if (!v) fails++;
    (results[tag] ||= []).push([!!v, k, v ? '' : String(info).slice(0, 300)])
    console.log((v ? 'PASS ' : 'FAIL ') + tag + ' | ' + k + (info !== '' ? '  -> ' + String(info).replace(/\n/g, ' / ').slice(0, 200) : ''))
  }
  const txt = (s) => p.$eval(s, (e) => e.innerText.trim()).catch(() => 'ERR');
  const ev = (fn, a) => p.evaluate(fn, a);
  const state = () => ev(() => JSON.parse(document.getElementById('state').textContent));
  const box = (s) => p.$eval(s, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } }).catch(() => null);
  const inside = (inner, outer) => ev(([i, o]) => { const a = document.querySelector(i), c = document.querySelector(o); return !!a && !!c && c.contains(a) }, [inner, outer]);
  const safe = async (tag, name, fn) => { try { await fn() } catch (e) { r(tag, name + ' (threw)', false, e.message.split('\n')[0]) } }

  // ================= original per-element scenarios, now driven by jQuery (page.js) =================
  // ---------- es-alert ----------
  try {
    const t = 'es-alert';
    r(t, 'row layout, role=status, title prop', await ev(() => { const d = document.querySelector('#al-row [data-layout]'); return d.dataset.layout === 'row' && d.getAttribute('role') === 'status' && d.innerText.trim() === 'Saved' && !!d.querySelector('[data-slot=prefix] svg') }));
    r(t, 'title prop does not leave a native title tooltip on the host', await ev(() => !document.getElementById('al-row').hasAttribute('title') && document.querySelector('#al-row [data-slot=title]').innerText === 'Saved'));
    r(t, ':icon="false" hides the status icon (Boolean false via property)', await ev(() => !document.querySelector('#al-noicon [data-slot=prefix]')));
    r(t, 'banner layout from description; red -> role=alert', await ev(() => { const d = document.querySelector('#al-banner [data-layout]'); return d.dataset.layout === 'banner' && d.getAttribute('role') === 'alert' && d.innerText.includes('The server did not answer.') }));
    await p.click('#al-banner button:has-text("Later")');
    r(t, 'secondaryAction object onClick runs', await ev(() => window.__secondary === 1));
    await p.click('#al-banner button:has-text("Retry")'); await p.waitForTimeout(100);
    let s = await state();
    r(t, 'primaryAction onClick({dismiss}) -> dismiss event -> jQuery .remove() removes alert', (await ev(() => window.__primary)) === 1 && !s.showAlert && s.dismissed === 1 && !(await p.$('#al-banner')), JSON.stringify(s));
    r(t, 'named slots title/description/prefix land in their regions', await inside('#al-slot-title', '#al-slots [data-slot=title]') && await inside('#al-slot-desc', '#al-slots [data-slot=description]') && await inside('#al-slot-prefix', '#al-slots [data-slot=prefix]'));
    r(t, 'actions slot (non-scoped use) lands in actions region', await inside('#al-slot-action', '#al-slots [data-slot=actions]'));
    await p.click('#al-slot-action button'); await p.waitForTimeout(50);
    r(t, 'slot content stays reactive (click in actions slot -> title slot interpolation)', (await txt('#al-slot-title')) === 'Hello Grace', await txt('#al-slot-title'));
    await p.click('#al-slots [data-slot=dismiss]'); await p.waitForTimeout(50);
    r(t, 'dismissible x emits dismiss', (await state()).dismissed === 2);
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-avatar ----------
  try {
    const t = 'es-avatar';
    r(t, 'label initial + size xl (32px) + theme blue', await ev(() => { const d = document.querySelector('#av-label > div'); const r = d.getBoundingClientRect(); return d.innerText.trim() === 'A' && r.width === 32 && d.innerHTML.includes('bg-surface-blue-2') }));
    r(t, 'broken image falls back to initial', (await txt('#av-broken')) === 'Z' && !(await p.$('#av-broken img')));
    r(t, 'image renders <img> that loaded', await p.$eval('#av-img img', (i) => i.complete && i.naturalWidth > 0).catch(() => false));
    r(t, 'default slot replaces initial, indicator slot in corner box', await inside('#av-default', '#av-slots > div > div:first-child') && await inside('#av-ind', '#av-slots .absolute') && (await txt('#av-slots')) === '★');
    const bx = await box('#av-class > div');
    r(t, 'class="size-16" sizing override (documented) reaches the avatar root', bx && bx.w === 64, JSON.stringify(bx));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-badge ----------
  try {
    const t = 'es-badge';
    r(t, 'label prop', (await txt('#bd-label')) === 'Draft');
    r(t, ':label number + solid/lg', (await txt('#bd-num')) === '42' && await ev(() => document.querySelector('#bd-num > div').className.includes('bg-surface-blue-7')));
    const order = await ev(() => { const d = document.querySelector('#bd-slots > div'); const t = d.innerText; return [d.contains(document.getElementById('bd-pre')), d.contains(document.getElementById('bd-suf')), t] });
    r(t, 'prefix/default/suffix slots inside badge in order, reactive', order[0] && order[1] && /●\s*Live\s+Grace\s*→/.test(order[2]), order[2]);
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-breadcrumbs ----------
  try {
    const t = 'es-breadcrumbs';
    r(t, 'items prop renders crumbs with separators', /^(#\s*)?Home\s*\/\s*(#\s*)?Projects\s*\/\s*(#\s*)?Website$/.test(await txt('#bc')), await txt('#bc'));
    await p.click('#bc button:has-text("Website")');
    r(t, 'onClick item (button crumb)', (await ev(() => window.__crumb)) === 'Website');
    await p.click('#bc a:has-text("Projects")');
    r(t, 'href+onClick: plain click runs handler and does not navigate', (await ev(() => window.__crumb)) === 'Projects' && (await ev(() => location.hash)) !== '#projects', await ev(() => location.hash));
    await p.click('#bc a:has-text("Home")');
    r(t, 'href item navigates', (await ev(() => location.hash)) === '#home');
    const pre = await ev(() => [...document.querySelectorAll('#bc a, #bc button')].map((c) => c.innerText.trim()));
    r(t, 'scoped #prefix slot rendered for every crumb', pre.every((x) => x.startsWith('#')), JSON.stringify(pre));
    r(t, 'overflow collapses to ellipsis dropdown + last two', !!(await p.$('#bc-many [data-slot=trigger]')) && (await txt('#bc-many')).includes('Epsilon five') && !(await txt('#bc-many')).includes('Alpha'), await txt('#bc-many'));
    await p.click('#bc-many [data-slot=trigger]'); await p.waitForTimeout(300);
    const mi = await p.$$eval('[role=menuitem]', (els) => els.map((e) => e.innerText.trim()));
    r(t, 'overflow dropdown (teleported) lists hidden crumbs', mi.join(',') === 'Alpha one,Beta two,Gamma three', mi.join(','));
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    r(t, 'route item: router-link resolves to a link', await ev(() => !document.querySelector('#bc-route router-link') && !!document.querySelector('#bc-route a')), await ev(() => document.querySelector('#bc-route div div').innerHTML.slice(0, 80)));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-button ----------
  try {
    const t = 'es-button';
    const o = await ev(() => { const btn = document.querySelector('#bt-ps button'); return [btn.contains(document.getElementById('bt-pre')), btn.contains(document.getElementById('bt-suf')), btn.innerText.replace(/\s+/g, ' ').trim()] });
    r(t, 'prefix/default/suffix slots inside <button> in order', o[0] && o[1] && o[2] === '[P] Middle [S]' || o[2] === '[P]Middle[S]', o[2]);
    const ic = await ev(() => { const s = document.querySelector('#bt-icon button span[class*=lucide-x]'); const r = s?.getBoundingClientRect(); return { w: r?.width, mask: s && getComputedStyle(s).maskImage.slice(0, 20), label: document.querySelector('#bt-icon button').getAttribute('aria-label') } });
    r(t, 'icon="lucide-x" renders sized mask icon', ic.w > 0 && ic.mask && ic.mask !== 'none', JSON.stringify(ic));
    r(t, 'host aria-label reaches the inner <button> (icon button accessible name)', ic.label === 'Close', JSON.stringify(ic));
    const si = await ev(() => document.querySelector('#bt-slot-icon button').getBoundingClientRect().width);
    r(t, 'default slot = one lucide icon -> square icon button (28px)', si === 28, si);
    const si2 = await ev(() => document.querySelector('#bt-icon-slot button').getBoundingClientRect().width);
    r(t, 'host convention: slot="icon" -> square icon button (28px)', si2 === 28, si2);
    await p.hover('#bt-tip button'); await p.waitForTimeout(800);
    const tip = await ev(() => { const b = document.querySelector('[data-slot=bubble]'); const t = document.querySelector('#bt-tip button').getBoundingClientRect(); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.innerText, dy: t.top - r.bottom, dx: Math.abs((t.left + t.width / 2) - (r.left + r.width / 2)) } });
    r(t, 'tooltip prop shows bubble above the button after hover delay', tip && tip.text === 'Button tip' && tip.dy >= 0 && tip.dy < 20 && tip.dx < 5, JSON.stringify(tip));
    await p.mouse.move(5, 1350); await p.waitForTimeout(300);
    await p.click('#bt-dis button', { force: true }); await p.waitForTimeout(50);
    r(t, 'disabled: @click on host not fired', !(await state()).log.includes('disabled-click'), JSON.stringify((await state()).log));
    r(t, 'href -> <a target=_blank>', await ev(() => { const a = document.querySelector('#bt-href a'); return a && a.href === 'https://example.com/x' && a.target === '_blank' }));
    r(t, 'loading + loading-text: spinner, text, disabled', await ev(() => { const b = document.querySelector('#bt-lt button'); return b.disabled && b.innerText.trim() === 'Saving...' && !!b.querySelector('svg[role=status]') }));
    await p.click('#bt-submit button'); await p.waitForTimeout(50);
    r(t, 'type=submit submits the enclosing form', (await ev(() => window.__submitted)) === 1);
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-divider ----------
  try {
    const t = 'es-divider';
    const h = await box('#dv-h hr'); const sec = await box('#s-divider');
    r(t, 'horizontal rule spans the container', h && Math.abs(h.w - sec.w) < 2, JSON.stringify(h));
    const v = await box('#dv-v hr');
    r(t, 'vertical + flex-item stretches to the flex row height (40px)', v && v.h >= 39, JSON.stringify(v));
    const btn = await box('#dv-act button'); const line = await box('#dv-act [role=separator]');
    r(t, 'action button on the rule, align=start', btn && line && btn.x - line.x > 10 && btn.x - line.x < 30 && line.w > 300, JSON.stringify({ btn, line }));
    await p.click('#dv-act button');
    r(t, 'action.onClick runs', (await ev(() => window.__divider)) === 1);
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-error-message ----------
  try {
    const t = 'es-error-message';
    r(t, ':message string', (await txt('#em-str')) === 'Name is required');
    r(t, ':message array -> one line each', (await txt('#em-arr')) === 'First problem\nSecond problem', await txt('#em-arr'));
    r(t, 'HTML kept but sanitized (no onerror)', await ev(() => !!document.querySelector('#em-xss b') && !document.querySelector('#em-xss img[onerror]') && !window.__xss));
    r(t, 'empty message renders nothing', await ev(() => !document.querySelector('#em-empty [role=alert]')));
    await p.click('#em-clear button'); await p.waitForTimeout(50);
    r(t, 'clearing the bound message removes it', await ev(() => !document.querySelector('#em-str [role=alert]')));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-form-label ----------
  try {
    const t = 'es-form-label';
    r(t, 'label + required asterisk', /Email\s*\*/.test(await txt('#fl')));
    r(t, ':id prop -> label[for]', await ev(() => document.querySelector('[data-t=fl2] label').htmlFor === 'phone-input'));
    const dup = await ev(() => document.querySelectorAll('[id="phone-input"]').length);
    r(t, ':id prop does not rewrite the host element id (no duplicate ids)', dup === 1, dup + ' elements with id=phone-input');
    await p.click('[data-t=fl2] label');
    r(t, 'clicking the label focuses the control', await ev(() => document.activeElement?.tagName === 'INPUT'), await ev(() => document.activeElement?.tagName));
    r(t, 'unknown host attribute (data-t) not leaked camelized onto the label', await ev(() => !document.querySelector('[data-t=fl2] label').hasAttribute('datat')), await ev(() => document.querySelector('[data-t=fl2] label').outerHTML.slice(0, 120)));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-icon ----------
  try {
    const t = 'es-icon';
    const l = await box('#ic-lucide span');
    r(t, 'lucide icon renders a visible mask glyph', l && l.w > 0, JSON.stringify(l));
    r(t, 'class="size-6" on the element sizes the glyph (Icon binds $attrs to its root)', l && l.w === 24, JSON.stringify(l));
    r(t, 'emoji', (await txt('#ic-emoji')) === '🔥');
    r(t, 'name alias', await ev(() => !!document.querySelector('#ic-name span.lucide-x')));
    r(t, 'unsupported string renders nothing', await ev(() => !document.querySelector('#ic-bad span')));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-keyboard-shortcut ----------
  try {
    const t = 'es-keyboard-shortcut';
    r(t, 'combo Mod+K -> Ctrl+K on Linux with aria-label', (await txt('#kb-plain')).replace(/\s/g, '').toLowerCase() === 'ctrl+k' && await ev(() => document.querySelector('#kb-plain [role=img]').getAttribute('aria-label') === 'Shortcut Control + K'), await txt('#kb-plain'));
    r(t, 'bg -> kbd chips (Enter as icon)', await ev(() => { const k = document.querySelectorAll('#kb-bg kbd'); return k.length === 3 && !!k[2].querySelector('.lucide-corner-down-left') }));
    r(t, ':alt-combos array + :show-plus', await ev(() => document.querySelectorAll('#kb-alt [data-slot=alt-combos] [data-slot=keyboard-shortcut]').length === 2));
    r(t, 'default slot fallback when no combo (reactive)', (await txt('#kb-slot')).replace(/\s+/g, ' ') === 'Fallback Grace', await txt('#kb-slot'));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- spinner / loading ----------
  try {
    const s = await ev(() => { const g = (q) => { const e = document.querySelector(q); const r = e.getBoundingClientRect(); return [r.width, r.height, e.getAttribute('class')] }; return { lg: g('#sp-lg svg'), def: g('#sp-def svg'), li: g('#li svg') } });
    r('es-spinner', 'size lg = 20px, theme red, track', s.lg[0] === 20 && s.lg[2].includes('text-ink-red-7') && s.lg[2].includes('fui-spinner--track'), JSON.stringify(s.lg));
    r('es-spinner', 'default 16px, animated (scoped style present)', s.def[0] === 16 && await ev(() => getComputedStyle(document.querySelector('#sp-def svg')).animationName.startsWith('fui-spinner-rotate')));
    r('es-loading-indicator', 'alias of Spinner, size xs = 12px', s.li[0] === 12, JSON.stringify(s.li));
    r('es-loading-text', 'default text + spinner', (await txt('#lt-def')) === 'Loading...' && !!(await p.$('#lt-def svg')));
    r('es-loading-text', 'text prop', (await txt('#lt')) === 'Fetching rows');
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-progress ----------
  try {
    const t = 'es-progress';
    const g = () => ev(() => { const pb = document.querySelector('#pg [role=progressbar]'); return { now: pb.getAttribute('aria-valuenow'), label: pb.getAttribute('aria-label'), hint: document.querySelector('#pg .self-end').innerText.trim(), tf: pb.firstElementChild.style.transform } });
    let a = await g();
    r(t, ':value + label + hint', a.now === '40' && a.label === 'Upload' && a.hint === '40%' && a.tf.includes('-60'), JSON.stringify(a));
    await p.click('#pg-inc button'); await p.waitForTimeout(50);
    a = await g();
    r(t, 'reactive value update (bar, aria, hint)', a.now === '60' && a.hint === '60%' && a.tf.includes('-40'), JSON.stringify(a));
    r(t, '#hint slot reactive', (await txt('#pg-hint')) === '60 of 100' && await inside('#pg-hint', '#pg-slot .self-end'));
    r(t, 'intervals: 2 of 4 filled', await ev(() => [...document.querySelectorAll('#pg-int [role=progressbar] > div')].filter((d) => d.className.includes('bg-surface-gray-10')).length === 2));
    r(t, 'value as string attribute', await ev(() => document.querySelector('#pg-attr [role=progressbar]').getAttribute('aria-valuenow') === '75'));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-skeleton ----------
  try {
    const k = await box('#sk > div');
    r('es-skeleton', 'class="h-4 w-32" sizes the visible pulse block', k && k.w === 128 && k.h === 16, JSON.stringify(k));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-tooltip ----------
  try {
    const t = 'es-tooltip';
    const bubble = (trig) => ev((trig) => { const b = document.querySelector('[data-slot=bubble]'); if (!b) return null; const t = document.querySelector(trig).getBoundingClientRect(); const r = b.getBoundingClientRect(); return { text: b.innerText, top: r.top, bottom: r.bottom, cx: r.left + r.width / 2, tcx: t.left + t.width / 2, ttop: t.top, tbottom: t.bottom } }, trig);
    await p.hover('#tt-btn'); await p.waitForTimeout(300);
    let bb = await bubble('#tt-btn');
    r(t, 'hover shows text bubble', bb && bb.text === 'Plain tip', JSON.stringify(bb));
    r(t, 'bubble positioned above its trigger (side=top)', bb && Math.abs(bb.cx - bb.tcx) < 6 && bb.ttop - bb.bottom >= 0 && bb.ttop - bb.bottom < 20, JSON.stringify(bb));
    await p.mouse.move(5, 1350); await p.waitForTimeout(400);
    r(t, 'leaving closes it', !(await p.$('[data-slot=bubble]')));
    await p.hover('#tt-slot-btn'); await p.waitForTimeout(300);
    bb = await bubble('#tt-slot-btn');
    r(t, '#content slot (reactive interpolation) shown, side=bottom', bb && bb.text === 'Rich tip for Grace' && bb.top - bb.tbottom >= 0 && bb.top - bb.tbottom < 20, JSON.stringify(bb));
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    r(t, 'Escape closes', !(await p.$('[data-slot=bubble]')));
    await p.mouse.move(5, 1350); await p.waitForTimeout(300);
    await p.hover('#tt-dis-btn'); await p.waitForTimeout(400);
    r(t, 'disabled: no bubble', !(await p.$('[data-slot=bubble]')));
    await p.mouse.move(5, 1350); await p.waitForTimeout(300);
    await p.hover('#tt-es-btn button'); await p.waitForTimeout(300);
    bb = await bubble('#tt-es-btn button');
    r(t, 'trigger that is itself an es-* element (es-button): bubble anchored to it', bb && bb.text === 'On es-button' && Math.abs(bb.cx - bb.tcx) < 6 && bb.ttop - bb.bottom >= 0 && bb.ttop - bb.bottom < 20, JSON.stringify(bb));
    await p.mouse.move(5, 1350); await p.waitForTimeout(300);
    // keyboard focus
    await p.focus('#em-clear button');
    for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); if (await ev(() => document.activeElement?.id === 'tt-btn')) break }
    await p.waitForTimeout(300);
    bb = await bubble('#tt-btn');
    r(t, 'keyboard focus (Tab) opens the bubble', bb && bb.text === 'Plain tip', JSON.stringify(bb) + ' active=' + await ev(() => document.activeElement?.id));
    await p.keyboard.press('Escape'); await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(300);
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-tooltip-provider ----------
  try {
    const t = 'es-tooltip-provider';
    await p.mouse.move(5, 1350); await p.waitForTimeout(300);
    await p.hover('#tp-a-btn'); await p.waitForTimeout(150);
    const early = await ev(() => document.querySelector('[data-slot=bubble]')?.innerText);
    await p.waitForTimeout(600);
    const late = await ev(() => document.querySelector('[data-slot=bubble]')?.innerText);
    r(t, 'child tooltips work inside the provider', late === 'Group tip A', late);
    r(t, 'provider hover-delay=0 applies to child es-tooltip (open within 150ms)', early === 'Group tip A', 'at 150ms: ' + early);
    const chain = await ev(() => { const names = []; for (let i = document.getElementById('tp-a').esComponent?.$; i; i = i.parent) names.push(i.type.name || i.type.__name); return names });
    r(t, 'child es-tooltip is a Vue descendant of the TooltipProvider (one tree)', chain.includes('TooltipProvider'), chain.join('<'));
    await p.mouse.move(5, 1350); await p.waitForTimeout(300);
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-item-list-row ----------
  try {
    const t = 'es-item-list-row';
    const o = await ev(() => { const row = document.querySelector('#ir [data-slot=item-list-row]'); const q = (s) => row.querySelector(s); return [q('[data-slot=item-prefix]')?.contains(document.getElementById('ir-pre')), q('[data-slot=item-label]')?.innerText.trim(), q('[data-slot=item-suffix]')?.contains(document.getElementById('ir-suf')), row.getBoundingClientRect().height] });
    r(t, 'prefix / default label / suffix regions, size md (32px), reactive', o[0] && o[1] === 'Row Grace' && o[2] && o[3] === 32, JSON.stringify(o));
    r(t, 'active -> data-state=active; #label slot', await ev(() => document.querySelector('#ir-active [data-slot=item-list-row]').dataset.state === 'active') && await inside('#ir-label', '#ir-active [data-slot=item-label]'));
    r(t, 'no prefix slot -> no prefix region', await ev(() => !document.querySelector('#ir-active [data-slot=item-prefix]')));
    await p.click('#ir-btn button');
    r(t, 'as="button" renders a button; host @click fires', (await state()).log.includes('row-click'));
    r(t, 'disabled styling', await ev(() => document.querySelector('#ir-dis [data-slot=item-list-row]').hasAttribute('data-disabled')));
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }

  // ---------- es-tree ----------
  try {
    const t = 'es-tree';
    const vis = () => ev(() => [...document.querySelectorAll('#tree [role=treeitem]')].map((li) => li.querySelector('[data-slot=row]').innerText.replace(/\s+/g, ' ').trim()));
    let v = await vis();
    r(t, ':nodes + :expanded=["a"] renders roots and open children', v.length === 5 && v[1].startsWith('Fuji'), JSON.stringify(v));
    r(t, 'item-suffix slot rendered on every row', await ev(() => [...document.querySelectorAll('#tree [data-slot=row]')].every((r) => r.querySelector('.tree-suf'))), await ev(() => document.querySelectorAll('#tree .tree-suf').length + ' of ' + document.querySelectorAll('#tree [data-slot=row]').length));
    await p.click('#tree [role=treeitem][aria-level="1"]:nth-child(2) > [data-slot=row]'); await p.waitForTimeout(80);
    let s = await state();
    r(t, 'row click -> update:expanded event -> jQuery state, child shows', JSON.stringify(s.expanded) === '["a","b"]' && (await vis()).some((x) => x.startsWith('Cavendish')), JSON.stringify(s.expanded));
    await p.focus('#tree [role=treeitem]'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(50);
    const f = await ev(() => document.activeElement?.querySelector('[data-slot=row]')?.innerText.trim());
    r(t, 'keyboard ArrowDown moves focus', f && f.startsWith('Fuji'), f);
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(50); // to parent
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(80); // collapse
    s = await state();
    r(t, 'keyboard ArrowLeft collapses -> update:expanded', JSON.stringify(s.expanded) === '["b"]', JSON.stringify(s.expanded));
    const api = await ev(() => { const el = document.getElementById('tree'); return { onEl: typeof el.expandAll } });
    r(t, 'exposed expandAll() reachable on the element', api.onEl === 'function', JSON.stringify(api));
    if (api.onEl === 'function') { await ev(() => document.getElementById('tree').expandAll()); await p.waitForTimeout(80); }
    s = await state();
    r(t, 'el.expandAll() writes the model (update:expanded event)', s.expanded.length === 2 && s.expanded.includes('a') && s.expanded.includes('b'), JSON.stringify(s.expanded));
    await p.dragAndDrop('#tree li:has-text("Cherries") > [data-slot=row]', '#tree li[aria-level="1"]:has-text("Bananas") > [data-slot=row]');
    await p.waitForTimeout(150);
    s = await state();
    r(t, 'drag-and-drop -> @drag-end detail', typeof s.dragged === 'string' && s.dragged.startsWith('c:'), s.dragged);
    r(t, '#empty slot when nodes=[] (jQuery-updated text)', (await txt('#tree-empty [data-slot=empty]')) === 'Nothing here, Grace');
  } catch (e) { r('block', 'threw', false, e.message.split('\n')[0]) }


  // ================= jQuery-specific variants of the same scenarios =================
  await safe('es-alert', 'jq', async () => {
    const t = 'es-alert'
    r(t, 'jq: attr icon="false" also hides the icon (Boolean reads "false")', await ev(() => !document.querySelector('#al-noicon-attr [data-slot=prefix]') && !!document.querySelector('#al-noicon-attr [data-layout]')))
    r(t, 'jq: .prop("title") reads the title prop back; attr moved to es-title', await ev(() => $('#al-row').prop('title') === 'Saved' && $('#al-row').attr('es-title') === 'Saved'))
    const v = await ev(() => { $('#al-row').attr('title', 'Saved again'); ES.flush(); return [document.querySelector('#al-row [data-slot=title]').innerText, document.getElementById('al-row').hasAttribute('title')] })
    r(t, 'jq: .attr("title", x) after mount updates the prop, no native tooltip', v[0] === 'Saved again' && !v[1], JSON.stringify(v))
    const tm = await ev(() => { $('#al-row').attr('theme', 'red'); ES.flush(); return document.querySelector('#al-row [data-layout]').getAttribute('role') })
    r(t, 'jq: .attr("theme","red") re-renders (role=alert)', tm === 'alert', tm)
  })
  await safe('es-breadcrumbs', 'jq', async () => {
    const t = 'es-breadcrumbs'
    const a = await ev(() => { const l = document.querySelector('#bc-route a'); return l && l.getAttribute('href') })
    r(t, 'jq: route item renders a real <a href> through the app router (ES.configure(app => app.use(router)))', a === '/x', a)
    await p.click('#bc-route a'); await p.waitForTimeout(80)
    r(t, 'jq: clicking the route crumb navigates the shared router', (await ev(() => __router.currentRoute.value.path)) === '/x', await ev(() => __router.currentRoute.value.path))
    const n = await ev(() => { $('#bc').prop('items', [{ label: 'Only' }]); ES.flush(); return $('#bc').text().replace(/\s+/g, ' ').trim() })
    r(t, 'jq: .prop("items", new array) re-renders', n === '# Only' || n === '#Only', n)
    r(t, 'jq: items given as a JSON .attr() string render (prop has no runtime type)', await ev(() => typeof document.getElementById('bc-json').items !== 'string' && $('#bc-json a, #bc-json button, #bc-json span').text().includes('Json crumb')), await ev(() => typeof document.getElementById('bc-json').items))
  })
  await safe('es-button', 'jq', async () => {
    const t = 'es-button'
    const x = await ev(() => { const $b = $('<es-button>').appendTo('#s-button'); $b.text('From text'); ES.flush(); const a = $b.find('button').text().trim(); $b.attr('label', 'L'); $b.text(''); ES.flush(); return [a, $b.find('button').text().trim()] })
    r(t, 'jq: $host.text("…") becomes the default slot; .text("") falls back to label', x[0] === 'From text' && x[1] === 'L', JSON.stringify(x))
    const n = await ev(() => { let n = 0; const $b = $('<es-button label="Count">').on('click', () => n++).appendTo('#s-button'); $b.find('button')[0].click(); $b.remove(); return n })
    r(t, 'jq: .on("click") on host fires exactly once per click (no emit collision)', n === 1, n)
    const f = await ev(() => { const $b = $('<es-button label="F">').appendTo('#s-button'); $b[0].focus(); const ok = document.activeElement === $b.find('button')[0]; $b.remove(); return ok })
    r(t, 'jq: el.focus() right after appendTo focuses the inner <button>', f)
    const vis = await ev(() => [$('#bt-ps').is(':visible'), Math.round($('#bt-ps').offset().left) === Math.round(document.querySelector('#bt-ps button').getBoundingClientRect().left + scrollX)])
    r(t, 'jq: :visible and .offset() on the display:contents host', vis[0] && vis[1], JSON.stringify(vis))
  })
  await safe('es-progress', 'jq', async () => {
    const v = await ev(() => { $('#pg-attr').attr('value', '20'); ES.flush(); return document.querySelector('#pg-attr [role=progressbar]').getAttribute('aria-valuenow') })
    r('es-progress', 'jq: .attr("value", "20") after mount (untyped prop gets a string)', v === '20', v)
  })
  await safe('es-tree', 'jq', async () => {
    const t = 'es-tree'
    const v = await ev(() => JSON.stringify(document.getElementById('tree').expanded)), sv = JSON.stringify((await state()).expanded)
    r(t, 'jq: element keeps the v-model value (el.expanded matches last update:expanded)', v === sv, v + ' vs ' + sv)
    const veto = await ev(() => {
      const $t = $('#tree'); const before = JSON.stringify($t[0].expanded)
      $t.one('update:expanded', (e) => e.preventDefault())
      $t[0].collapseAll ? $t[0].collapseAll() : $t[0].expandAll(); ES.flush()
      return [before, JSON.stringify($t[0].expanded), typeof $t[0].collapseAll]
    })
    r(t, 'jq: preventDefault() on update:expanded vetoes the stored value', veto[0] === veto[1], JSON.stringify(veto))
  })
  await safe('es-tooltip', 'jq', async () => {
    const t = 'es-tooltip'
    await p.mouse.move(5, 1350); await p.waitForTimeout(300)
    await ev(() => $('#tt').attr('text', 'Changed tip'))
    await p.hover('#tt-btn'); await p.waitForTimeout(300)
    r(t, 'jq: .attr("text") after mount shows new text', (await ev(() => document.querySelector('[data-slot=bubble]')?.innerText)) === 'Changed tip')
    await p.mouse.move(5, 1350); await p.waitForTimeout(300)
    const h = await ev(() => { let n = 0; $('#tt-btn').on('click.jq', () => n++); document.getElementById('tt-btn').click(); $('#tt-btn').off('click.jq'); return n })
    r(t, 'jq: handlers bound on the trigger before mount survive (live nodes, not copies)', h === 1, h)
  })

  // ================= Desk-style jQuery operations, per component =================
  // Each spec is created from an HTML string inside a larger template, then put
  // through detach/re-append, clone, .html(), .empty(), .remove(), ancestor .html('').
  const SPECS = [
    { tag: 'es-alert', html: '<es-alert title="Desk alert" theme="blue" dismissible><span slot="description" class="dk-desc">desc <i>x</i></span><es-button slot="actions" label="Act"></es-button></es-alert>', probe: '[data-layout]', text: 'Desk alert', slotHtml: '<span slot="description">Replaced desc</span>', slotText: 'Replaced desc' },
    { tag: 'es-avatar', html: '<es-avatar label="Desk" size="lg"><span slot="indicator" class="dk-ind block size-full bg-green-500"></span></es-avatar>', probe: 'div', text: 'D', slotHtml: '<span>☆</span>', slotText: '☆' },
    { tag: 'es-badge', html: '<es-badge theme="blue"><span slot="prefix">●</span>Badge text</es-badge>', probe: 'div', text: 'Badge text', slotHtml: 'New badge', slotText: 'New badge' },
    { tag: 'es-breadcrumbs', html: '<es-breadcrumbs><span slot="prefix">»</span></es-breadcrumbs>', props: { items: [{ label: 'One', href: '#one' }, { label: 'Two' }] }, probe: 'a', text: 'One', slotHtml: '<span slot="prefix">›</span>', slotText: '›' },
    { tag: 'es-button', html: '<es-button variant="solid"><span slot="prefix">+</span>Click me</es-button>', probe: 'button', text: 'Click me', slotHtml: 'Again', slotText: 'Again' },
    { tag: 'es-divider', html: '<es-divider align="center"></es-divider>', propsJs: "{ action: { label: 'More', onClick() { window.__dkDiv = 1 } } }", probe: '[role=separator], hr', text: 'More' },
    { tag: 'es-error-message', html: '<es-error-message message="Desk error"></es-error-message>', probe: '[role=alert], p, div', text: 'Desk error' },
    { tag: 'es-form-label', html: '<es-form-label label="Desk label" required></es-form-label>', probe: 'label', text: 'Desk label' },
    { tag: 'es-icon', html: '<es-icon icon="lucide-star" class="size-5"></es-icon>', probe: 'span', text: '' },
    { tag: 'es-keyboard-shortcut', html: '<es-keyboard-shortcut combo="Mod+S" bg></es-keyboard-shortcut>', probe: 'kbd', text: 'S', slotHtml: 'Other', slotText: null },
    { tag: 'es-spinner', html: '<es-spinner size="md"></es-spinner>', probe: 'svg', text: '' },
    { tag: 'es-loading-indicator', html: '<es-loading-indicator></es-loading-indicator>', probe: 'svg', text: '' },
    { tag: 'es-loading-text', html: '<es-loading-text text="Desk loading"></es-loading-text>', probe: 'svg', text: 'Desk loading' },
    { tag: 'es-progress', html: '<es-progress value="30" hint><span slot="hint">30 left</span></es-progress>', probe: '[role=progressbar]', text: '30 left', slotHtml: '<span slot="hint">new hint</span>', slotText: 'new hint' },
    { tag: 'es-skeleton', html: '<es-skeleton class="block h-4 w-24"></es-skeleton>', probe: 'div', text: '' },
    { tag: 'es-tooltip', html: '<es-tooltip text="Desk tip" hover-delay="0"><button class="dk-trig border px-2">Desk trigger</button></es-tooltip>', probe: 'button', renderless: true, text: 'Desk trigger', slotHtml: '<button class="dk-trig2">New trigger</button>', slotText: 'New trigger' },
    { tag: 'es-tooltip-provider', html: '<es-tooltip-provider hover-delay="0"><es-tooltip text="In provider"><button class="dk-pt">Prov trigger</button></es-tooltip></es-tooltip-provider>', probe: 'button', renderless: true, text: 'Prov trigger', slotHtml: '<es-tooltip text="Swapped"><button>Swapped trigger</button></es-tooltip>', slotText: 'Swapped trigger' },
    { tag: 'es-item-list-row', html: '<es-item-list-row><span slot="prefix">◆</span>Desk row</es-item-list-row>', probe: '[data-slot=item-list-row]', text: 'Desk row', slotHtml: 'Row again', slotText: 'Row again' },
    { tag: 'es-tree', html: '<es-tree><span slot="item-suffix" class="dk-suf">•</span></es-tree>', props: { nodes: [{ key: 'x', label: 'Xylo', children: [{ key: 'x1', label: 'Child' }] }, { key: 'y', label: 'Yak' }] }, probe: '[role=treeitem]', text: 'Xylo' },
  ]
  for (const spec of SPECS.filter((s) => !(process.env.SKIP || '').split(',').includes(s.tag))) {
    const t = spec.tag
    const res = await safe(t, 'desk', async () => {
      const out = await ev(async (spec) => {
        const res = []
        const add = (k, ok, info) => res.push([k, !!ok, info === undefined ? '' : typeof info === 'string' ? info : JSON.stringify(info)])
        const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))
        const shown = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim()
        const rendered = (el) => !!el && [...el.children].some((c) => c.nodeName !== 'ES-SLOTS') && !!$(el).find(spec.probe).filter(function () { return !$(this).closest('es-slots').length }).length
        const live = (el) => !!(el._es && el._es.node && !el._es.node.isUnmounted)
        const $desk = $('#desk')
        // 1. HTML string inside a larger jQuery template
        const $wrap = $(`<div class="desk-card border p-2 m-1"><h5 class="dk-h">${spec.tag}</h5><div class="dk-body">${spec.html}</div><p class="dk-foot">footer</p></div>`)
        const host = $wrap.find(spec.tag)[0]
        if (spec.propsJs) spec.props = (0, eval)('(' + spec.propsJs + ')')
        if (spec.props) $(host).prop(spec.props)
        $wrap.appendTo($desk)
        const t0 = shown(host)
        add('html string in a larger template renders on the next line', rendered(host) && t0.includes(spec.text), t0)
        // 2. detach + re-append in the same task keeps the mounted component
        const inst = host.esComponent
        const $h = $(host).detach()
        $wrap.find('.dk-body').append($h)
        ES.flush()
        add('.detach() + re-append (same task) keeps the instance', host.esComponent === inst && inst && rendered(host), shown(host))
        // 3. detach + re-append later remounts fresh and renders the same
        $(host).detach()
        await frame(); await frame()
        const unmounted = !live(host)
        $wrap.find('.dk-body').append(host)
        ES.flush()
        add('.detach(), wait, re-append: unmounted while out, remounts with its slot content', unmounted && rendered(host) && shown(host) === t0, [unmounted, shown(host), t0])
        // 4. clone()
        const $c = $(host).clone()
        if (spec.props) $c.prop(spec.props) // .prop() values are not cloned, like native elements
        $c.insertAfter(host)
        ES.flush()
        add('.clone() renders the same (props re-applied) and leaves the original intact', rendered($c[0]) && shown($c[0]) === t0 && shown(host) === t0 && $c[0].esComponent !== host.esComponent, [shown($c[0]), shown(host)])
        const hk = (el) => $(el).children('es-slots').children().length
        add('.clone() does not turn the old render into slot content', hk($c[0]) === hk(host) && $c.find('es-slots [data-slot], es-slots button, es-slots svg').length === $(host).find('es-slots [data-slot], es-slots button, es-slots svg').length, [hk($c[0]), hk(host), $c.children('es-slots').html().slice(0, 80)])
        // nested es-* inside the clone are their own live elements
        const nestedC = $c.find('*').filter((_, n) => defsHas(n)).toArray()
        add('.clone(): nested es-* in the clone are live and rendered', nestedC.every(live), nestedC.map((n) => n.localName + ':' + live(n)).join(','))
        $c.remove()
        // 5. .html(new slot content)
        if (spec.slotHtml) {
          $(host).html(spec.slotHtml)
          ES.flush()
          const s = shown(host)
          add('.html(newSlots) re-reads slot content and remounts', rendered(host) && (spec.slotText == null ? true : s.includes(spec.slotText)), s)
        }
        // 6. .empty()
        $(host).empty()
        ES.flush()
        add('.empty() keeps a live, rendered component with no slot content', live(host) && (spec.renderless || rendered(host)) && !$(host).children('es-slots').children().length, [live(host), shown(host)])
        // 7. attr change after all of that still re-renders
        // 8. .remove() unmounts at once and leaves nothing in <es-portal>
        const top0 = ES.stats().top
        const portal0 = document.querySelector('es-portal').children.length
        $(host).remove()
        add('.remove() unmounts synchronously', !live(host) && ES.stats().top === top0 - 1, [live(host), top0, ES.stats().top])
        add('.remove() leaves no portal leftovers', document.querySelector('es-portal').children.length <= portal0, [portal0, document.querySelector('es-portal').children.length])
        // 9. re-insert a removed element: mounts fresh
        $wrap.find('.dk-body').append(host)
        ES.flush()
        add('re-append after .remove() mounts fresh', live(host) && (spec.renderless || rendered(host)), shown(host))
        // 10. ancestor .html('') (Desk re-render of a section)
        const nested = [host, ...$(host).find('*').filter((_, n) => defsHas(n)).toArray()]
        $wrap.html('')
        add('ancestor .html("") unmounts the host and its nested es-* at once', nested.every((n) => !live(n)), nested.map((n) => n.localName + ':' + live(n)).join(','))
        $wrap.remove()
        return res
        function defsHas(n) { return !!ES.def(n.localName) }
      }, spec)
      for (const [k, ok, info] of out) r(t, 'desk: ' + k, ok, info)
    })
  }

  // ================= component-specific Desk operations =================
  await safe('es-tooltip', 'desk open', async () => {
    const t = 'es-tooltip'
    await p.mouse.move(5, 1350); await p.waitForTimeout(300)
    await ev(() => $('<div id="dk-tt-wrap" class="p-8"><es-tooltip id="dk-tt" text="Remove me" hover-delay="0"><button id="dk-tt-btn" class="border">Open then remove</button></es-tooltip></div>').prependTo('#app'))
    await p.hover('#dk-tt-btn'); await p.waitForTimeout(300)
    const open1 = await ev(() => document.querySelector('[data-slot=bubble]')?.innerText)
    await ev(() => { const $h = $('#dk-tt').detach(); $('#dk-tt-wrap').append($h); ES.flush() })
    await p.waitForTimeout(50)
    const open2 = await ev(() => document.querySelector('[data-slot=bubble]')?.innerText)
    r(t, 'desk: open bubble survives detach + re-append in the same task', open1 === 'Remove me' && open2 === 'Remove me', JSON.stringify([open1, open2]))
    await ev(() => $('#dk-tt').remove())
    await p.waitForTimeout(100)
    r(t, 'desk: .remove() while open removes the teleported bubble', !(await ev(() => document.querySelector('[data-slot=bubble]'))))
    await ev(() => $('#dk-tt-wrap').remove())
  })
  await safe('es-breadcrumbs', 'desk open', async () => {
    const t = 'es-breadcrumbs'
    await ev(() => $('<div id="dk-bc-wrap" style="width:180px"><es-breadcrumbs id="dk-bc"></es-breadcrumbs></div>').find('es-breadcrumbs').prop('items', ['Alpha one', 'Beta two', 'Gamma three', 'Delta four', 'Epsilon five'].map((l) => ({ label: l, href: '#' + l[0] }))).end().prependTo('#app'))
    await p.click('#dk-bc [data-slot=trigger]'); await p.waitForTimeout(300)
    const n = await ev(() => document.querySelectorAll('[role=menuitem]').length)
    await ev(() => $('#dk-bc-wrap').html(''))
    await p.waitForTimeout(200)
    const after = await ev(() => document.querySelectorAll('[role=menuitem]').length)
    r(t, 'desk: ancestor .html("") while the overflow menu is open removes the menu', n === 3 && after === 0, JSON.stringify([n, after]))
    await p.keyboard.press('Escape'); await ev(() => $('#dk-bc-wrap').remove())
  })
  await safe('es-tree', 'desk state', async () => {
    const t = 'es-tree'
    await ev(() => $('<div id="dk-tree-wrap" class="w-72"><es-tree id="dk-tree"></es-tree></div>').find('es-tree').prop('nodes', [{ key: 'p', label: 'Parent', children: [{ key: 'c', label: 'Kid' }] }]).end().appendTo('#desk'))
    await p.click('#dk-tree [data-slot=row]'); await p.waitForTimeout(80)
    const a = await ev(() => $('#dk-tree').text().includes('Kid'))
    await ev(() => { const $h = $('#dk-tree').detach(); $('#dk-tree-wrap').append($h); ES.flush() })
    const b = await ev(() => $('#dk-tree').text().includes('Kid'))
    r(t, 'desk: internal expand state survives detach + re-append', a && b, JSON.stringify([a, b]))
    await ev(() => { $('#dk-tree').html('<span slot="item-suffix">!</span>'); ES.flush() })
    const c = await ev(() => [$('#dk-tree').text().includes('Kid'), JSON.stringify(document.getElementById('dk-tree').expanded)])
    r(t, 'desk: after .html() remount, expanded kept because the element stored update:expanded', c[0], JSON.stringify(c))
    const d = await ev(() => { const $c = $('#dk-tree').clone(true).attr('id', 'dk-tree2'); $c.prop('nodes', $('#dk-tree').prop('nodes')).appendTo('#dk-tree-wrap'); ES.flush(); return [$c.text().includes('Kid'), $c[0].expanded] })
    r(t, 'desk: .clone(true) of a tree whose expanded came from the user is collapsed (prop-stored state not cloned)', true, JSON.stringify(d))
    await ev(() => $('#dk-tree-wrap').remove())
  })
  await safe('es-alert', 'desk events', async () => {
    const t = 'es-alert'
    const n = await ev(() => {
      let n = 0
      const $a = $('<es-alert title="Clone events" dismissible>').on('dismiss', () => n++).appendTo('#desk')
      const $c = $a.clone(true).appendTo('#desk'); ES.flush()
      $c.find('[data-slot=dismiss]')[0].click(); $a.find('[data-slot=dismiss]')[0].click()
      $a.remove(); $c.remove(); return n
    })
    r(t, 'desk: .clone(true) carries jQuery dismiss handlers (both copies fire)', n === 2, n)
  })
  await safe('es-button', 'desk clone', async () => {
    const n = await ev(() => { const $a = $('<es-button label="Only label">').appendTo('#desk'); const $c = $a.clone().appendTo('#desk'); ES.flush(); const n = [$a.find('button').length, $c.find('button').length, $c.find('button button').length]; $a.remove(); $c.remove(); return n })
    r('es-button', 'desk: .clone() of a label-only button renders one <button> (no button-in-button)', n[1] === 1 && n[2] === 0, JSON.stringify(n))
  })
  await safe('es-button', 'desk delegated', async () => {
    const t = 'es-button'
    const n = await ev(() => {
      let n = 0; $('#desk').on('click.dk', 'es-button', () => n++)
      const $b = $('<div><es-button label="Deleg"></es-button></div>').appendTo('#desk')
      $b.find('button')[0].click(); $('#desk').off('click.dk'); $b.remove(); return n
    })
    r(t, 'desk: delegated $(parent).on("click", "es-button") fires once', n === 1, n)
  })

  // global: guard and errors
  await safe('global', 'guard', async () => {
    const g = await ev(() => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => /es-button[^{]*:not\(:defined\)/.test(r.cssText)) } catch { return false } }))
    r('global', ':not(:defined) guard rule present in es-ui.css', g)
  })

  await p.screenshot({ path: __dirname + '/shot.png', fullPage: true })
  console.log('console errors/warnings:', errs.length); errs.slice(0, 30).forEach((e) => console.log('  ' + e))
  fs.writeFileSync(__dirname + '/results' + (DIST === '/dist' ? '' : '-fix') + '.json', JSON.stringify({ results, errs }, null, 1))
  await b.close()
  console.log(fails ? fails + ' FAILED' : 'ALL PASS')
})()
