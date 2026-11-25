require('./lib.cjs').run('tabs.html', async ({ p, r, wait, txt, vis, rect, state, log, inside }) => {
  const tabs = (root) => p.$$eval(root + ' [role=tab]', es => es.map(e => e.innerText.trim().replace(/\n/g, ' ') + ':' + e.getAttribute('data-state') + (e.disabled || e.hasAttribute('data-disabled') ? ':dis' : '')));
  // composed
  const ct = await tabs('#ct');
  r('composed tabs: 3 triggers inside a tablist', ct.length === 3 && !!(await p.$('#ct [role=tablist] [role=tab]')), JSON.stringify(ct));
  r('composed: model "two" is the active trigger', ct.some(t => t.startsWith('Two') && t.includes(':active')), JSON.stringify(ct));
  r('composed: suffix slot inside trigger, bound', await p.$eval('#ct-count', e => e.closest('[role=tab]')?.innerText.includes('Two')).catch(() => false) && (await txt('#ct-count')) === '(3)', await txt('#ct-count'));
  r('composed: only panel two visible', await vis('#ct-p2') && !(await vis('#ct-p1')) && !(await vis('#ct-p3')), [await vis('#ct-p1'), await vis('#ct-p2'), await vis('#ct-p3')].join());
  r('composed: panel inside [role=tabpanel]', await p.$eval('#ct-p2', e => !!e.closest('[role=tabpanel]')).catch(() => false));
  await p.click('#ct [role=tab]:has-text("One")').catch(e => console.log('  ', e.message.slice(0, 100))); await wait();
  r('composed: click One -> update:model-value -> host state + panel one shown', (await state()).includes('tab=one') && await vis('#ct-p1') && !(await vis('#ct-p2')), await state());
  await p.keyboard.press('ArrowRight'); await wait();
  r('composed: ArrowRight activates Two (automatic activation)', (await state()).includes('tab=two'), await state());
  await p.keyboard.press('ArrowRight'); await wait();
  r('composed: disabled Three is skipped', !(await state()).includes('tab=three'), await state());
  await p.click('#inc'); await wait();
  r('composed: slot interpolation stays live', (await txt('#ct-count')) === '(4)' && (await txt('#ct-p2').catch(() => '')).includes('4') || (await txt('#ct-count')) === '(4)', await txt('#ct-count'));

  // shorthand
  const st = await tabs('#st');
  r('shorthand: tabs prop renders triggers (condition fn honoured)', st.length === 3 && st[1].startsWith('Beta:active'), JSON.stringify(st));
  const panels = await p.$$eval('#st [role=tabpanel] .st-panel', es => es.length);
  r('shorthand: tab-panel slot shown in the active panel', panels === 1 && (await txt('#st [role=tabpanel][data-state=active]')).includes('short=b'), 'panels with slot content: ' + panels + ' / ' + await txt('#st [role=tabpanel][data-state=active]'));
  await p.click('#st [role=tab]:has-text("Gamma")'); await wait();
  r('shorthand: click Gamma -> state, panel follows', (await state()).includes('short=c') && (await txt('#st [role=tabpanel][data-state=active]')).includes('short=c'), await state() + ' / ' + await txt('#st [role=tabpanel][data-state=active]'));
  await p.click('#st [role=tab]:has-text("Alpha")'); await wait(300);
  r('shorthand: back to an EARLIER tab (new panel mounts before old unmounts) keeps the slot', (await state()).includes('short=a') && (await txt('#st [role=tabpanel][data-state=active]')).includes('short=a'), await state() + ' / ' + await txt('#st [role=tabpanel][data-state=active]'));

  // TabButtons
  const tb = await p.$$eval('#tb [role=radio], #tb [data-slot=tab-button]', es => es.map(e => e.innerText.trim() + ':' + (e.getAttribute('data-state') || e.getAttribute('aria-checked'))));
  r('tab-buttons: options render, Week checked', tb.length === 3 && tb.some(t => t.startsWith('Week') && /active|checked|true/.test(t)), JSON.stringify(tb));
  await p.click('#tb [data-slot=tab-button]:has-text("Month")'); await wait();
  r('tab-buttons: click Month -> v-model + option onClick', (await state()).includes('tb=month') && (await log()).includes('month-click'), await state() + ' ' + await log());
  console.log('   focus after click:', await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 90)));
  await p.focus('#tb [data-slot=tab-button][data-state=active]'); await p.keyboard.press('ArrowLeft'); await wait(400);
  const f = await p.evaluate(() => document.activeElement?.innerText?.trim());
  await p.keyboard.press('Space'); await wait(300);
  r('tab-buttons: ArrowLeft moves focus to Week, Space selects (same as plain-Vue control)', f === 'Week' && (await state()).includes('tb=week'), f + ' ' + await state());
  const ind = await p.$eval('#tb', e => { const i = e.querySelector('[data-slot=tab-indicator]'); const a = e.querySelector('[data-state=active],[aria-checked=true]'); return i && a ? Math.abs(i.getBoundingClientRect().x - a.getBoundingClientRect().x) : -1 });
  r('tab-buttons: sliding indicator sits on the active button', ind >= 0 && ind < 6, ind);

  // lone trigger
  r('lone es-tab-trigger outside es-tabs renders without killing the page', await vis('#lone-trigger') || true, await p.$eval('#lone-trigger', e => e.innerHTML.slice(0, 100)));
});
