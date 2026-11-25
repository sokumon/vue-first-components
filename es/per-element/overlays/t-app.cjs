require('./lib.cjs').run('app.html', async ({ p, r, wait, txt, vis, rect, state, log, inside }) => {
  r('provider renders its slot (app bound inside)', await vis('#btn-toast') && await inside('#app', '#prov') && (await state()) === 'k=false|n=0', await state());
  r('provider app slot is not hidden in es-slots', await p.$eval('#app', e => !e.closest('es-slots')));
  // toasts
  await p.click('#btn-toast'); await wait(500);
  const toasts = await p.$$eval('[data-sonner-toast]', es => es.map(e => e.innerText.trim().replace(/\n/g, ' / ')));
  r('toast.success shows a toast with title + description', toasts.length >= 1 && toasts[0].includes('Saved #1') && toasts[0].includes('desc 1'), JSON.stringify(toasts));
  r('toast rendered once (provider includes one Toaster)', toasts.length === 1, toasts.length + ' toasts, ' + (await p.$$eval('[data-sonner-toaster]', e => e.length)) + ' toasters');
  r('toast has <b> from sanitised HTML', await p.$eval('[data-sonner-toast] b', b => b.innerText).catch(() => '') === '#1');
  const tr = await rect('[data-sonner-toast]');
  r('toast sits bottom-right', tr && tr.x > 600 && tr.y > 600, JSON.stringify(tr));
  await p.click('#btn-toast-act'); await wait(500);
  await p.click('[data-sonner-toast] button:has-text("Undo")').catch(e => console.log('  undo', e.message.slice(0, 90))); await wait(300);
  r('toast action onClick fires', (await log()).includes('undo'), await log());
  // imperative confirm through Dialogs host inside provider
  await p.click('#btn-confirm'); await wait(400);
  const dlgs = await p.$$('[role=dialog], [role=alertdialog]');
  r('dialog.confirm() renders via a <Dialogs> host (exactly once)', dlgs.length === 1 && (await dlgs[0].innerText()).includes('Really?'), dlgs.length);
  await p.click('[role=dialog] button:has-text("Confirm"), [role=alertdialog] button:has-text("Confirm")').catch(e => console.log('  confirm', e.message.slice(0, 90))); await wait(400);
  r('confirm onConfirm fires and dialog closes', (await log()).includes('confirmed') && !(await p.$('[role=dialog]')), await log());
  // keyboard shortcuts registered from page
  await p.keyboard.press('Control+s'); await wait();
  r('useKeyboardShortcut registration (via host bridge) handles Mod+S', await p.evaluate(() => window.__saved === 1), await p.evaluate(() => window.__saved));
  await p.click('#btn-k'); await wait(400);
  const kd = '[role=dialog]';
  r('keyboard shortcuts dialog opens with title prop', await vis(kd) && (await txt(kd)).includes('Shortcuts here'), await txt(kd).catch(() => ''));
  const kt = await txt(kd).catch(() => '');
  r('dialog lists the registered groups/shortcuts', kt.includes('File') && kt.includes('Save doc') && kt.includes('Nav'), kt.replace(/\n/g, ' | ').slice(0, 200));
  r('search shown above threshold', !!(await p.$(kd + ' input')));
  await p.fill(kd + ' input', 'open').catch(() => {}); await wait();
  const kt2 = await txt(kd).catch(() => '');
  r('search filters to "Open doc"', kt2.includes('Open doc') && !kt2.includes('Save doc'), kt2.replace(/\n/g, ' | ').slice(0, 200));
  await p.keyboard.press('Escape'); await wait(400);
  r('kbd dialog Escape -> update:open false', (await state()).includes('k=false') && !(await vis(kd)), await state());
  // scroll area
  const sa = await rect('#sa'), vp = await rect('#sa [data-slot=scroll-area-viewport]');
  r('scroll area: host class h-40 constrains the viewport', vp && vp.h <= 165 && vp.h > 100, JSON.stringify({ sa, vp }));
  r('scroll area: slot rows inside viewport', await inside('#sa-content', '#sa [data-slot=scroll-area-viewport]') && (await p.$$eval('.sa-row', e => e.length)) === 40);
  await p.hover('#sa'); await p.mouse.wheel(0, 300); await wait(300);
  const st = await p.$eval('#sa [data-slot=scroll-area-viewport]', e => e.scrollTop).catch(() => -1);
  r('scroll area scrolls on wheel', st > 50, st);
  const vp2 = await rect('#sa2 [data-slot=scroll-area-viewport]');
  await p.hover('#sa2'); await p.mouse.wheel(0, 300); await wait(400);
  const st2 = await p.$eval('#sa2 [data-slot=scroll-area-viewport]', e => e.scrollTop).catch(() => -1);
  r('host convention (CSS: host > [data-slot=scroll-area] {height:100%}): viewport constrained, scrolls, scrollbar shows', vp2 && vp2.h <= 165 && st2 > 50 && !!(await p.$('#sa2 [data-orientation=vertical]')), JSON.stringify({ vp2, st2 }));
  r('scroll area: custom vertical scrollbar shown', !!(await p.$('#sa [data-orientation=vertical]')));
  r('viewport-class prop applied', !!(await p.$('.sa-vp')));
  r('exposed viewportElement readable on element', await p.evaluate(() => document.getElementById('sa').viewportElement?.tagName || null).then(v => (console.log('   viewportElement', v), !!v)));
});
