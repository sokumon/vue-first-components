// jQuery-driven re-run of wc/sweep/overlays/t-toast.cjs (+ Desk-style operations).
require('./lib.cjs')('toast.html', async ({ p, r, txt, st, ev, W, vis, rect, inside, log, safe }) => {
  let t = 'es-toast-provider'
  await safe(t, 'core', async () => {
    await p.click('#btn-toast'); await W(500)
    const tt = await p.$$eval('[data-sonner-toast]', (es) => es.map((e) => e.innerText.trim().replace(/\n/g, ' / ')))
    r(t, 'standalone es-toast-provider: toast.error with action shows once', tt.length === 1 && tt[0].includes('Failed') && tt[0].includes('Retry'), tt)
    r(t, 'error toast has an icon', !!(await p.$('[data-sonner-toast] [data-icon]')))
    await p.click('[data-sonner-toast] button:has-text("Retry")'); await W(300)
    r(t, 'toast action onClick fires', (await log()).includes('retry'))
  })
  t = 'es-dialogs'
  await safe(t, 'core', async () => {
    await p.click('#btn-danger'); await W(400)
    const d = await p.$$('[role=dialog], [role=alertdialog]')
    r(t, 'renders dialog.danger() once', d.length === 1 && (await d[0].innerText()).includes('Delete it?'), d.length)
    await p.click('[role=dialog] button:has-text("Delete")'); await W(400)
    r(t, 'async onConfirm runs, closes', (await log()).includes('deleted') && !(await p.$('[role=dialog]')))
    await p.click('#btn-danger'); await W(400); await p.keyboard.press('Escape'); await W(400)
    r(t, 'imperative dialog Escape closes', !(await p.$('[role=dialog]')))
  })
  await safe('es-toast-provider', 'desk ops', async () => {
    t = 'es-toast-provider'
    await ev(() => $('#tp').remove()); await W(100)
    await p.click('#btn-toast'); await W(500)
    const n = await p.$$eval('[data-sonner-toast]', (es) => es.filter((e) => e.innerText.includes('Failed')).length)
    r(t, '.remove() of the page\'s provider: the root toaster takes over (toasts still show)', n >= 1, n)
    await ev(() => $('#dl').remove()); await W(100)
    await p.click('#btn-danger'); await W(400)
    r('es-dialogs', '.remove() of the page\'s es-dialogs: root Dialogs takes over', (await p.$$('[role=dialog]')).length === 1)
    await p.keyboard.press('Escape'); await W(300)
  })
})
