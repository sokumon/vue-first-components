// No-JS / pre-upgrade rendering of the core test page (dist/index.html).
require('./lib.cjs').run(null, async ({ p, r, info }) => {
  await p.goto('file://' + __dirname + '/../../dist/index.html'); await p.waitForTimeout(300);
  const s = await p.evaluate(() => ({
    text: document.body.innerText.replace(/\n+/g, ' / ').slice(0, 500),
    labelOnlyButtonsEmpty: [...document.querySelectorAll('es-button[label]')].filter(e => !e.innerText.trim()).length,
    closedDialogBodyVisible: (() => { const e = document.getElementById('dlg-body'); const r = e.getBoundingClientRect(); return r.height > 0 })(),
    defined: !!customElements.get('es-button'),
  }));
  info('no-JS page', s);
  r('no-JS: closed dialog body is not shown inline', !s.closedDialogBodyVisible, s.closedDialogBodyVisible);
  r('no-JS: no raw {{ }} shown', !/\{\{/.test(s.text));
  await p.screenshot({ path: __dirname + '/shot-nojs.png', fullPage: true });
}, { ctx: { javaScriptEnabled: false } });
