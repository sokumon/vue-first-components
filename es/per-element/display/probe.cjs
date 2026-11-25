const { chromium } = require(process.env.HOME + '/fb/pw/node_modules/playwright');
const fs = require('fs');
const build = process.argv[2] || 'base';
fs.writeFileSync(__dirname + '/page-' + build + '.html', fs.readFileSync(__dirname + '/index.html', 'utf8').replace(/BUILD\//g, build + '/'));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('console', m => (m.type()==='error'||m.type()==='warning') && errs.push(m.type()+': '+m.text().slice(0,300))); p.on('pageerror', e => errs.push('pageerror: '+e.message));
  await p.goto('file://' + __dirname + '/page-' + build + '.html'); await p.waitForTimeout(800);
  for (const s of (process.argv[3]||'s-alert').split(',')) {
    console.log('=== ' + s); console.log(await p.$eval('#' + s, e => e.outerHTML.replace(/<es-slots hidden="">[\s\S]*?<\/es-slots>/g, '<es-slots…/>')));
  }
  console.log('errors', errs.length); errs.forEach(e => console.log('  ' + e));
  await b.close();
})();
