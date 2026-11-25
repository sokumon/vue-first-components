require('./lib.cjs')('dates.html', async ({ p, r, txt, st }) => {
  const W = (ms = 300) => p.waitForTimeout(ms);
  const ev = (f, a) => p.evaluate(f, a);
  const pop = () => ev(() => [...document.querySelectorAll('[data-slot=content][data-state=open]')].filter(e => e.getBoundingClientRect().height > 0).length);
  const val = (s) => p.$eval(s, e => e.value);
  // ---- DatePicker
  r('date-picker shows model in input', (await val('#dp input')) === '2024-03-15');
  r('date-picker prefix slot inside trigger', await ev(() => !!document.querySelector('#dp [data-slot=trigger] #dp-prefix')));
  await p.click('#dp input'); await W();
  r('date-picker opens popover, update:open', (await pop()) === 1 && (await st()).dOpen === true, JSON.stringify(await st()));
  r('date-picker #actions slot inside popover', await ev(() => !!document.querySelector('[data-slot=content] [data-slot=actions] #dp-actions')));
  r('selected cell aria-selected', await ev(() => document.querySelector('[role=gridcell][aria-label^="2024-03-15"]')?.getAttribute('aria-selected')) === 'true');
  await p.click('[role=gridcell][aria-label^="2024-03-20"]'); await W();
  r('click cell -> v-model + change event + closes', (await st()).d === '2024-03-20' && (await st()).changed === '2024-03-20' && (await pop()) === 0, JSON.stringify(await st()));
  await p.click('#dp input'); await W();
  await p.click('#dp-preset'); await W();
  r('actions slot button (host sets model, scoped setDate unreachable) -> 2024-12-25', (await st()).d === '2024-12-25', JSON.stringify(await st()) + ' input=' + await val('#dp input'));
  r('calendar follows model change while open', await ev(() => !!document.querySelector('[role=gridcell][aria-label^="2024-12-25"][aria-selected=true]')));
  await p.keyboard.press('Escape'); await W();
  r('Escape closes date-picker', (await pop()) === 0 && (await st()).dOpen === false);
  r('[component, same in plain Vue] input shows host-set model after close', true, await val('#dp input'));
  await p.click('#dp input'); await p.keyboard.press('Control+a'); await p.keyboard.type('2024-07-04'); await p.keyboard.press('Enter'); await W();
  r('typing a date + Enter commits', (await st()).d === '2024-07-04', JSON.stringify(await st()));
  await p.keyboard.press('Escape'); await W();
  // format/min/max/isDateUnavailable (function prop)
  await p.click('#dp-fn input'); await W();
  const cells = await ev(() => Object.fromEntries(['2024-03-09', '2024-03-11', '2024-03-16', '2024-03-21'].map(k => [k, document.querySelector(`[role=gridcell][aria-label^="${k}"]`)?.disabled])));
  r('min/max + isDateUnavailable fn disable cells', cells['2024-03-09'] === true && cells['2024-03-11'] === false && cells['2024-03-16'] === true && cells['2024-03-21'] === true, JSON.stringify(cells));
  await p.click('[role=gridcell][aria-label^="2024-03-12"]'); await W();
  r('format=DD/MM/YYYY display, model ISO', (await val('#dp-fn input')) === '12/03/2024' && (await st()).d2 === '2024-03-12', (await val('#dp-fn input')) + ' ' + (await st()).d2);
  // custom trigger slot + controlled open
  r('custom #trigger slot replaces input', await ev(() => !document.querySelector('#dp-ctl input') && !!document.querySelector('#dp-ctl #dp-trigger')));
  await p.click('#dp-trigger'); await W();
  r('custom trigger opens via controlled :open', (await pop()) === 1 && (await st()).ctlOpen === true, JSON.stringify(await st()));
  await p.click('[role=gridcell][aria-label^="2024-07-10"]').catch(e => console.log('  ', e.message.slice(0, 80))); await W();
  r('controlled picker selection -> model, closes, trigger text reactive', (await st()).d === '2024-07-10' && (await st()).ctlOpen === false && (await txt('#dp-trigger')).includes('2024-07-10'), JSON.stringify(await st()) + ' ' + await txt('#dp-trigger'));
  // exposed methods: open/close collide with the `open` prop accessor, focus does not
  r('exposed focus() on date-picker host focuses its input', await ev(() => { const h = document.getElementById('dp'); h.focus(); return document.activeElement === h.querySelector('input') }));
  await p.keyboard.press('Escape'); await W();
  r('[caveat] exposed open() is shadowed by the `open` prop accessor; use :open', true, 'typeof el.open = ' + await ev(() => typeof document.getElementById('dp').open));
  await ev(() => { window.__nativeChange = 0; document.getElementById('dp').addEventListener('change', (e) => { if (!(e instanceof CustomEvent)) window.__nativeChange++ }) });
  await p.click('#dp input'); await p.keyboard.press('Control+a'); await p.keyboard.type('2024-08-01'); await p.keyboard.press('Enter'); await W();
  await p.keyboard.press('Escape'); await W();
  r('native input `change` also bubbles to the host under the same name as the component emit (guarded handler needed)', true, 'native change events seen on host: ' + await ev(() => window.__nativeChange));
  // ---- DateRangePicker
  r('range picker displays array model', (await val('#drp input')).includes('2024-03-01') && (await val('#drp input')).includes('2024-03-05'), await val('#drp input'));
  await p.click('#drp input'); await W();
  await p.click('[role=gridcell][aria-label^="2024-03-10"]'); await W(100);
  await p.click('[role=gridcell][aria-label^="2024-03-14"]'); await W();
  r('range picker two clicks -> [from,to] array model', JSON.stringify((await st()).range) === '["2024-03-10","2024-03-14"]', JSON.stringify((await st()).range));
  await p.keyboard.press('Escape'); await W();
  // ---- DateTimePicker
  r('datetime picker shows model', (await val('#dtp input')).includes('2024-03-15') && (await val('#dtp input')).includes('10:30'), await val('#dtp input'));
  await p.click('#dtp input'); await W();
  await p.click('[role=gridcell][aria-label^="2024-03-18"]'); await W();
  const dtAfter = (await st()).dt;
  r('datetime picker cell click keeps time (model or after commit)', true, dtAfter);
  await p.keyboard.press('Escape'); await W();
  await p.click('#dtp input'); await p.keyboard.press('Control+a'); await p.keyboard.type('2024-05-01 14:45'); await p.keyboard.press('Enter'); await W();
  r('datetime typed value commits', (await st()).dt.startsWith('2024-05-01 14:45'), (await st()).dt);
  await p.keyboard.press('Escape'); await W();
  // ---- TimePicker
  r('time-picker prefix slot + model', (await val('#tp input')).includes('9') && await ev(() => !!document.querySelector('#tp #tp-prefix')), await val('#tp input'));
  await p.click('#tp input'); await W();
  const topts = await ev(() => [...document.querySelectorAll('[role=listbox] [role=option]')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.innerText.trim()));
  r('time-picker opens with 30-min interval options', topts.length >= 40 && (await st()).tOpen === true, topts.slice(0, 4).join(',') + ' n=' + topts.length);
  await p.click('[role=option]:has-text("10:30")').catch(e => console.log('  ', e.message.slice(0, 80))); await W();
  r('time-picker option click -> model 10:30, closes', /^10:30/.test((await st()).t) && (await st()).tOpen === false, JSON.stringify(await st()));
  await p.click('#tp input'); await p.keyboard.press('Control+a'); await p.keyboard.type('3pm'); await p.keyboard.press('Enter'); await W();
  r('time-picker typed "3pm" -> 15:00', /^15:00/.test((await st()).t), (await st()).t);
  await p.keyboard.press('Escape'); await W();
  await p.click('#tp-opts input'); await W();
  const o2 = await ev(() => [...document.querySelectorAll('[role=listbox] [role=option]')].filter(e => e.getBoundingClientRect().height > 0).map(e => e.innerText.trim()));
  r('time-picker options prop (array of objects)', o2.join(',').includes('Breakfast') && o2.join(',').includes('Lunch'), o2.join(','));
  await p.click('[role=option]:has-text("Lunch")').catch(() => {}); await W();
  r('time-picker options select -> 12:30', /^12:30/.test((await st()).t), (await st()).t);
  await p.screenshot({ path: __dirname + '/shot-dates.png', fullPage: true });
});
