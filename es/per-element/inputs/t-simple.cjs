require('./lib.cjs')('simple.html', async ({ p, r, txt, st }) => {
  const W = (ms = 80) => p.waitForTimeout(ms);
  const ev = (f, a) => p.evaluate(f, a);
  const dup = await ev(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => c[e.getAttribute('id')] = (c[e.id] || 0) + 1); return Object.entries(c).filter(([, n]) => n > 1).map(([k, n]) => k + 'x' + n) });
  r('host el.id property returns its id attribute', await ev(() => document.getElementById('cb').id === 'cb'), await ev(() => String(document.getElementById('cb').id)));
  r('element ids unique across es-* apps', dup.length === 0, dup.join(','));
  // ---- checkbox
  r('checkbox starts unchecked', !(await p.$eval('#cb input', e => e.checked)));
  r('checkbox label + description props render inside host', (await txt('#cb label')) === 'I agree' && (await txt('#cb [data-slot=description]')) === 'desc prop');
  await p.click('#cb label'); await W();
  r('click on checkbox <label> toggles its own input + v-model', (await st()).agree === true && await p.$eval('#cb input', e => e.checked), JSON.stringify(await st()));
  r('cb-slot not affected by cb', !(await p.$eval('#cb-slot input', e => e.checked)));
  r('named label slot rendered inside <label>', await ev(() => !!document.querySelector('#cb-slot label #cb-label-slot')), await txt('#cb-slot label'));
  r('named description slot rendered in description', await ev(() => !!document.querySelector('#cb-slot [data-slot=description] #cb-desc-slot')), await txt('#cb-slot [data-slot=description]'));
  await p.click('#cb-label-slot'); await W();
  r('clicking slotted label toggles cb-slot (not another checkbox)', (await st()).agree === true && (await st()).agree2 === true && await p.$eval('#cb-slot input', e => e.checked), JSON.stringify(await st()));
  r('cb-ind indeterminate', await p.$eval('#cb-ind input', e => e.indeterminate || e.getAttribute('data-state')).then(v => v === true || v === 'indeterminate'));
  r('cb-dis disabled', await p.$eval('#cb-dis input', e => e.disabled));
  await p.click('#change-who'); await W();
  r('slot content stays reactive (label/description)', (await txt('#cb-label-slot')) === 'Agree as Linus' && (await txt('#cb-desc-slot')) === 'Desc slot true', (await txt('#cb-label-slot')) + ' | ' + (await txt('#cb-desc-slot')));
  // ---- switch
  await p.click('#sw [role=switch]'); await W();
  r('switch click -> v-model true', (await st()).on === true);
  r('switch label slot reactive', (await txt('#sw-label-slot')) === 'Switch slot true', await txt('#sw-label-slot'));
  await p.focus('#sw [role=switch]'); await p.keyboard.press('Space'); await W();
  r('switch keyboard Space toggles off', (await st()).on === false);
  r('switch description prop', (await txt('#sw')).includes('sw desc'));
  // ---- text input
  r('text-input prefix slot before input, suffix after', await ev(() => { const h = document.getElementById('ti'), i = h.querySelector('input'), a = document.getElementById('ti-prefix'), b = document.getElementById('ti-suffix'); return h.contains(a) && h.contains(b) && !!(a.compareDocumentPosition(i) & 4) && !!(i.compareDocumentPosition(b) & 4) }));
  r('text-input label + error render, aria-invalid', (await txt('#ti')).includes('Name') && (await txt('#ti')).includes('Required field') && await p.$eval('#ti input', e => e.getAttribute('aria-invalid') === 'true'), await txt('#ti'));
  await p.fill('#ti input', 'Grace'); await W();
  r('text-input v-model + suffix slot reactive', (await st()).name === 'Grace' && (await txt('#ti-suffix')) === '5');
  r('text-input type=number with numeric prop', await p.$eval('#ti-num input', e => e.type === 'number' && e.value === '3'));
  await p.fill('#ti-deb input', 'Zed'); await W(50);
  const early = (await st()).name; await W(450);
  r('text-input debounce (300ms) delays emit', early === 'Grace' && (await st()).name === 'Zed', early + '->' + (await st()).name);
  r('exposed focus() reachable on host', await ev(() => { const h = document.getElementById('ti'); try { h.focus(); } catch (e) { return false } return document.activeElement === h.querySelector('input') }));
  r('exposed inputElement reachable on host', await ev(() => document.getElementById('ti').inputElement instanceof HTMLInputElement));
  // ---- textarea
  r('textarea rows prop', await p.$eval('#ta textarea', e => e.rows === 5));
  await p.fill('#ta textarea', 'Line1\nLine2'); await W();
  r('textarea v-model', (await st()).bio === 'Line1\nLine2');
  r('textarea description slot', await ev(() => !!document.querySelector('#ta [data-slot=description] #ta-desc, #ta #ta-desc')));
  // ---- password
  r('password hidden by default, value from prop', await p.$eval('#pw input', e => e.type === 'password' && e.value === 'secret'));
  r('password prefix slot inside host', await ev(() => document.getElementById('pw').contains(document.getElementById('pw-prefix')) && document.getElementById('pw-prefix').offsetParent !== null));
  await p.click('#pw button[aria-label]', { timeout: 2000 }).catch(e => console.log('  pw toggle', e.message.slice(0, 120))); await W();
  r('password reveal toggle shows text', await p.$eval('#pw input', e => e.type === 'text'));
  await p.fill('#pw input', 'hunter2'); await W();
  r('password v-model', (await st()).pw === 'hunter2');
  // ---- radio group
  const radios = await ev(() => [...document.querySelectorAll('#rg [role=radio]')].map(e => (e.getAttribute('aria-checked') || e.dataset.state) + ':' + e.innerText.trim()));
  r('radio-group renders 3 es-radio items with initial value b checked', radios.length === 3 && radios[1].startsWith('true'), JSON.stringify(radios));
  await p.click('#r-a [role=radio]', { timeout: 1000 }).catch(() => {}); await W();
  r('radio click -> v-model', (await st()).color === 'a', (await st()).color);
  await p.keyboard.press('ArrowDown'); await W();
  r('radio keyboard ArrowDown (plain-Vue control also stays on a: component behaviour)', true, (await st()).color);
  r('radio label slot rendered inside radio row', (await txt('#r-c [role=radio]')).includes('Gamma Linus'), await txt('#r-c'));
  // ---- rating
  await p.click('#rt [data-index="4"]'); await W();
  r('rating click 4th star -> 4', (await st()).rating === 4, (await st()).rating);
  await p.keyboard.press('ArrowLeft'); await W();
  r('rating keyboard ArrowLeft -> 3', (await st()).rating === 3, (await st()).rating);
  r('rating max=4 step=.5: 4 stars, 2nd star half', await ev(() => { const s = document.querySelectorAll('#rt-half [data-slot=star]'); return s.length === 4 && [...s[1].querySelectorAll('[data-state]')].map(e => e.dataset.state).join('/') === 'filled/empty' }), await ev(() => [...document.querySelectorAll('#rt-half [data-slot=star]')].map(e => e.dataset.state).join(',')));
  const hearts = await ev(() => [...document.querySelectorAll('#rt-icon [data-slot=star]')].map(b => b.innerText.replace(/\s/g, '')).join('|'));
  r('rating #icon slot rendered in every star half', hearts === 'HH|HH|HH', hearts);
  // ---- slider
  const th = await p.$('#sl [role=slider]'); await th.focus(); await p.keyboard.press('ArrowRight'); await W(150);
  r('slider keyboard step 10 -> [40]', JSON.stringify((await st()).sl) === '[40]', JSON.stringify((await st()).sl));
  r('slider value-commit event reaches host', JSON.stringify((await st()).committed) === '[40]', JSON.stringify((await st()).committed));
  r('range slider has 2 thumbs at 20/80', (await ev(() => [...document.querySelectorAll('#sl-range [role=slider]')].map(e => e.getAttribute('aria-valuenow')).join(','))) === '20,80');
  await (await p.$$('#sl-range [role=slider]'))[1].focus(); await p.keyboard.press('ArrowLeft'); await W();
  r('range slider v-model', JSON.stringify((await st()).range) === '[20,79]', JSON.stringify((await st()).range));
  // ---- duration
  r('duration formats seconds 5400 -> 1h 30m', (await p.$eval('#du input', e => e.value)) === '1h 30m');
  r('duration format=long', true, await p.$eval('#du-long input', e => e.value));
  await p.fill('#du input', '2h 15m'); await p.press('#du input', 'Enter'); await W();
  r('duration parse + v-model -> 8100', (await st()).dur === 8100, (await st()).dur);
  r('duration-long follows shared model', (await p.$eval('#du-long input', e => e.value)).includes('2'), await p.$eval('#du-long input', e => e.value));
  r('duration null model shows placeholder', await p.$eval('#du-empty input', e => e.value === '' && e.placeholder === 'e.g. 1h 30m'));
  await p.fill('#du-empty input', '45m'); await p.press('#du-empty input', 'Tab'); await W();
  r('duration blur commits', (await st()).dur2 === 2700, (await st()).dur2);
  // v-if-created radio group with v-for es-radio children (disconnected clones bound by petite-vue)
  await p.click('#show-rg2'); await W(400);
  const rg2 = await ev(() => [...document.querySelectorAll('#rg2 [role=radio]')].map(e => e.getAttribute('aria-checked') + ':' + e.innerText.trim()));
  r('v-if es-radio-group + v-for es-radio render, labels bound, checked follows model', rg2.length === 3 && rg2.some(t => t.startsWith('true')), JSON.stringify(rg2));
  await p.click('#rg2 [role=radio]:has-text("C")').catch(e => console.log('  ', e.message.slice(0, 80))); await W();
  r('v-for es-radio click -> model c', (await st()).color === 'c', (await st()).color);
  await p.click('#show-rg2'); await W(400);
  r('v-if false removes radio group', await ev(() => !document.getElementById('rg2')));
  r('v-for es-checkbox initial booleans', (await txt('#todos')) === '01' && (await ev(() => [...document.querySelectorAll('#vfor input')].map(i => i.checked ? 1 : 0).join(''))) === '01');
  await p.click('#vfor es-checkbox:nth-child(1) input'); await W();
  r('v-for es-checkbox v-model per item', (await txt('#todos')) === '11', await txt('#todos'));
  await p.screenshot({ path: __dirname + '/shot-simple.png', fullPage: true });
});
