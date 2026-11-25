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

