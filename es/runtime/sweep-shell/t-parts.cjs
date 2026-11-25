// jQuery-driven re-run of wc/sweep/shell/t-parts.cjs + Desk-style operations.
require('./lib.cjs')('parts.html', async ({ p, r, txt, st, ev, W, vis, rect, inside, log, safe, errs, errCount }) => {
  let t = 'es-page-header-base'
  await safe(t, 'core', async () => {
    r(t, 'teleports into the registered es-page-header-target', await inside('#phb-slot', '#tgt'))
    const cls = await p.$eval('#tgt header', (h) => h.className).catch(() => 'none')
    r(t, 'class attribute lands on the teleported <header>', cls.includes('bg-surface-gray-2'), cls)
    r(t, 'anchor <span hidden> stays at declaration site', await ev(() => !!document.querySelector('#phb span[hidden]')))
    await p.click('#phb-btn button'); await W(100)
    r(t, 'teleported slot stays live (jQuery handler + text)', (await txt('#phb-slot')) === 'Base header for Grace' && (await log()).includes('rename'), await txt('#phb-slot'))
    await ev(() => (document.querySelector('#decl').scrollTop = 200)); await W(50)
    await p.click('#phb-slot'); await W(700)
    const top = await ev(() => document.querySelector('#decl').scrollTop)
    r(t, 'clicking header background scrolls its declaration scroll parent to top', top === 0, top)
  })
  t = 'es-page-header'
  await safe(t, 'core', async () => {
    r(t, 'second header (page-header) also teleported to the same target', await inside('#ph2t-slot', '#tgt') && (await txt('#ph2t-slot')) === 'Slot title Grace', await txt('#ph2t-slot'))
    r('es-page-header-title', 'default slot overrides title', (await p.$eval('#ph2t span', (s) => s.className).catch(() => '')).includes('truncate'))
    const n0 = await ev(() => document.querySelectorAll('#tgt header').length)
    await p.click('#hide button'); await W(300)
    const n1 = await ev(() => document.querySelectorAll('#tgt header').length)
    r(t, 'jQuery .remove() of the wrapper removes the teleported header', n0 === 2 && n1 === 1 && !(await p.$('#ph2t-slot')), `${n0} -> ${n1}`)
  })
  await safe('es-page-header-mobile-title', 'core', async () => {
    r('es-page-header-mobile-title', 'standalone, title attribute', (await txt('#sa-mt')) === 'Standalone mobile title' && !(await ev(() => document.getElementById('sa-mt').hasAttribute('title'))), await txt('#sa-mt'))
    r('es-page-header-title', 'standalone slot-only', (await txt('#sa-t')) === 'Slot only Grace', await txt('#sa-t'))
    r('es-page-header-back-button', 'icon-only ghost button, aria-label "Back" + chevron', (await p.$eval('#sa-back button', (b) => b.getAttribute('aria-label')).catch(() => '')) === 'Back' && !!(await p.$('#sa-back button .lucide-chevron-left, #sa-back button svg')))
  })

  // ---------------------------------------------------------------- Desk-style
  t = 'es-page-header-base'
  await safe(t, 'desk ops', async () => {
    await ev(() => $('#phb').append('<span id="phb-extra">extra</span>')); await W(100)
    r(t, '.append() on host -> joins the teleported header slot', await inside('#phb-extra', '#tgt header'))
    await ev(() => $('#phb').html('<span id="phb-new">Replaced <b>header</b></span>')); await W(150)
    const n = await ev(() => document.querySelectorAll('#tgt header').length)
    r(t, '.html() on host -> header remounted with new slot, still one header in target', await inside('#phb-new', '#tgt header') && !(await p.$('#phb-slot')) && n === 1, n)
    await ev(() => $('#phb').empty()); await W(150)
    r(t, '.empty() on host -> empty header stays (one), old nodes gone', !(await p.$('#phb-new')) && (await ev(() => document.querySelectorAll('#tgt header').length)) === 1)
    const e0 = await errCount()
    await ev(() => { const $h = $('#phb').detach(); $('#desk').append($h) }); await W(200)
    r(t, '.detach() + append elsewhere in same task: header stays in target, anchor moved', (await ev(() => document.querySelectorAll('#tgt header').length)) === 1 && await ev(() => !!document.querySelector('#desk #phb span[hidden]')) && (await errCount()) === e0, errs.slice(e0))
    await ev(() => $('#phb').remove()); await W(200)
    r(t, '.remove() takes its header out of the target', (await ev(() => document.querySelectorAll('#tgt header').length)) === 0)
  })
  t = 'es-page-header-target'
  await safe(t, 'desk ops', async () => {
    // new header created from a string inside a larger template, while the target exists
    await ev(() => $('#desk').append(`<div class="page-head"><div class="title-area"><es-page-header id="ph3"><es-page-header-title id="ph3t" title="From template"></es-page-header-title><es-button id="ph3-b" label="Act"></es-button></es-page-header></div></div>`)); await W(200)
    r('es-page-header', 'created inside a larger jQuery template: teleported into the target', (await txt('#tgt')).includes('From template') && await inside('#ph3-b', '#tgt'), await txt('#tgt'))
    // the target itself detached and re-attached
    const e0 = await errCount()
    await ev(() => { const $t = $('#tgt').detach(); $('#tgt-wrap').append($t) }); await W(200)
    r(t, '.detach() + re-append the target in same task keeps the header', (await txt('#tgt')).includes('From template') && (await errCount()) === e0, errs.slice(e0))
    // target removed, then a new target: headers registered later go to the new one
    await ev(() => $('#tgt').remove()); await W(200)
    r(t, '.remove() of the target: header falls back to its declaration site (Teleport disabled, component behaviour)', await ev(() => !!document.querySelector('#ph3 header #ph3-b button')) && !(await p.$('#tgt')))
    await ev(() => $('#tgt-wrap').append('<es-page-header-target id="tgt2"></es-page-header-target>')); await W(200)
    r(t, 'a new target from a string picks the existing header up', (await txt('#tgt2')).includes('From template'), await txt('#tgt2'))
    await ev(() => $('#tgt2').clone().attr('id', 'tgt3').appendTo('#desk')); await W(200)
    r(t, '.clone() of a target: no duplicate headers rendered from the clone', (await ev(() => document.querySelectorAll('header').length)) === 1, await ev(() => document.querySelectorAll('header').length))
  })
  await safe('es-page-header-back-button', 'desk ops', async () => {
    await ev(() => $('#sa-back').clone().attr('id', 'sa-back2').attr('label', 'Go back').appendTo('#desk')); await W(150)
    r('es-page-header-back-button', '.clone() + .attr(label) -> aria-label "Go back"', (await p.$eval('#sa-back2 button', (b) => b.getAttribute('aria-label')).catch(() => '')) === 'Go back')
  })
})
