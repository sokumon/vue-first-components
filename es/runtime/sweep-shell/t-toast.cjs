// jQuery-driven re-run of wc/sweep/shell/xo/t-toast.cjs (parser-created hosts) + Desk-style operations.
require('./lib.cjs')('toast.html', async ({ p, r, txt, st, ev, W, vis, rect, inside, log, safe, errs, errCount }) => {
  const toasts = () => p.$$eval('[data-sonner-toast]', (es) => es.map((e) => e.innerText.trim().replace(/\n/g, ' / ')))
  const toasters = () => ev(() => document.querySelectorAll('[data-sonner-toaster]').length)
  let t = 'es-toast-provider'
  await safe(t, 'core', async () => {
    await p.click('#btn-toast'); await W(500)
    const tt = await toasts()
    r(t, 'standalone provider shows ES.toast.error with action, exactly once', tt.length === 1 && tt[0].includes('Failed') && tt[0].includes('Retry'), { tt, toasters: await toasters() })
    r(t, 'error toast has an icon', !!(await p.$('[data-sonner-toast] [data-icon]')))
    await p.locator('[data-sonner-toast] button:has-text("Retry")').first().click(); await W(300)
    r(t, 'toast action onClick fires', (await log()).includes('retry'), await log())
  })
  t = 'es-dialogs'
  await safe(t, 'core', async () => {
    await p.click('#btn-danger'); await W(400)
    const d = await p.$$('[role=dialog], [role=alertdialog]')
    r(t, 'standalone es-dialogs renders dialog.danger() exactly once', d.length === 1 && (await d[0].innerText()).includes('Delete it?'), d.length)
    await p.locator('[role=dialog] button:has-text("Delete")').first().click(); await W(400)
    r(t, 'async onConfirm runs and closes', (await log()).includes('deleted') && !(await p.$('[role=dialog]')), await log())
    await p.click('#btn-danger'); await W(400); await p.keyboard.press('Escape'); await W(400)
    r(t, 'imperative dialog Escape closes', !(await p.$('[role=dialog]')))
  })
  await safe('es-toast-provider', 'desk ops', async () => {
    const e0 = await errCount()
    await ev(() => { const $t = $('#tp').detach(); $('#app').append($t) }); await W(200)
    await p.click('#btn-toast'); await W(500)
    r('es-toast-provider', '.detach() + .append() (same task): toast shown, one toaster', (await toasts()).some((x) => x.includes('Failed')) && (await toasters()) === 1 && (await errCount()) === e0, { n: await toasters(), e: errs.slice(e0) })
    await ev(() => $('#tp').remove()); await W(300)
    await ev(() => ES.toast.success('No provider element')); await W(500)
    r('es-toast-provider', 'after .remove(): ES.toast still shows (one toaster)', (await toasts()).some((x) => x.includes('No provider element')) && (await toasters()) === 1, await toasters())
    await ev(() => $('#dl').remove()); await W(200)
    await p.click('#btn-danger'); await W(400)
    r('es-dialogs', 'after .remove(): ES.dialog still renders once (root Dialogs)', (await ev(() => document.querySelectorAll('[role=dialog],[role=alertdialog]').length)) === 1)
    await p.keyboard.press('Escape'); await W(300)
  })
})
