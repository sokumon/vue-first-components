require('./lib.cjs').run('p-change.html', async ({ p, r, wait, txt }) => {
  await p.click('#cf input'); await wait(150);
  const log = await txt('#log');
  r('[claim es-fw-check-field caveat] host @change gets both the native Event and the CustomEvent', log.includes('native') && log.includes('custom:'), log);
});
