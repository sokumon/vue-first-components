// ad-hoc probe: node probe.cjs page.html 'js expression run in page (async allowed)'
const page = process.argv[2], code = process.argv[3]
require('./lib.cjs')(page, async ({ p, ev, errs }) => {
  const n0 = errs.length
  const out = await p.evaluate(`(async () => { ${code} })()`).catch((e) => 'THREW ' + e.message)
  console.log('OUT', typeof out === 'string' ? out : JSON.stringify(out, null, 1))
  console.log('NEW ERRS', errs.slice(n0).join('\n'))
})
