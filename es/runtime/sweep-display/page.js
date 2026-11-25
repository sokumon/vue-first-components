// Display-group sweep page, driven by jQuery only (no Vue templates, no petite-vue).
// It rebuilds every scenario of wc/sweep/display/index.html with jQuery calls.
/* global $, ES */
window.S = { log: [], who: 'Ada', showAlert: true, dismissed: 0, pct: 40, err: 'Name is required', expanded: ['a'], dragged: null, events: [] }
const showState = () => $('#state').text(JSON.stringify({ who: S.who, dismissed: S.dismissed, pct: S.pct, expanded: S.expanded, showAlert: S.showAlert, dragged: S.dragged, log: S.log }))

// Desk would do this once, before rendering: hand the one app a router.
const router = ES.VueRouter.createRouter({ history: ES.VueRouter.createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] })
ES.configure((app) => app.use(router))
window.__router = router

$(function () {
  const $app = $('#app')
  const sec = (id, cls) => $('<section>').attr('id', id).addClass(cls || '').appendTo($app)
  // "who" interpolation in slot content: jQuery updates its own nodes (inside handed-out nodes, jQuery owns the DOM)
  const setWho = (w) => { S.who = w; $('.who').text(w); showState() }

  // ===== es-alert =====
  const $al = sec('s-alert', 'space-y-2')
  $('<es-alert id="al-row" title="Saved" theme="green">').appendTo($al)
  $('<es-alert id="al-banner" title="Sync failed" description="The server did not answer." theme="red" dismissible>')
    .prop({
      primaryAction: { label: 'Retry', onClick(ctx) { window.__primary = (window.__primary || 0) + 1; ctx.dismiss() } },
      secondaryAction: { label: 'Later', onClick() { window.__secondary = 1 } },
    })
    .on('dismiss', function () { S.showAlert = false; S.dismissed++; $(this).remove(); showState() })
    .appendTo($al)
  $(`<es-alert id="al-slots" theme="amber" dismissible>
      <b slot="title" id="al-slot-title">Hello <span class="who">Ada</span></b>
      <span slot="description" id="al-slot-desc">Description for <span class="who">Ada</span></span>
      <span slot="prefix" id="al-slot-prefix">P</span>
      <es-button slot="actions" id="al-slot-action" label="Rename"></es-button>
    </es-alert>`).on('dismiss', () => { S.dismissed++; showState() }).appendTo($al)
  $('#al-slot-action').on('click', () => setWho('Grace'))
  $('<es-alert id="al-noicon" title="No icon">').prop('icon', false).appendTo($al)
  $('<es-alert id="al-noicon-attr" title="No icon (attr)" icon="false">').appendTo($al)

  // ===== es-avatar =====
  const $av = sec('s-avatar', 'flex gap-2 items-center')
  $av.append(
    '<es-avatar id="av-label" label="Ada Lovelace" size="xl" theme="blue"></es-avatar>' +
    '<es-avatar id="av-broken" label="Zed" image="data:image/png;base64,broken"></es-avatar>' +
    `<es-avatar id="av-img" label="Img" image="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect width='10' height='10' fill='red'/%3E%3C/svg%3E"></es-avatar>` +
    '<es-avatar id="av-slots" label="Q" size="2xl"><span id="av-default">★</span><span slot="indicator" id="av-ind" class="block size-full rounded-full bg-green-500"></span></es-avatar>' +
    '<es-avatar id="av-class" label="Big" class="size-16"></es-avatar>')

  // ===== es-badge =====
  const $bd = sec('s-badge', 'flex gap-2')
  $('<es-badge id="bd-label" label="Draft" theme="orange">').appendTo($bd)
  $('<es-badge id="bd-num" theme="blue" variant="solid" size="lg">').prop('label', 42).appendTo($bd)
  $('<es-badge id="bd-slots" theme="green">').append('<span slot="prefix" id="bd-pre">●</span>', 'Live ', '<span class="who">Ada</span>', '<span slot="suffix" id="bd-suf">→</span>').appendTo($bd)

  // ===== es-breadcrumbs =====
  const $bc = sec('s-crumbs')
  $('<es-breadcrumbs id="bc"><span slot="prefix" class="bc-pre">#</span></es-breadcrumbs>').prop('items', [
    { label: 'Home', href: '#home' },
    { label: 'Projects', href: '#projects', onClick() { window.__crumb = 'Projects' } },
    { label: 'Website', onClick() { window.__crumb = 'Website' } },
  ]).appendTo($bc)
  $('<div style="width:180px" class="border">').append($('<es-breadcrumbs id="bc-many">').prop('items',
    ['Alpha one', 'Beta two', 'Gamma three', 'Delta four', 'Epsilon five'].map((l, i) => ({ label: l, href: '#' + 'abcde'[i] })))).appendTo($bc)
  $('<es-breadcrumbs id="bc-route">').prop('items', [{ label: 'Routed', route: '/x' }, { label: 'Leaf' }]).appendTo($bc)
  $('<es-breadcrumbs id="bc-json">').attr('items', JSON.stringify([{ label: 'Json crumb', href: '#j' }, { label: 'Leaf' }])).appendTo($bc)

  // ===== es-button =====
  const $bt = sec('s-button', 'flex gap-2 items-center')
  $bt.append(
    '<es-button id="bt-ps" variant="outline"><span slot="prefix" id="bt-pre">[P]</span>Middle<span slot="suffix" id="bt-suf">[S]</span></es-button>',
    '<es-button id="bt-icon" icon="lucide-x" aria-label="Close"></es-button>',
    '<es-button id="bt-slot-icon"><span class="lucide-star"></span></es-button>',
    '<es-button id="bt-icon-slot"><span slot="icon" class="lucide-star size-4"></span></es-button>',
    '<es-button id="bt-tip" label="Hover me" tooltip="Button tip"></es-button>')
  $('<es-button id="bt-dis" label="Disabled">').attr('disabled', true).on('click', () => { S.log.push('disabled-click'); showState() }).appendTo($bt)
  $bt.append('<es-button id="bt-href" label="Link" href="https://example.com/x"></es-button>',
    '<es-button id="bt-lt" label="Save" loading loading-text="Saving..."></es-button>',
    '<form id="frm"><es-button id="bt-submit" type="submit" label="Submit"></es-button></form>')
  $('#frm').on('submit', (e) => { e.preventDefault(); window.__submitted = (window.__submitted || 0) + 1 })

  // ===== es-divider =====
  const $dv = sec('s-divider', 'space-y-2')
  $dv.append('<es-divider id="dv-h"></es-divider>',
    '<div class="flex h-10 items-center gap-2"><span>L</span><es-divider id="dv-v" orientation="vertical" flex-item></es-divider><span>R</span></div>')
  $('<es-divider id="dv-act" align="start">').prop('action', { label: 'Load more', onClick() { window.__divider = (window.__divider || 0) + 1 } }).appendTo($dv)

  // ===== es-error-message =====
  const $em = sec('s-error')
  $('<es-error-message id="em-str">').attr('message', S.err).appendTo($em)
  $('<es-error-message id="em-arr">').prop('message', ['First problem', 'Second problem']).appendTo($em)
  $('<es-error-message id="em-xss">').attr('message', '<b>bold</b><img src=x onerror="window.__xss=1">').appendTo($em)
  $('<es-error-message id="em-empty" message="">').appendTo($em)
  $('<es-button id="em-clear" label="Clear error">').on('click', () => { S.err = ''; $('#em-str').attr('message', '') }).appendTo($em)

  // ===== es-form-label =====
  const $fl = sec('s-label')
  $fl.append('<es-form-label id="fl" label="Email" required></es-form-label>',
    '<es-form-label data-t="fl2" label="Phone" es-id="phone-input"></es-form-label>',
    '<input id="phone-input" class="border">')

  // ===== es-icon =====
  sec('s-icon', 'flex gap-2').append(
    '<es-icon id="ic-lucide" icon="lucide-star" class="size-6"></es-icon>',
    '<es-icon id="ic-emoji" icon="🔥"></es-icon>',
    '<es-icon id="ic-name" name="lucide-x"></es-icon>',
    '<es-icon id="ic-bad" icon="star"></es-icon>')

  // ===== es-keyboard-shortcut =====
  const $kb = sec('s-kbd', 'flex gap-4')
  $kb.append('<es-keyboard-shortcut id="kb-plain" combo="Mod+K"></es-keyboard-shortcut>',
    '<es-keyboard-shortcut id="kb-bg" combo="Mod+Shift+Enter" bg></es-keyboard-shortcut>')
  $('<es-keyboard-shortcut id="kb-alt" combo="Ctrl+K" show-plus>').prop('altCombos', ['Ctrl+J', 'Alt+K']).appendTo($kb)
  $kb.append('<es-keyboard-shortcut id="kb-slot">Fallback <span class="who">Ada</span></es-keyboard-shortcut>')

  // ===== spinners / loading =====
  sec('s-spin', 'flex gap-4 items-center').append(
    '<es-spinner id="sp-lg" size="lg" theme="red" track></es-spinner>',
    '<es-spinner id="sp-def"></es-spinner>',
    '<es-loading-indicator id="li" size="xs"></es-loading-indicator>',
    '<es-loading-text id="lt-def"></es-loading-text>',
    '<es-loading-text id="lt" text="Fetching rows"></es-loading-text>')

  // ===== es-progress =====
  const $pg = sec('s-progress', 'w-64 space-y-3')
  $('<es-progress id="pg" label="Upload" hint size="lg">').prop('value', S.pct).appendTo($pg)
  $('<es-progress id="pg-slot" hint>').prop('value', S.pct).append('<span slot="hint" id="pg-hint"><span class="pct">40</span> of 100</span>').appendTo($pg)
  $('<es-progress id="pg-int" size="md">').prop({ value: 50, intervals: 4 }).appendTo($pg)
  $('<es-progress id="pg-attr" value="75">').appendTo($pg)
  $('<es-button id="pg-inc" label="+20">').on('click', () => {
    S.pct = Math.min(100, S.pct + 20)
    $('#pg, #pg-slot').prop('value', S.pct); $('.pct').text(S.pct); showState()
  }).appendTo($pg)

  // ===== es-skeleton =====
  sec('s-skel').append('<es-skeleton id="sk" class="block h-4 w-32"></es-skeleton>')

  // ===== es-tooltip / provider =====
  sec('s-tip', 'flex gap-6 p-8').append(
    '<es-tooltip id="tt" text="Plain tip" hover-delay="0"><button id="tt-btn" class="border px-2">Hover A</button></es-tooltip>',
    '<es-tooltip id="tt-slot" hover-delay="0" side="bottom"><button id="tt-slot-btn" class="border px-2">Hover B</button><span slot="content" id="tt-content">Rich tip for <span class="who">Ada</span></span></es-tooltip>',
    '<es-tooltip id="tt-dis" text="Never" disabled hover-delay="0"><button id="tt-dis-btn" class="border px-2">Hover C</button></es-tooltip>',
    '<es-tooltip id="tt-es" text="On es-button" hover-delay="0"><es-button id="tt-es-btn" label="Hover D"></es-button></es-tooltip>',
    `<es-tooltip-provider id="tp" hover-delay="0">
      <es-tooltip id="tp-a" text="Group tip A"><button id="tp-a-btn" class="border px-2">Group A</button></es-tooltip>
      <es-tooltip id="tp-b" text="Group tip B"><button id="tp-b-btn" class="border px-2">Group B</button></es-tooltip>
    </es-tooltip-provider>`)

  // ===== es-item-list-row =====
  const $ir = sec('s-row', 'w-64')
  $ir.append('<es-item-list-row id="ir" size="md"><span slot="prefix" id="ir-pre">◆</span>Row <span class="who">Ada</span><span slot="suffix" id="ir-suf">3</span></es-item-list-row>',
    '<es-item-list-row id="ir-active" active><span slot="label" id="ir-label">Label slot</span></es-item-list-row>')
  $('<es-item-list-row id="ir-btn" as="button">Clickable</es-item-list-row>').on('click', () => { S.log.push('row-click'); showState() }).appendTo($ir)
  $ir.append('<es-item-list-row id="ir-dis" disabled>Disabled row</es-item-list-row>')

  // ===== es-tree =====
  const $tr = sec('s-tree', 'w-72')
  $('<es-tree id="tree" draggable><span slot="item-suffix" class="tree-suf">•</span></es-tree>')
    .prop({
      nodes: [
        { key: 'a', label: 'Apples', children: [{ key: 'a1', label: 'Fuji' }, { key: 'a2', label: 'Gala' }] },
        { key: 'b', label: 'Bananas', children: [{ key: 'b1', label: 'Cavendish' }] },
        { key: 'c', label: 'Cherries' },
      ],
      expanded: S.expanded,
    })
    .on('update:expanded', (e) => { S.expanded = e.originalEvent.detail; showState() })
    .on('drag-end', (e) => { const d = e.originalEvent.detail; S.dragged = d && (d.node.key + ':' + d.position + ':' + d.to); showState() })
    .appendTo($tr)
  $('<es-tree id="tree-empty"><span slot="empty" id="tree-empty-msg">Nothing here, <span class="who">Ada</span></span></es-tree>').prop('nodes', []).appendTo($tr)

  showState()
  window.__built = true
})
