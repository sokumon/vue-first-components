// 3000 mixed es-* elements through one .html() string, refreshed 3x, then interaction latency.
const { run } = require('./lib.cjs')
run('big', 'desk.html', async ({ p, r, ev }) => {
  const res = await ev(async () => {
    const row = (i) => `<div class="r"><es-checkbox label="c${i}"></es-checkbox><es-badge label="b${i}"></es-badge><es-button label="Go ${i}"></es-button></div>`
    const html = Array.from({ length: 1000 }, (_, i) => row(i)).join('')
    const t = []
    for (let k = 0; k < 3; k++) { const t0 = performance.now(); $('#body').html(html); ES.flush(); t.push(Math.round(performance.now() - t0)) }
    const rendered = $('#body es-button > button').length, badges = $('#body es-badge > div').length, cbs = $('#body es-checkbox input').length, emptyBadges = $('#body es-badge').filter((i, x) => !x.textContent.trim()).map((i, x) => i).get().slice(0, 5)
    // latency of one prop change and one new element on a page with 3000 mounted
    const $b = $('#body es-badge').eq(500)
    const t1 = performance.now(); $b.attr('label', 'changed'); ES.flush(); const upd = performance.now() - t1
    const changedText = $b.text().trim()
    const t2 = performance.now(); $('<es-button label="new">').appendTo('#stage'); const add = performance.now() - t2
    const t3 = performance.now(); $('#body').empty(); const clear = performance.now() - t3
    return { refreshMs: t, rendered, badges, cbs, emptyBadges, changed: changedText, updMs: +upd.toFixed(1), addMs: +add.toFixed(1), clearMs: Math.round(clear), stats: ES.stats() }
  })
  r('3000 es-* via one .html() string (x3 refresh), single update and append stay fast', res.rendered === 1000 && res.changed === 'changed' && res.updMs < 20 && res.addMs < 20, res)
})
