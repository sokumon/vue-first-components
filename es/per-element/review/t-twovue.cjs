// An app that bundles its own Vue (global build, dev) driving es-* elements from a Vue template.
require('./lib.cjs').run('p-twovue.html', async ({ p, r, info, wait, txt }) => {
  info('globals', await p.evaluate(() => ({ VueStillHost: window.Vue === window.__vueIsSame, ES: typeof window.ES, esReg: window.__es.registered.length })));
  await p.click('#s1 button'); await wait(300);
  await p.click('[role=option]:has-text("Blue")'); await wait(150);
  r('host-Vue template: :model-value/@update:model-value on es-select', (await txt('#state')).startsWith('blue|'), await txt('#state'));
  await p.fill('#t1 input', 'typed'); await wait(100);
  r('host-Vue v-model on es-text-input works', (await txt('#state')).endsWith('|typed'), await txt('#state'));
  info('t1 after v-model: host value prop / attr', await p.$eval('#t1', e => ({ value: e.value, mv: e.modelValue })));
  await p.keyboard.press('Escape');
  await p.click('#push'); await wait(150);
  await p.click('#s1 button'); await wait(300);
  const o = await p.$$eval('[role=option]', x => x.map(e => e.innerText.trim()));
  r('in-place push on host-Vue reactive array reaches es-select (cross-copy reactivity)', o.includes('Green'), o);
  await p.keyboard.press('Escape'); await wait(150);
  await p.click('#replace'); await wait(150);
  await p.click('#s1 button'); await wait(300);
  const o2 = await p.$$eval('[role=option]', x => x.map(e => e.innerText.trim()));
  r('replacing the array reaches es-select', o2.includes('Green'), o2);
});
