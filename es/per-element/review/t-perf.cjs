// Cost of one Vue app per element: 200 es-button vs one Vue app with 200 <Button>.
const N = +(process.env.N || 200);
const measureEs = (p, mode) => p.evaluate(async ([N, mode]) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  await new Promise(r => setTimeout(r, 50));
  const t0 = performance.now();
  if (mode === 'innerHTML') root.innerHTML = Array.from({ length: N }, (_, i) => `<es-button label="B${i}" variant="subtle"></es-button>`).join('');
  else { const f = document.createDocumentFragment(); for (let i = 0; i < N; i++) { const e = document.createElement('es-button'); e.label = 'B' + i; f.append(e) } root.append(f) }
  const t1 = performance.now();
  await new Promise(r => requestAnimationFrame(() => setTimeout(r)));
  const t2 = performance.now();
  return { sync: +(t1 - t0).toFixed(1), toPaint: +(t2 - t0).toFixed(1), buttons: root.querySelectorAll('button').length };
}, [N, mode]);
const measureVue = (p) => p.evaluate(async (N) => {
  const { createApp, h, FUI } = window.__ctl; const root = document.getElementById('root'); root.innerHTML = '';
  await new Promise(r => setTimeout(r, 50));
  const t0 = performance.now();
  const app = createApp({ render: () => Array.from({ length: N }, (_, i) => h(FUI.Button, { label: 'B' + i, variant: 'subtle' })) }); app.mount(root);
  const t1 = performance.now(); await new Promise(r => requestAnimationFrame(() => setTimeout(r))); const t2 = performance.now();
  const n = root.querySelectorAll('button').length; app.unmount();
  return { sync: +(t1 - t0).toFixed(1), toPaint: +(t2 - t0).toFixed(1), buttons: n };
}, N);
require('./lib.cjs').run(null, async ({ p, r, info }) => {
  const cdp = await p.context().newCDPSession(p);
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize };
  await p.goto('file://' + __dirname + '/p-blank.html'); await p.waitForTimeout(300);
  const es = []; for (let i = 0; i < 5; i++) es.push(await measureEs(p, i % 2 ? 'innerHTML' : 'create'));
  await p.evaluate(() => { document.getElementById('root').innerHTML = '' }); await p.waitForTimeout(100); const h0 = await heap(); await measureEs(p, 'create'); const h1 = await heap();
  info('es-button x' + N + ' (5 runs)', es); info('heap for ' + N + ' es-button (KB)', ((h1 - h0) / 1024).toFixed(0));
  await p.goto('file://' + __dirname + '/p-ctl.html'); await p.waitForTimeout(300);
  const vv = []; for (let i = 0; i < 5; i++) vv.push(await measureVue(p));
  await p.evaluate(() => { document.getElementById('root').innerHTML = '' }); const h2 = await heap(); const keep = await p.evaluate((N) => { const { createApp, h, FUI } = window.__ctl; const el = document.getElementById('root'); window.__app = createApp({ render: () => Array.from({ length: N }, (_, i) => h(FUI.Button, { label: 'B' + i })) }); window.__app.mount(el); return 1 }, N); const h3 = await heap();
  info('one Vue app, ' + N + ' Button (5 runs)', vv); info('heap for one app with ' + N + ' Button (KB)', ((h3 - h2) / 1024).toFixed(0));
  const med = a => a.map(x => x.sync).sort((a, b) => a - b)[2];
  info('median sync ms es vs vue', { es: med(es), vue: med(vv), ratio: (med(es) / med(vv)).toFixed(1) });
});
