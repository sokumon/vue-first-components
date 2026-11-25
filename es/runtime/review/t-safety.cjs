// Does user data in {{ }}, attributes, JSON or slot text ever execute?
const { run } = require('./lib.cjs')
run('safety', 'base.html', async ({ p, r, ev, errs }) => {
  const fresh = async () => { await p.reload(); await p.waitForFunction(() => window.ES && window.jQuery) }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const X = `{{ constructor.constructor('window.PWN=1')() }} <img src=x onerror="window.PWN=2"> \${window.PWN=3}`
  await fresh()
  const a = await ev(async ([X, Xe]) => {
    window.PWN = 0
    const tpl = `<div class="row">
      <es-button label="${Xe}"></es-button>
      <es-badge label="${Xe}">${Xe}</es-badge>
      <es-tooltip text="${Xe}"><span>hover</span></es-tooltip>
      <es-alert title="${Xe}" description="${Xe}"></es-alert>
      <es-error-message message="${Xe}"></es-error-message>
      <es-select options='${JSON.stringify([{ label: X, value: 'a' }]).replace(/'/g, '&#39;').replace(/</g,'\\u003c')}'></es-select>
      <es-tabs><template slot="tab-panel"><b data-es-text="tab.label"></b></template></es-tabs>
    </div>`
    $('#stage').html(tpl)
    $('#stage es-tabs').prop('tabs', [{ label: X }])
    $('<es-text-input>').attr('placeholder', X).prop('modelValue', X).appendTo('#stage')
    $('<es-dropdown>').prop('button', { label: X }).prop('options', [{ label: X, onClick() {} }]).appendTo('#stage')
    ES.flush(); await new Promise((r) => setTimeout(r, 300))
    const html = $('#stage').html()
    return { PWN: window.PWN, imgs: $('#stage img').length, mustache49: /\b49\b/.test(html), rawTpl: html.includes('{{ constructor') }
  }, [X, esc(X)])
  r('user text in attrs / slots / JSON / props never executes, {{ }} stays literal', a.PWN === 0 && a.rawTpl, a)

  await fresh()
  const b = await ev(async () => {
    window.HIT = 0
    // Vue-ish attributes inside a jQuery template: on-click, v-on:click, :label are strings, not code
    let err = null
    try {
      $('#stage').html(`<es-button label="A" on-click="window.HIT++" v-on:click="window.HIT++" :label="window.HIT++"></es-button>`)
      ES.flush()
    } catch (e) { err = e.message }
    $('#stage button').each((i, x) => x.click())
    await new Promise((r) => setTimeout(r, 50))
    return { HIT: window.HIT, err, n: $('#stage button').length }
  })
  r('on-click / v-on:click / :label attribute text is never compiled or run', b.HIT === 0, b)

  await fresh()
  const c = await ev(async () => {
    window.HIT = 0
    // An inline onclick on a host (page-authored) is copied to the component root too: does it run twice?
    $('#stage').html(`<es-button label="Once" onclick="window.HIT++"></es-button>`); ES.flush()
    $('#stage button')[0].click()
    return { HIT: window.HIT, rootHasOnclick: $('#stage button').attr('onclick') }
  })
  r('host onclick attribute runs once per click (not copied to inner root)', c.HIT === 1, c)

  await fresh()
  const d = await ev(async () => {
    window.PWN = 0
    // es-fw-notification-item renders title/description with v-html (component relies on backend sanitising)
    $('<es-fw-notification-item>').prop('notification', { name: 'n1', title: '<img src=x onerror="window.PWN=9">', description: 'd', read: 0, creation: '2024-01-01' })
      .attr('title', '<img src=x onerror="window.PWN=8">').appendTo('#stage')
    $('<es-fw-html-field>').prop('field', { fieldname: 'h', fieldtype: 'HTML', options: '<img src=x onerror="window.PWN=7">' }).appendTo('#stage')
    ES.flush(); await new Promise((r) => setTimeout(r, 400))
    return { PWN: window.PWN, imgs: $('#stage img').length, props: [...ES.def('es-fw-notification-item').props.keys()] }
  })
  r('INFO component v-html sinks reachable from jQuery data (NotificationItem title/description)', true, d)

  const e = await ev(() => {
    const src = [...document.scripts].find((s) => s.src.includes('es-ui')).src
    return fetch(src).then((r) => r.text()).then((t) => ({ compiler: /compileToFunction|Runtime compilation is not supported|baseCompile/.test(t), newFunction: (t.match(/new Function\(/g) || []).length, evalCalls: (t.match(/\beval\(/g) || []).length }))
  })
  r('INFO iife bundle carries Vue template compiler / new Function (CSP unsafe-eval); no page string is compiled', true, e)
})
