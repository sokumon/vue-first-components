// Two Desk bundles that each import the es-* package (esbuild has no cross-bundle dedupe; only `vue` is shimmed).
const { run } = require('./lib.cjs')
run('twobundles', 'two-bundles.html', async ({ p, r, ev }) => {
  await p.waitForFunction(() => window.ES && window.ES2)
  const a = await ev(async () => {
    const same = window.ES === window.ES2
    ES2.toast.success('from the second bundle'); await new Promise((r) => setTimeout(r, 600))
    const shown2 = document.querySelectorAll('[data-sonner-toast]').length
    ES.toast.success('from the first bundle'); await new Promise((r) => setTimeout(r, 600))
    const shown1 = document.querySelectorAll('[data-sonner-toast]').length - shown2
    return { same, registered2: ES2.registered.length, app2: !!ES2.app, shown2, shown1, failed2: ES2.failed.length }
  })
  r('a second bundle importing es-ui shares the one runtime (toast from bundle 2 shows)', a.same || a.shown2 === 1, a)
})
