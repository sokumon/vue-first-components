// Leaks on removal, and detach/reattach (jQuery .detach(), drag-and-drop between lists).
require('./lib.cjs').run('p-blank.html', async ({ p, r, info, wait }) => {
  const cdp = await p.context().newCDPSession(p);
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); const u = await cdp.send('Runtime.getHeapUsage'); const d = await cdp.send('Memory.getDOMCounters'); return { mb: +(u.usedSize / 1e6).toFixed(2), nodes: d.nodes, listeners: d.jsEventListeners } };
  const cycle = (n, html) => p.evaluate(async ([n, html]) => {
    const root = document.getElementById('root');
    for (let i = 0; i < n; i++) {
      root.innerHTML = html;
      await new Promise(r => setTimeout(r, 0));
      root.innerHTML = '';
      await new Promise(r => setTimeout(r, 0));
    }
    await new Promise(r => setTimeout(r, 300));
    return document.body.children.length;
  }, [n, html]);
  const html = `<es-select options='' label="S"></es-select><es-dialog title="T" open><p>body</p><es-button label="x"></es-button></es-dialog><es-tooltip text="tip"><es-button label="y"></es-button></es-tooltip><es-text-input placeholder="a"></es-text-input>`;
  await cycle(20, html); const h0 = await heap(); info('after warmup 20', h0);
  const bodyKids = await cycle(200, html); const h1 = await heap(); info('after +200 cycles', { ...h1, bodyKids });
  await cycle(200, html); const h2 = await heap(); info('after +400 cycles', h2);
  const per = (h2.mb - h1.mb) / 200 * 1000; info('KB retained per cycle (200->400)', per.toFixed(1));
  r('no heap growth per add/remove cycle (<5KB/cycle)', per < 5, { per: per.toFixed(1), nodesDelta: h2.nodes - h1.nodes });
  r('no stray teleported dialogs left in body', await p.evaluate(() => document.querySelectorAll('[role=dialog]').length) === 0, await p.evaluate(() => document.querySelectorAll('[role=dialog]').length));
  // detach / reattach across a task: state lost? slot content kept?
  const d = await p.evaluate(async () => {
    const root = document.getElementById('root');
    root.innerHTML = `<es-text-input id="t" placeholder="a"></es-text-input><es-button id="b"><b>slot</b> text</es-button><div id="other"></div>`;
    await new Promise(r => setTimeout(r, 50));
    const t = document.getElementById('t'), b = document.getElementById('b');
    t.querySelector('input').value = 'typed';
    const inst0 = t._instance;
    t.remove(); b.remove();
    await new Promise(r => setTimeout(r, 50)); // past nextTick -> Vue unmounts
    document.getElementById('other').append(t, b);
    await new Promise(r => setTimeout(r, 50));
    return { remounted: t._instance !== inst0, inputValue: t.querySelector('input')?.value, btn: b.querySelector('button')?.innerText, holders: b.querySelectorAll('es-slots').length, btnCount: b.querySelectorAll('button').length };
  });
  info('detach -> reattach after a task', d);
  r('reattached button still renders its slot', d.btn === 'slot text', d);
  r('reattached input keeps uncontrolled state', d.inputValue === 'typed', d);
});
