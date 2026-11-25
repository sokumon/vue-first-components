// petite-vue walks Vue output: does attribute data turn into executed expressions?
require('./lib.cjs').run('p-inject.html', async ({ p, r, info, wait, txt }) => {
  info('b1 text', await txt('#b1')); info('a1 text', await txt('#a1'));
  const s = await p.evaluate(() => ({ pwned: window.__pwned, pwned2: window.__pwned2 }));
  r('attribute value is never executed as an expression', !s.pwned && !s.pwned2, s);
  for (let i = 0; i < 3; i++) { await p.click('#tog'); await wait(50); await p.click('#tog'); await wait(50) }
  info('expr runs in v-if clones after 3 opens', await p.evaluate(() => window.__pwned3));
  info('plain DOM attr with {{ }} (control: petite leaves attributes alone)', await p.$eval('#plain span', e => e.getAttribute('data-x')));
});
