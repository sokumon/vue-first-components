require('./lib.cjs').run('p-nested.html', async ({ p, r, info, wait, txt, errs }) => {
  const tabs = await p.evaluate(() => ({ triggers: document.querySelectorAll('#ct [role=tab]').length, panels: document.querySelectorAll('#ct [role=tabpanel]').length, text: document.querySelector('#ct').innerText.trim() }));
  r('[claim es-tabs composed broken] no triggers/panels + inject errors', tabs.triggers === 0 && errs.some(e => /TabsRootContext/.test(e)), { tabs, n: errs.filter(e => /TabsRootContext/.test(e)).length });
  // W: named non-scoped slot
  r('[claim works] named slot slot="prefix" renders inside the button', await p.evaluate(() => !!document.querySelector('#pfx button #pfx-icon')));
  // dialog containing select
  await p.click('#open button'); await wait(400);
  const d = await p.evaluate(() => { const dl = document.querySelector('[role=dialog]'); return { dialog: !!dl, sel: !!dl?.querySelector('#insel button'), ti: !!dl?.querySelector('#inti input') } });
  r('es-dialog body-content slot holds es-select + es-text-input', d.dialog && d.sel && d.ti, d);
  await p.click('[role=dialog] #insel button'); await wait(300);
  const opts = await p.$$eval('[role=option]', o => o.map(x => x.innerText.trim()));
  info('options inside dialog', opts);
  await p.click('[role=option]:has-text("Blue")').catch(e => info('opt click', e.message.slice(0, 80))); await wait(200);
  r('select inside dialog: v-model reaches page; dialog still open: ' + await txt('#state'), (await txt('#state')) === 'two|true|blue|');
  await p.fill('[role=dialog] #inti input', 'hello'); await wait(100);
  r('text-input inside dialog v-model: ' + await txt('#state'), (await txt('#state')).endsWith('|hello'));
  // Escape closes the select's listbox first, then dialog
  await p.keyboard.press('Escape'); await wait(300);
  r('[claim works] Escape closes teleported dialog -> update:open', (await txt('#state')).split('|')[1] === 'false', await txt('#state'));
  // reopen: does nested state survive / remount?
  await p.click('#open button'); await wait(400);
  info('reopen: select shows', await p.$eval('[role=dialog] #insel', e => e.innerText.trim()).catch(e => 'ERR'));
  info('dup id count frappe-ui-v-0', await p.evaluate(() => document.querySelectorAll('[id="frappe-ui-v-0"]').length));
});
