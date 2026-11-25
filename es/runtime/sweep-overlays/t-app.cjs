// jQuery-driven re-run of wc/sweep/overlays/t-app.cjs (+ Desk-style operations).
require('./lib.cjs')('app.html', async ({ p, r, txt, st, ev, W, vis, rect, inside, log, safe }) => {
  let t = 'es-frappe-ui-provider'
  await safe(t, 'core', async () => {
    r(t, 'provider renders its slot (jQuery-built app inside)', await vis('#btn-toast') && await inside('#app', '#prov'))
    r(t, 'provider slot is not hidden in es-slots', await p.$eval('#app', (e) => !e.closest('es-slots')))
    r(t, 'jQuery appended into #app after mount (provider slot): visible', await vis('#btn-k'))
  })
  t = 'toast (ES.toast)'
  await safe(t, 'core', async () => {
    await p.click('#btn-toast'); await W(500)
    const toasts = await p.$$eval('[data-sonner-toast]', (es) => es.map((e) => e.innerText.trim().replace(/\n/g, ' / ')))
    r(t, 'toast.success shows title + description', toasts.length >= 1 && toasts[0].includes('Saved #1') && toasts[0].includes('desc 1'), toasts)
    r(t, 'toast rendered once (app root ToastProvider + provider\'s own)', toasts.length === 1, toasts.length + ' toasts, ' + (await p.$$eval('[data-sonner-toaster]', (e) => e.length)) + ' toasters')
    r(t, 'toast has <b> from sanitised HTML', (await p.$eval('[data-sonner-toast] b', (b) => b.innerText).catch(() => '')) === '#1')
    const tr = await rect('[data-sonner-toast]')
    r(t, 'toast sits bottom-right', tr && tr.x > 600 && tr.y > 600, tr)
    await p.click('#btn-toast-act'); await W(500)
    await p.click('[data-sonner-toast] button:has-text("Undo")'); await W(300)
    r(t, 'toast action onClick fires', (await log()).includes('undo'))
  })
  t = 'dialog.confirm (ES.dialog)'
  await safe(t, 'core', async () => {
    await p.click('#btn-confirm'); await W(400)
    const dl = await p.$$('[role=dialog], [role=alertdialog]')
    r(t, 'renders exactly once', dl.length === 1 && (await dl[0].innerText()).includes('Really?'), dl.length)
    await p.click('[role=dialog] button:has-text("Confirm"), [role=alertdialog] button:has-text("Confirm")'); await W(400)
    r(t, 'onConfirm fires, dialog closes', (await log()).includes('confirmed') && !(await p.$('[role=dialog]')))
  })
  t = 'es-keyboard-shortcuts-dialog'
  await safe(t, 'core', async () => {
    await p.keyboard.press('Control+s'); await W()
    r(t, 'useKeyboardShortcut via ES.addRoot component handles Mod+S', (await st()).saved === 1, (await st()).saved)
    await p.click('#btn-k'); await W(400)
    const kd = '[role=dialog]'
    r(t, 'opens with title prop', await vis(kd) && (await txt(kd)).includes('Shortcuts here'))
    const kt = await txt(kd).catch(() => '')
    r(t, 'lists the registered groups/shortcuts', kt.includes('File') && kt.includes('Save doc') && kt.includes('Nav'), kt.slice(0, 200))
    r(t, 'search shown above threshold (search-threshold="3" -> Number)', !!(await p.$(kd + ' input')))
    await p.fill(kd + ' input', 'open').catch(() => {}); await W()
    const kt2 = await txt(kd).catch(() => '')
    r(t, 'search filters to "Open doc"', kt2.includes('Open doc') && !kt2.includes('Save doc'), kt2.slice(0, 200))
    await p.keyboard.press('Escape'); await W(400)
    r(t, 'Escape -> update:open false', (await st()).k === false && !(await vis(kd)))
  })
  t = 'es-scroll-area'
  await safe(t, 'core', async () => {
    const sa = await rect('#sa'), vp = await rect('#sa [data-slot=scroll-area-viewport]')
    r(t, 'class="h-40" on the host reaches the root and constrains the viewport', vp && vp.h <= 165 && vp.h > 100, { sa, vp })
    r(t, 'slot rows inside viewport', await inside('#sa-content', '#sa [data-slot=scroll-area-viewport]') && (await p.$$eval('.sa-row', (e) => e.length)) === 40)
    await p.hover('#sa-content'); await p.mouse.wheel(0, 300); await W(400)
    const s1 = await p.$eval('#sa [data-slot=scroll-area-viewport]', (e) => e.scrollTop).catch(() => -1)
    r(t, 'scrolls on wheel', s1 > 50, s1)
    r(t, 'custom vertical scrollbar shown', !!(await p.$('#sa [data-orientation=vertical]')))
    r(t, 'viewport-class prop applied', !!(await p.$('.sa-vp')))
    r(t, 'exposed viewportElement readable on element', await ev(() => !!(document.getElementById('sa').viewportElement && document.getElementById('sa').viewportElement.tagName)))
    const vp3 = await rect('#sa3 [data-slot=scroll-area-viewport]')
    r(t, 'class="h-full" inside a sized jQuery wrapper (display:contents host)', vp3 && vp3.h <= 165 && vp3.h > 100, vp3)
  })
  t = 'es-scroll-area'
  await safe(t, 'desk ops', async () => {
    await ev(() => $('#sa-content').append('<p id="sa-new">appended</p>')); await W(100)
    r(t, 'jQuery .append() into the content: new row inside viewport', await inside('#sa-new', '#sa [data-slot=scroll-area-viewport]'))
    await ev(() => $('#sa').html('<div id="sa-c2">' + Array.from({ length: 30 }, (_, i) => '<p>N' + i + '</p>').join('') + '</div>')); await W(200)
    r(t, '.html() on the host: new content inside the viewport, still scrolls', await inside('#sa-c2', '#sa [data-slot=scroll-area-viewport]') && await (async () => { await p.hover('#sa-c2'); await p.mouse.wheel(0, 200); await W(300); return (await p.$eval('#sa [data-slot=scroll-area-viewport]', (e) => e.scrollTop)) > 50 })())
    await ev(() => $('#sa').detach().prependTo('#app')); await W(200)
    const native = await ev(() => { const d = $('<div style="height:50px;overflow:auto"><div style="height:500px"></div></div>').appendTo('#app')[0]; d.scrollTop = 100; $(d).detach().prependTo('#app'); const v = d.scrollTop; $(d).remove(); return v })
    const kept = await p.$eval('#sa [data-slot=scroll-area-viewport]', (e) => e.scrollTop)
    r(t, '.detach().prependTo(): component kept; scrollTop behaves like a native scroller (native resets to ' + native + ')', (kept > 50) === (native > 50), { kept, native })
    await ev(() => $('#sa').clone().attr('id', 'sac').appendTo('#app')); await W(200)
    r(t, '.clone(): one viewport, content once', (await p.$$eval('#sac [data-slot=scroll-area-viewport]', (e) => e.length)) === 1 && (await p.$$eval('#sac #sa-c2', (e) => e.length)) === 1)
    await ev(() => $('#sac').remove())
  })
  t = 'es-frappe-ui-provider'
  await safe(t, 'desk ops', async () => {
    // jQuery .html() on the container inside the provider and toasts still work
    await ev(() => $('#app').html('<button id="btn2" class="border px-2">again</button>')); await W(100)
    await ev(() => $('#btn2').on('click', () => ES.toast.success('Again')))
    await p.click('#btn2'); await W(500)
    r(t, '.html() inside the provider slot: page keeps working, toast shows', await p.$$eval('[data-sonner-toast]', (es) => es.some((e) => e.innerText.includes('Again'))))
  })
})
