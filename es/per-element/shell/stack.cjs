// Debug helper: load a page from BUILD dir, print page errors with stacks and
// any setAttribute with a numeric name (where it came from).
const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright');
const fs = require('fs');
(async () => {
  const d = __dirname + '/' + (process.env.BUILD || 'base');
  fs.copyFileSync(__dirname + '/pages/' + process.argv[2], d + '/' + process.argv[2]);
  fs.copyFileSync(__dirname + '/../../public/petite-vue.iife.js', d + '/petite-vue.iife.js');
  const b = await chromium.launch(); const p = await b.newPage();
  await p.addInitScript(() => {
    const o = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (k, v) {
      if (/^[0-9]/.test(k)) {
        const host = this.closest('[id]') || (this.parentElement && this.parentElement.closest('[id]'));
        console.warn('BADATTR', k, String(v).slice(0, 40), this.outerHTML.slice(0, 160), 'host:', host && host.id, new Error().stack.split('\n').slice(2, 12).join(' | '));
      }
      return o.call(this, k, v);
    };
  });
  p.on('pageerror', e => console.log('ERR', e.stack.slice(0, 1500)));
  p.on('console', m => m.type() !== 'log' && console.log(m.type(), m.text().slice(0, 1500)));
  await p.goto('file://' + d + '/' + process.argv[2]); await p.waitForTimeout(800);
  if (process.argv[3]) console.log(await p.evaluate(process.argv[3]));
  await b.close();
})();
