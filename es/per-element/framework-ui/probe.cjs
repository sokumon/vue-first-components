// Quick look: registration + what each host rendered.
const run = require('./lib.cjs');
const page = process.argv[2] || 'fields.html';
run(page, async ({ p }) => {
  console.log(JSON.stringify(await p.evaluate(() => window.__es)));
  const out = await p.evaluate(() => [...document.querySelectorAll('[id^=f-],[id^=c-]')].map((e) => e.id + ' :: ' + e.innerText.replace(/\s+/g, ' ').slice(0, 120) + ' :: html=' + e.innerHTML.length));
  out.forEach((l) => console.log(l));
}, { shot: 'shot-probe.png' });
