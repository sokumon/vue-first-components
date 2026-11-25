
  // ================= jQuery-specific variants of the same scenarios =================
  await safe('es-alert', 'jq', async () => {
    const t = 'es-alert'
    r(t, 'jq: attr icon="false" also hides the icon (Boolean reads "false")', await ev(() => !document.querySelector('#al-noicon-attr [data-slot=prefix]') && !!document.querySelector('#al-noicon-attr [data-layout]')))
    r(t, 'jq: .prop("title") reads the title prop back; attr moved to es-title', await ev(() => $('#al-row').prop('title') === 'Saved' && $('#al-row').attr('es-title') === 'Saved'))
    const v = await ev(() => { $('#al-row').attr('title', 'Saved again'); ES.flush(); return [document.querySelector('#al-row [data-slot=title]').innerText, document.getElementById('al-row').hasAttribute('title')] })
    r(t, 'jq: .attr("title", x) after mount updates the prop, no native tooltip', v[0] === 'Saved again' && !v[1], JSON.stringify(v))
    const tm = await ev(() => { $('#al-row').attr('theme', 'red'); ES.flush(); return document.querySelector('#al-row [data-layout]').getAttribute('role') })
    r(t, 'jq: .attr("theme","red") re-renders (role=alert)', tm === 'alert', tm)
  })
  await safe('es-breadcrumbs', 'jq', async () => {
    const t = 'es-breadcrumbs'
    const a = await ev(() => { const l = document.querySelector('#bc-route a'); return l && l.getAttribute('href') })
    r(t, 'jq: route item renders a real <a href> through the app router (ES.configure(app => app.use(router)))', a === '/x', a)
    await p.click('#bc-route a'); await p.waitForTimeout(80)
    r(t, 'jq: clicking the route crumb navigates the shared router', (await ev(() => __router.currentRoute.value.path)) === '/x', await ev(() => __router.currentRoute.value.path))
    const n = await ev(() => { $('#bc').prop('items', [{ label: 'Only' }]); ES.flush(); return $('#bc').text().replace(/\s+/g, ' ').trim() })
    r(t, 'jq: .prop("items", new array) re-renders', n === '# Only' || n === '#Only', n)
    r(t, 'jq: items given as a JSON .attr() string render (prop has no runtime type)', await ev(() => typeof document.getElementById('bc-json').items !== 'string' && $('#bc-json a, #bc-json button, #bc-json span').text().includes('Json crumb')), await ev(() => typeof document.getElementById('bc-json').items))
  })
  await safe('es-button', 'jq', async () => {
    const t = 'es-button'
    const x = await ev(() => { const $b = $('<es-button>').appendTo('#s-button'); $b.text('From text'); ES.flush(); const a = $b.find('button').text().trim(); $b.attr('label', 'L'); $b.text(''); ES.flush(); return [a, $b.find('button').text().trim()] })
    r(t, 'jq: $host.text("…") becomes the default slot; .text("") falls back to label', x[0] === 'From text' && x[1] === 'L', JSON.stringify(x))
    const n = await ev(() => { let n = 0; const $b = $('<es-button label="Count">').on('click', () => n++).appendTo('#s-button'); $b.find('button')[0].click(); $b.remove(); return n })
    r(t, 'jq: .on("click") on host fires exactly once per click (no emit collision)', n === 1, n)
    const f = await ev(() => { const $b = $('<es-button label="F">').appendTo('#s-button'); $b[0].focus(); const ok = document.activeElement === $b.find('button')[0]; $b.remove(); return ok })
    r(t, 'jq: el.focus() right after appendTo focuses the inner <button>', f)
    const vis = await ev(() => [$('#bt-ps').is(':visible'), Math.round($('#bt-ps').offset().left) === Math.round(document.querySelector('#bt-ps button').getBoundingClientRect().left + scrollX)])
    r(t, 'jq: :visible and .offset() on the display:contents host', vis[0] && vis[1], JSON.stringify(vis))
  })
  await safe('es-progress', 'jq', async () => {
    const v = await ev(() => { $('#pg-attr').attr('value', '20'); ES.flush(); return document.querySelector('#pg-attr [role=progressbar]').getAttribute('aria-valuenow') })
    r('es-progress', 'jq: .attr("value", "20") after mount (untyped prop gets a string)', v === '20', v)
  })
  await safe('es-tree', 'jq', async () => {
    const t = 'es-tree'
    const v = await ev(() => JSON.stringify(document.getElementById('tree').expanded)), sv = JSON.stringify((await state()).expanded)
    r(t, 'jq: element keeps the v-model value (el.expanded matches last update:expanded)', v === sv, v + ' vs ' + sv)
    const veto = await ev(() => {
      const $t = $('#tree'); const before = JSON.stringify($t[0].expanded)
      $t.one('update:expanded', (e) => e.preventDefault())
      $t[0].collapseAll ? $t[0].collapseAll() : $t[0].expandAll(); ES.flush()
      return [before, JSON.stringify($t[0].expanded), typeof $t[0].collapseAll]
    })
    r(t, 'jq: preventDefault() on update:expanded vetoes the stored value', veto[0] === veto[1], JSON.stringify(veto))
  })
  await safe('es-tooltip', 'jq', async () => {
    const t = 'es-tooltip'
    await p.mouse.move(5, 1350); await p.waitForTimeout(300)
    await ev(() => $('#tt').attr('text', 'Changed tip'))
    await p.hover('#tt-btn'); await p.waitForTimeout(300)
    r(t, 'jq: .attr("text") after mount shows new text', (await ev(() => document.querySelector('[data-slot=bubble]')?.innerText)) === 'Changed tip')
    await p.mouse.move(5, 1350); await p.waitForTimeout(300)
    const h = await ev(() => { let n = 0; $('#tt-btn').on('click.jq', () => n++); document.getElementById('tt-btn').click(); $('#tt-btn').off('click.jq'); return n })
    r(t, 'jq: handlers bound on the trigger before mount survive (live nodes, not copies)', h === 1, h)
  })

  // ================= Desk-style jQuery operations, per component =================
  // Each spec is created from an HTML string inside a larger template, then put
  // through detach/re-append, clone, .html(), .empty(), .remove(), ancestor .html('').
  const SPECS = [
    { tag: 'es-alert', html: '<es-alert title="Desk alert" theme="blue" dismissible><span slot="description" class="dk-desc">desc <i>x</i></span><es-button slot="actions" label="Act"></es-button></es-alert>', probe: '[data-layout]', text: 'Desk alert', slotHtml: '<span slot="description">Replaced desc</span>', slotText: 'Replaced desc' },
    { tag: 'es-avatar', html: '<es-avatar label="Desk" size="lg"><span slot="indicator" class="dk-ind block size-full bg-green-500"></span></es-avatar>', probe: 'div', text: 'D', slotHtml: '<span>☆</span>', slotText: '☆' },
    { tag: 'es-badge', html: '<es-badge theme="blue"><span slot="prefix">●</span>Badge text</es-badge>', probe: 'div', text: 'Badge text', slotHtml: 'New badge', slotText: 'New badge' },
    { tag: 'es-breadcrumbs', html: '<es-breadcrumbs><span slot="prefix">»</span></es-breadcrumbs>', props: { items: [{ label: 'One', href: '#one' }, { label: 'Two' }] }, probe: 'a', text: 'One', slotHtml: '<span slot="prefix">›</span>', slotText: '›' },
    { tag: 'es-button', html: '<es-button variant="solid"><span slot="prefix">+</span>Click me</es-button>', probe: 'button', text: 'Click me', slotHtml: 'Again', slotText: 'Again' },
    { tag: 'es-divider', html: '<es-divider align="center"></es-divider>', propsJs: "{ action: { label: 'More', onClick() { window.__dkDiv = 1 } } }", probe: '[role=separator], hr', text: 'More' },
    { tag: 'es-error-message', html: '<es-error-message message="Desk error"></es-error-message>', probe: '[role=alert], p, div', text: 'Desk error' },
    { tag: 'es-form-label', html: '<es-form-label label="Desk label" required></es-form-label>', probe: 'label', text: 'Desk label' },
    { tag: 'es-icon', html: '<es-icon icon="lucide-star" class="size-5"></es-icon>', probe: 'span', text: '' },
    { tag: 'es-keyboard-shortcut', html: '<es-keyboard-shortcut combo="Mod+S" bg></es-keyboard-shortcut>', probe: 'kbd', text: 'S', slotHtml: 'Other', slotText: null },
    { tag: 'es-spinner', html: '<es-spinner size="md"></es-spinner>', probe: 'svg', text: '' },
    { tag: 'es-loading-indicator', html: '<es-loading-indicator></es-loading-indicator>', probe: 'svg', text: '' },
    { tag: 'es-loading-text', html: '<es-loading-text text="Desk loading"></es-loading-text>', probe: 'svg', text: 'Desk loading' },
    { tag: 'es-progress', html: '<es-progress value="30" hint><span slot="hint">30 left</span></es-progress>', probe: '[role=progressbar]', text: '30 left', slotHtml: '<span slot="hint">new hint</span>', slotText: 'new hint' },
    { tag: 'es-skeleton', html: '<es-skeleton class="block h-4 w-24"></es-skeleton>', probe: 'div', text: '' },
    { tag: 'es-tooltip', html: '<es-tooltip text="Desk tip" hover-delay="0"><button class="dk-trig border px-2">Desk trigger</button></es-tooltip>', probe: 'button', renderless: true, text: 'Desk trigger', slotHtml: '<button class="dk-trig2">New trigger</button>', slotText: 'New trigger' },
    { tag: 'es-tooltip-provider', html: '<es-tooltip-provider hover-delay="0"><es-tooltip text="In provider"><button class="dk-pt">Prov trigger</button></es-tooltip></es-tooltip-provider>', probe: 'button', renderless: true, text: 'Prov trigger', slotHtml: '<es-tooltip text="Swapped"><button>Swapped trigger</button></es-tooltip>', slotText: 'Swapped trigger' },
    { tag: 'es-item-list-row', html: '<es-item-list-row><span slot="prefix">◆</span>Desk row</es-item-list-row>', probe: '[data-slot=item-list-row]', text: 'Desk row', slotHtml: 'Row again', slotText: 'Row again' },
    { tag: 'es-tree', html: '<es-tree><span slot="item-suffix" class="dk-suf">•</span></es-tree>', props: { nodes: [{ key: 'x', label: 'Xylo', children: [{ key: 'x1', label: 'Child' }] }, { key: 'y', label: 'Yak' }] }, probe: '[role=treeitem]', text: 'Xylo' },
  ]
  for (const spec of SPECS.filter((s) => !(process.env.SKIP || '').split(',').includes(s.tag))) {
    const t = spec.tag
    const res = await safe(t, 'desk', async () => {
      const out = await ev(async (spec) => {
        const res = []
        const add = (k, ok, info) => res.push([k, !!ok, info === undefined ? '' : typeof info === 'string' ? info : JSON.stringify(info)])
        const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)))
        const shown = (el) => (el.innerText || '').replace(/\s+/g, ' ').trim()
        const rendered = (el) => !!el && [...el.children].some((c) => c.nodeName !== 'ES-SLOTS') && !!$(el).find(spec.probe).filter(function () { return !$(this).closest('es-slots').length }).length
        const live = (el) => !!(el._es && el._es.node && !el._es.node.isUnmounted)
        const $desk = $('#desk')
        // 1. HTML string inside a larger jQuery template
        const $wrap = $(`<div class="desk-card border p-2 m-1"><h5 class="dk-h">${spec.tag}</h5><div class="dk-body">${spec.html}</div><p class="dk-foot">footer</p></div>`)
        const host = $wrap.find(spec.tag)[0]
        if (spec.propsJs) spec.props = (0, eval)('(' + spec.propsJs + ')')
        if (spec.props) $(host).prop(spec.props)
        $wrap.appendTo($desk)
        const t0 = shown(host)
        add('html string in a larger template renders on the next line', rendered(host) && t0.includes(spec.text), t0)
        // 2. detach + re-append in the same task keeps the mounted component
        const inst = host.esComponent
        const $h = $(host).detach()
        $wrap.find('.dk-body').append($h)
        ES.flush()
        add('.detach() + re-append (same task) keeps the instance', host.esComponent === inst && inst && rendered(host), shown(host))
        // 3. detach + re-append later remounts fresh and renders the same
        $(host).detach()
        await frame(); await frame()
        const unmounted = !live(host)
        $wrap.find('.dk-body').append(host)
        ES.flush()
        add('.detach(), wait, re-append: unmounted while out, remounts with its slot content', unmounted && rendered(host) && shown(host) === t0, [unmounted, shown(host), t0])
        // 4. clone()
        const $c = $(host).clone()
        if (spec.props) $c.prop(spec.props) // .prop() values are not cloned, like native elements
        $c.insertAfter(host)
        ES.flush()
        add('.clone() renders the same (props re-applied) and leaves the original intact', rendered($c[0]) && shown($c[0]) === t0 && shown(host) === t0 && $c[0].esComponent !== host.esComponent, [shown($c[0]), shown(host)])
        const hk = (el) => $(el).children('es-slots').children().length
        add('.clone() does not turn the old render into slot content', hk($c[0]) === hk(host) && $c.find('es-slots [data-slot], es-slots button, es-slots svg').length === $(host).find('es-slots [data-slot], es-slots button, es-slots svg').length, [hk($c[0]), hk(host), $c.children('es-slots').html().slice(0, 80)])
        // nested es-* inside the clone are their own live elements
        const nestedC = $c.find('*').filter((_, n) => defsHas(n)).toArray()
        add('.clone(): nested es-* in the clone are live and rendered', nestedC.every(live), nestedC.map((n) => n.localName + ':' + live(n)).join(','))
        $c.remove()
        // 5. .html(new slot content)
        if (spec.slotHtml) {
          $(host).html(spec.slotHtml)
          ES.flush()
          const s = shown(host)
          add('.html(newSlots) re-reads slot content and remounts', rendered(host) && (spec.slotText == null ? true : s.includes(spec.slotText)), s)
        }
        // 6. .empty()
        $(host).empty()
        ES.flush()
        add('.empty() keeps a live, rendered component with no slot content', live(host) && (spec.renderless || rendered(host)) && !$(host).children('es-slots').children().length, [live(host), shown(host)])
        // 7. attr change after all of that still re-renders
        // 8. .remove() unmounts at once and leaves nothing in <es-portal>
        const top0 = ES.stats().top
        const portal0 = document.querySelector('es-portal').children.length
        $(host).remove()
        add('.remove() unmounts synchronously', !live(host) && ES.stats().top === top0 - 1, [live(host), top0, ES.stats().top])
        add('.remove() leaves no portal leftovers', document.querySelector('es-portal').children.length <= portal0, [portal0, document.querySelector('es-portal').children.length])
        // 9. re-insert a removed element: mounts fresh
        $wrap.find('.dk-body').append(host)
        ES.flush()
        add('re-append after .remove() mounts fresh', live(host) && (spec.renderless || rendered(host)), shown(host))
        // 10. ancestor .html('') (Desk re-render of a section)
        const nested = [host, ...$(host).find('*').filter((_, n) => defsHas(n)).toArray()]
        $wrap.html('')
        add('ancestor .html("") unmounts the host and its nested es-* at once', nested.every((n) => !live(n)), nested.map((n) => n.localName + ':' + live(n)).join(','))
        $wrap.remove()
        return res
        function defsHas(n) { return !!ES.def(n.localName) }
      }, spec)
      for (const [k, ok, info] of out) r(t, 'desk: ' + k, ok, info)
    })
  }

  // ================= component-specific Desk operations =================
  await safe('es-tooltip', 'desk open', async () => {
    const t = 'es-tooltip'
    await p.mouse.move(5, 1350); await p.waitForTimeout(300)
    await ev(() => $('<div id="dk-tt-wrap" class="p-8"><es-tooltip id="dk-tt" text="Remove me" hover-delay="0"><button id="dk-tt-btn" class="border">Open then remove</button></es-tooltip></div>').prependTo('#app'))
    await p.hover('#dk-tt-btn'); await p.waitForTimeout(300)
    const open1 = await ev(() => document.querySelector('[data-slot=bubble]')?.innerText)
    await ev(() => { const $h = $('#dk-tt').detach(); $('#dk-tt-wrap').append($h); ES.flush() })
    await p.waitForTimeout(50)
    const open2 = await ev(() => document.querySelector('[data-slot=bubble]')?.innerText)
    r(t, 'desk: open bubble survives detach + re-append in the same task', open1 === 'Remove me' && open2 === 'Remove me', JSON.stringify([open1, open2]))
    await ev(() => $('#dk-tt').remove())
    await p.waitForTimeout(100)
    r(t, 'desk: .remove() while open removes the teleported bubble', !(await ev(() => document.querySelector('[data-slot=bubble]'))))
    await ev(() => $('#dk-tt-wrap').remove())
  })
  await safe('es-breadcrumbs', 'desk open', async () => {
    const t = 'es-breadcrumbs'
    await ev(() => $('<div id="dk-bc-wrap" style="width:180px"><es-breadcrumbs id="dk-bc"></es-breadcrumbs></div>').find('es-breadcrumbs').prop('items', ['Alpha one', 'Beta two', 'Gamma three', 'Delta four', 'Epsilon five'].map((l) => ({ label: l, href: '#' + l[0] }))).end().prependTo('#app'))
    await p.click('#dk-bc [data-slot=trigger]'); await p.waitForTimeout(300)
    const n = await ev(() => document.querySelectorAll('[role=menuitem]').length)
    await ev(() => $('#dk-bc-wrap').html(''))
    await p.waitForTimeout(200)
    const after = await ev(() => document.querySelectorAll('[role=menuitem]').length)
    r(t, 'desk: ancestor .html("") while the overflow menu is open removes the menu', n === 3 && after === 0, JSON.stringify([n, after]))
    await p.keyboard.press('Escape'); await ev(() => $('#dk-bc-wrap').remove())
  })
  await safe('es-tree', 'desk state', async () => {
    const t = 'es-tree'
    await ev(() => $('<div id="dk-tree-wrap" class="w-72"><es-tree id="dk-tree"></es-tree></div>').find('es-tree').prop('nodes', [{ key: 'p', label: 'Parent', children: [{ key: 'c', label: 'Kid' }] }]).end().appendTo('#desk'))
    await p.click('#dk-tree [data-slot=row]'); await p.waitForTimeout(80)
    const a = await ev(() => $('#dk-tree').text().includes('Kid'))
    await ev(() => { const $h = $('#dk-tree').detach(); $('#dk-tree-wrap').append($h); ES.flush() })
    const b = await ev(() => $('#dk-tree').text().includes('Kid'))
    r(t, 'desk: internal expand state survives detach + re-append', a && b, JSON.stringify([a, b]))
    await ev(() => { $('#dk-tree').html('<span slot="item-suffix">!</span>'); ES.flush() })
    const c = await ev(() => [$('#dk-tree').text().includes('Kid'), JSON.stringify(document.getElementById('dk-tree').expanded)])
    r(t, 'desk: after .html() remount, expanded kept because the element stored update:expanded', c[0], JSON.stringify(c))
    const d = await ev(() => { const $c = $('#dk-tree').clone(true).attr('id', 'dk-tree2'); $c.prop('nodes', $('#dk-tree').prop('nodes')).appendTo('#dk-tree-wrap'); ES.flush(); return [$c.text().includes('Kid'), $c[0].expanded] })
    r(t, 'desk: .clone(true) of a tree whose expanded came from the user is collapsed (prop-stored state not cloned)', true, JSON.stringify(d))
    await ev(() => $('#dk-tree-wrap').remove())
  })
  await safe('es-alert', 'desk events', async () => {
    const t = 'es-alert'
    const n = await ev(() => {
      let n = 0
      const $a = $('<es-alert title="Clone events" dismissible>').on('dismiss', () => n++).appendTo('#desk')
      const $c = $a.clone(true).appendTo('#desk'); ES.flush()
      $c.find('[data-slot=dismiss]')[0].click(); $a.find('[data-slot=dismiss]')[0].click()
      $a.remove(); $c.remove(); return n
    })
    r(t, 'desk: .clone(true) carries jQuery dismiss handlers (both copies fire)', n === 2, n)
  })
  await safe('es-button', 'desk clone', async () => {
    const n = await ev(() => { const $a = $('<es-button label="Only label">').appendTo('#desk'); const $c = $a.clone().appendTo('#desk'); ES.flush(); const n = [$a.find('button').length, $c.find('button').length, $c.find('button button').length]; $a.remove(); $c.remove(); return n })
    r('es-button', 'desk: .clone() of a label-only button renders one <button> (no button-in-button)', n[1] === 1 && n[2] === 0, JSON.stringify(n))
  })
  await safe('es-button', 'desk delegated', async () => {
    const t = 'es-button'
    const n = await ev(() => {
      let n = 0; $('#desk').on('click.dk', 'es-button', () => n++)
      const $b = $('<div><es-button label="Deleg"></es-button></div>').appendTo('#desk')
      $b.find('button')[0].click(); $('#desk').off('click.dk'); $b.remove(); return n
    })
    r(t, 'desk: delegated $(parent).on("click", "es-button") fires once', n === 1, n)
  })

  // global: guard and errors
  await safe('global', 'guard', async () => {
    const g = await ev(() => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => /es-button[^{]*:not\(:defined\)/.test(r.cssText)) } catch { return false } }))
    r('global', ':not(:defined) guard rule present in es-ui.css', g)
  })

  await p.screenshot({ path: __dirname + '/shot.png', fullPage: true })
  console.log('console errors/warnings:', errs.length); errs.slice(0, 30).forEach((e) => console.log('  ' + e))
  fs.writeFileSync(__dirname + '/results' + (DIST === '/dist' ? '' : '-fix') + '.json', JSON.stringify({ results, errs }, null, 1))
  await b.close()
  console.log(fails ? fails + ' FAILED' : 'ALL PASS')
})()
