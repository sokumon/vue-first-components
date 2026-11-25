// v-for keyed reorder, v-if toggling, es-select in v-if, petite walking Vue output ("{{").
require('./lib.cjs').run('p-list.html', async ({ p, r, info, wait, txt }) => {
  // identity + internal state across keyed reorder
  await p.fill('li[data-row=a] es-text-input input', 'typed-a');
  const ids0 = await p.evaluate(() => [...document.querySelectorAll('es-checkbox')].map(e => e.dataset.id + '#' + (e.__mark ||= Math.random().toString(36).slice(2, 6))));
  await p.click('#rev'); await wait(200);
  const after = await p.evaluate(() => ({
    order: [...document.querySelectorAll('es-checkbox')].map(e => e.dataset.id + '#' + e.__mark),
    labels: [...document.querySelectorAll('es-checkbox')].map(e => e.innerText.trim()),
    checked: [...document.querySelectorAll('es-checkbox input')].map(i => i.checked),
    typed: document.querySelector('li[data-row=a] es-text-input input')?.value,
    btn: [...document.querySelectorAll('li es-button')].map(e => e.innerText.trim()),
    apps: [...document.querySelectorAll('es-checkbox')].map(e => !!e._instance),
  }));
  info('before', ids0); info('after rev', after);
  r('keyed reorder keeps element identity (no remount)', after.order.join() === ids0.slice().reverse().join());
  r('keyed reorder keeps internal input state', after.typed === 'typed-a', after.typed);
  r('labels follow rows after reorder', after.labels.join() === 'Gamma,Beta,Alpha', after.labels);
  r('checked follows rows after reorder', after.checked.join() === 'false,true,false', after.checked);
  r('slot content in v-for button follows rows', after.btn.join() === 'Btn Gamma,Btn Beta,Btn Alpha', after.btn);
  await p.click('li[data-row=c] es-checkbox input'); await wait(100);
  r('checkbox in reordered v-for updates its own row: ' + await txt('#state'), (await txt('#state')).startsWith('c:true,b:true,a:false'));
  // add a row (new clone created by v-for after mount)
  await p.evaluate(() => { const s = document.querySelector('#app').__vue_app__ })
  // v-if toggling 20x
  const errBefore = 0;
  for (let i = 0; i < 20; i++) { await p.click('#tog'); await wait(30) }
  await wait(200);
  const vif = await p.evaluate(() => ({ badge: document.querySelector('#vif-badge')?.innerText.trim(), btn: document.querySelector('#vif-btn')?.innerText.trim(), holders: document.querySelectorAll('#vif es-slots').length, n: document.querySelectorAll('#vif-badge').length }));
  r('v-if toggled 20x: badge + slot render once', vif.badge === 'shown 3' && vif.btn === 'Slot Gamma' && vif.n === 1, vif);
  // es-select created by v-if (sweep claim: options becomes '[object Object]')
  await p.click('#togsel'); await wait(300);
  const sel = await p.evaluate(() => { const e = document.querySelector('#sel2'); return { optType: typeof e?._props?.options, opt: String(e?._props?.options).slice(0, 30), attr: e?.getAttribute('options'), html: e?.innerHTML.length } });
  info('v-if es-select props', sel);
  r('[claim es-select broken in v-if] options arrive as string', sel.optType === 'string', sel);
  // "{{" handling: literal mustache in attribute vs bound data
  const st = await txt('#static-badge'), bd = await txt('#bound-badge');
  info('static badge (label attr contains {{ 6*7 }})', st); info('bound badge (data contains {{ 6*7 }})', bd);
  r('bound user data containing {{ is shown literally', bd === '{{ 6*7 }}', bd);
  r('literal attribute containing {{ is shown literally (not evaluated by petite)', st === 'Literal {{ 6*7 }} from server', st);
});
