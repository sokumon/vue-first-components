// node probe.cjs page.html [js-expression]  -> dumps errors + evaluation
require('./lib.cjs').run(process.argv[2], async ({ p, wait }) => {
  await wait(500);
  const out = await p.evaluate(process.argv[3] || 'document.body.outerHTML.slice(0,4000)');
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
}, { viewport: process.env.MOBILE ? { width: 390, height: 800 } : undefined });
