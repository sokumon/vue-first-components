require('./lib.cjs').run('overlays.html', async ({ p, r, wait, txt, vis, rect, state, log, inside }) => {
  // ---------- Dialog
  r('dialog closed: no [role=dialog], slot nodes hidden', !(await p.$('[role=dialog]')) && !(await vis('#d-body')));
  await p.click('#open-d'); await wait(300);
  const dlg = '[role=dialog]';
  r('dialog opens from petite state', await vis(dlg));
  r('slot="title" rendered inside dialog header, bound', await inside('#d-title', dlg + ' header') && (await txt('#d-title')) === 'Custom title for Ada', await txt('#d-title'));
  r('default slot replaces message prop, inside dialog', await inside('#d-body', dlg) && !(await p.textContent(dlg)).includes('ignored when'), await txt(dlg));
  r('icon prop renders lucide badge', !!(await p.$(dlg + ' [data-slot=icon] .lucide-info')));
  const btns = await p.$$eval(dlg + ' [data-slot=actions] button', bs => bs.map(b => b.innerText.trim()));
  r('actions prop (array of objects) renders buttons', btns.join('|') === 'Cancel|Save', btns.join('|'));
  await p.fill('#d-input', 'Grace'); await wait();
  r('input inside teleported slot drives host state + interpolation', (await state()).startsWith('Grace|') && (await txt('#d-title')).includes('Grace'), await state());
  await p.click(dlg + ' [data-slot=actions] button:has-text("Save")'); await wait(400);
  r('action onClick(fn from petite scope) gets {close}: saved+1 and closes, update:open + close + after-leave fire', (await state()).includes('saved=1') && (await state()).includes('d=false') && !(await vis(dlg)) && (await log()).includes('d-close') && (await log()).includes('d-after'), (await state()) + ' log=' + (await log()));
  // reopen, Escape closes, close button closes
  await p.click('#open-d'); await wait(300);
  await p.keyboard.press('Escape'); await wait(300);
  r('dialog Escape closes -> state', (await state()).includes('d=false') && !(await vis(dlg)), await state());
  await p.click('#open-d'); await wait(300);
  r('close button present by default', !!(await p.$(dlg + ' button[aria-label=Close]')));
  await p.click(dlg + ' button[aria-label=Close]').catch(e => console.log('  closebtn', e.message.slice(0, 80))); await wait(300);
  r('dialog close button closes', (await state()).includes('d=false'), await state());
  await p.click('#open-d'); await wait(300);
  await p.mouse.click(5, 5); await wait(300);
  r('dialog outside click closes', (await state()).includes('d=false'), await state());
  r('dialog slot nodes returned to hidden holder after close', !(await vis('#d-body')) && (await p.$eval('#d-body', e => !!e.closest('es-slots')).catch(() => false)));

  // v-model (modelValue), message prop, slot=actions, not dismissible, no close button
  await p.click('#open-dm'); await wait(300);
  r('modelValue dialog opens', await vis(dlg));
  r('message prop renders', (await txt(dlg)).includes('Message prop text'), await txt(dlg));
  r('slot="actions" replaces footer', await inside('#dm-ok', dlg + ' [data-slot=actions]'));
  r('show-close-button=false hides close button', !(await p.$(dlg + ' button[aria-label=Close]')));
  await p.keyboard.press('Escape'); await wait(300);
  r('dismissible=false: Escape does not close', (await state()).includes('dm=true') && await vis(dlg), await state());
  await p.mouse.click(5, 5); await wait(300);
  r('dismissible=false: outside click does not close', (await state()).includes('dm=true'), await state());
  await p.click('#dm-ok button'); await wait(300);
  r('button in actions slot closes via host state (update:model-value path)', (await state()).includes('dm=false') && !(await vis(dlg)) && (await log()).includes('dm-ok'), await state());

  // bare
  await p.click('#open-d3'); await wait(300);
  r('bare dialog: slot rendered without header/actions chrome', await inside('#d3-body', dlg) && !(await p.$(dlg + ' header')) && (await txt('#d3-body')).includes('Grace'));
  await p.click('#d3-x'); await wait(300);
  r('bare dialog closes from slot button', !(await vis(dlg)));

  // ---------- BottomSheet
  await p.click('#open-sheet'); await wait(400);
  r('bottom sheet opens with title', await vis(dlg) && (await txt(dlg)).includes('Sheet title'), await txt(dlg).catch(() => ''));
  r('sheet slot (v-for inside slot) bound inside sheet', await inside('#sheet-body', dlg) && (await txt('#sheet-body')).replace(/\n/g, ',') === 'Row 1 for Grace,Row 2 for Grace,Row 3 for Grace', await txt('#sheet-body'));
  const sr = await rect(dlg);
  r('sheet sits at the bottom of the viewport', sr && sr.y + sr.h >= 880, JSON.stringify(sr));
  await p.keyboard.press('Escape'); await wait(400);
  r('sheet Escape -> update:open false + after-leave', (await state()).includes('sheet=false') && !(await vis(dlg)) && (await log()).includes('sheet-after'), await state() + ' ' + await log());
  await p.click('#open-sheet'); await wait(400);
  await p.click('#sheet-close'); await wait(400);
  r('sheet closes from slot button', (await state()).includes('sheet=false') && !(await vis(dlg)));
  await p.click('#open-sheet'); await wait(500);
  const hb = await rect(dlg + ' .cursor-grab');
  if (hb) { await p.mouse.move(hb.x + hb.w / 2, hb.y + 10); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(hb.x + hb.w / 2, hb.y + 10 + i * 30); await wait(16) } await p.mouse.up(); }
  await wait(500);
  r('sheet swipe-down on the grab handle dismisses (useSheetDrag bound inside the CE)', !!hb && (await state()).includes('sheet=false'), JSON.stringify(hb) + ' ' + await state());
  if ((await state()).includes('sheet=true')) { await p.keyboard.press('Escape'); await wait(400) }
  await p.click('#open-sheet2'); await wait(400);
  await p.keyboard.press('Escape'); await wait(300);
  r('sheet dismissible=false ignores Escape', await vis(dlg) && await vis('#sheet2-body'));
  await p.click('#sheet2-close'); await wait(400);
  r('sheet2 closes', !(await vis(dlg)));

  // ---------- Popover
  const trig = await rect('#pop-trigger button');
  r('popover trigger es-button renders (slot=trigger)', !!trig && trig.w > 20, JSON.stringify(trig));
  await p.click('#pop-trigger button'); await wait(300);
  r('popover opens on trigger click: update:open + open event', await vis('#pop-body') && (await state()).includes('pop=true') && (await log()).includes('pop-open'), await state() + ' ' + await log());
  const pr = await rect('[data-slot=content]:has(#pop-body)');
  r('popover content positioned under its trigger', pr && trig && Math.abs(pr.x - trig.x) < 20 && pr.y >= trig.y + trig.h - 2 && pr.y < trig.y + trig.h + 30, 'trigger ' + JSON.stringify(trig) + ' content ' + JSON.stringify(pr));
  r('popover arrow rendered', !!(await p.$('[data-slot=arrow]')));
  r('trigger aria-expanded reflects open (on a real element)', await p.evaluate(() => { const e = document.querySelector('[aria-expanded="true"]'); return e ? e.tagName + ' ' + getComputedStyle(e).display : 'none' }).then(v => (console.log('   aria-expanded on:', v), v !== 'none')));
  await p.click('#pop-rename'); await wait();
  r('button in popover slot updates host state', (await txt('#pop-body')).includes('Linus') && (await state()).startsWith('Linus|'));
  await p.keyboard.press('Escape'); await wait(300);
  r('popover Escape closes + close event', !(await vis('#pop-body')) && (await state()).includes('pop=false') && (await log()).includes('pop-close'), await state() + ' ' + await log());
  // keyboard open: focus trigger, Enter
  await p.focus('#pop-trigger button'); await p.keyboard.press('Enter'); await wait(300);
  r('popover opens from keyboard (Enter on trigger)', await vis('#pop-body'));
  await p.keyboard.press('Escape'); await wait(300);
  r('focus returns to the trigger button after Escape', await p.evaluate(() => document.activeElement?.closest('#pop-trigger') != null), await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  // exposed methods
  r('exposed close() reachable on element', await p.evaluate(() => typeof document.getElementById('pop').close === 'function'), await p.evaluate(() => Object.keys(document.getElementById('pop')._instance?.exposed || {}).join(',')));

  // controlled popover2
  await p.click('#pop2-trigger'); await wait(300);
  r('controlled bare popover opens through host state', await vis('#pop2-body'));
  r('bare popover: no PopoverPanel shell', !(await p.$('[data-slot=content]:has(#pop2-body) [data-slot=panel]')));
  await p.mouse.click(5, 880); await wait(300);
  r('dismissible=false popover ignores outside click', await vis('#pop2-body'));
  await p.click('#pop2-close'); await wait(300);
  r('controlled popover closes when host state set false', !(await vis('#pop2-body')));

  // ---------- HoverCard
  const ht = await rect('#hc-trigger');
  await p.hover('#hc-trigger'); await wait(500);
  r('hover card opens on hover (deferred trigger through es-slot)', await vis('#hc-body') && (await state()).includes('hc=true'), await state());
  const hr = await rect('[data-slot=content]:has(#hc-body)');
  r('hover card positioned under trigger', hr && ht && Math.abs(hr.x - ht.x) < 30 && hr.y >= ht.y + ht.h - 2 && hr.y < ht.y + ht.h + 40, JSON.stringify({ ht, hr }));
  await p.hover('#far'); await wait(600);
  r('hover card closes on leave', !(await vis('#hc-body')) && (await state()).includes('hc=false'), await state());
  await p.focus('#hc-trigger'); await wait(400);
  r('hover card opens on keyboard focus', await vis('#hc-body'), await state());
  await p.evaluate(() => document.activeElement.blur()); await wait(500);
  r('hover card closes on blur', !(await vis('#hc-body')), await state());
});
