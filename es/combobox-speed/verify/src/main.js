// Independent verify harness (behaviour + bench), driven by check.cjs / bench.cjs through window.V.
import { createApp, defineComponent, h, nextTick, shallowReactive, markRaw, ref, createCommentVNode, Fragment, renderSlot } from 'vue'
import Combobox from 'fui-src/components/Combobox/Combobox.vue'
import Dialog from 'fui-src/components/Dialog/Dialog.vue'
import { portalTargetKey } from 'fui-src/composables/usePortalTarget'
import { ConfigProvider } from 'reka-ui'
import './style.css'

const stage = document.getElementById('stage')
const raf = () => new Promise((r) => requestAnimationFrame(r))
const warnings = []
const WORDS = ['Retail', 'Wholesale', 'Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark', 'Wayne', 'Wonka']
const makeOptions = (n, gen = 0, html = false) => Array.from({ length: n }, (_, i) => ({
  label: `Cust ${i} ${WORDS[(i + gen) % 10]}`, value: `C-${gen}-${i}`, ...(html ? { slot: 'html', key: `C-${gen}-${i}` } : {}),
}))

const BtnComp = defineComponent({ props: { label: String }, setup(props) { return () => h('button', { class: 'v-trigger', type: 'button' }, props.label) } })
// Renders the slot exactly as a compiled template `<slot name="trigger" v-bind="$attrs" />` would
const FwdWrap = defineComponent({ inheritAttrs: false, setup(_, { slots, attrs }) { return () => renderSlot(slots, 'trigger', attrs) } })
const FWD = (p) => renderSlot({ trigger: (q) => [h('button', { class: 'v-trigger', type: 'button' }, 'TR:' + (q.open ? 'open' : 'closed'))] }, 'trigger', p)
const SLOTS = {
  'trigger-renderslot': FWD,
  label: () => h('b', { class: 'v-label' }, 'LBL'),
  description: () => h('i', { class: 'v-desc' }, 'DESC'),
  prefix: () => h('span', { class: 'v-prefix' }, 'P'),
  suffix: () => h('span', { class: 'v-suffix' }, 'S'),
  'suffix-empty': null, // handled below: a #suffix that renders nothing -> fallback chevron
  footer: () => h('div', { class: 'v-footer' }, 'FOOT'),
  'item-prefix': (p) => h('span', { class: 'v-iprefix' }, 'IP:' + (p.item?.label ?? '')),
  'search-prefix': () => h('span', { class: 'v-sprefix' }, 'SP'),
  'item-html': (p) => h('span', { class: 'es-link-html' }, 'H:' + (p.item?.label ?? '')),
  'trigger-multi': (p) => [h('button', { class: 'v-trigger', type: 'button' }, 'TM:' + (p.open ? 'open' : 'closed')), h('span', { class: 'v-trigger-extra' }, 'x')],
  'trigger-comment': (p) => [createCommentVNode('c'), h('button', { class: 'v-trigger', type: 'button' }, 'TC:' + (p.open ? 'open' : 'closed'))],
  'trigger-frag': (p) => [h(Fragment, null, [h('button', { class: 'v-trigger', type: 'button' }, 'TF:' + (p.open ? 'open' : 'closed'))])],
  // a wrapper component forwarding its own #trigger slot, as <slot name="trigger" v-bind="p" /> compiles
  'trigger-fwd': (p) => h(FwdWrap, p, { trigger: (q) => h('button', { class: 'v-trigger', type: 'button' }, 'TW:' + (q.open ? 'open' : 'closed')) }),
  'trigger-comp': (p) => h(BtnComp, { label: 'TK:' + (p.open ? 'open' : 'closed') }),
  trigger: (p) => h('button', { class: 'v-trigger', type: 'button' }, 'T:' + (p.displayValue ?? '') + (p.open ? ' open' : '')),
}

let app = null
let S = []
const events = []

function cellSlots(st) {
  const out = {}
  for (const [k, on] of Object.entries(st.slots || {})) {
    if (!on) continue
    if (k === 'suffix-empty') out.suffix = () => [] // renders nothing
    else if (k.startsWith('trigger-')) out.trigger = SLOTS[k]
    else out[k] = SLOTS[k]
  }
  return out
}

const Cell = defineComponent({
  props: { st: Object, idx: Number },
  setup(props) {
    return () => {
      const st = props.st
      if (st.hidden) return h('div', { class: 'cell' }, 'unmounted')
      const log = (name) => (v) => events.push([props.idx, name, v instanceof Event ? v.type : v && typeof v === 'object' ? (v.value ?? JSON.stringify(v)) : v])
      const p = {
        options: st.options, query: st.query, open: st.open, modelValue: st.modelValue,
        placeholder: st.placeholder, emptyText: st.emptyText, portalTo: st.portalTo,
        ...st.extra,
        'onUpdate:open': (v) => { log('update:open')(v); if (st.controlled) st.open = v },
        'onUpdate:query': (v) => { log('update:query')(v); if (st.controlled) st.query = v },
        'onUpdate:modelValue': (v) => { log('update:modelValue')(v); st.modelValue = v },
        'onUpdate:selectedOption': log('update:selectedOption'),
        onFocus: log('focus'), onBlur: log('blur'),
      }
      if (!st.controlled) { delete p.open; delete p.query; if (st.open === undefined) delete p.open }
      for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k]
      return h('div', { class: 'cell', 'data-cell': props.idx }, [h(Combobox, { ref: 'cb', class: 'w-full', ...p }, cellSlots(st))])
    }
  },
})

function deskState(extra = {}) {
  return shallowReactive({
    controlled: true, options: [], query: '', open: false, modelValue: null,
    placeholder: 'Customer', emptyText: 'No results found', portalTo: undefined,
    extra: { filterable: false, openOnFocus: false, openOnClick: false }, slots: { 'item-html': true }, hidden: false, ...extra,
  })
}
function plainState(extra = {}) {
  return shallowReactive({ controlled: false, options: markRaw(makeOptions(8)), modelValue: null, placeholder: 'Pick', extra: {}, slots: {}, hidden: false, ...extra })
}

const layout = shallowReactive({ dialog: false, dialogOpen: true, config: null, hostTarget: null })
const Root = {
  render() {
    const cells = S.map((st, i) => h(Cell, { key: i, st, idx: i }))
    let tree = h('div', { class: 'space-y-1' }, cells)
    if (layout.dialog) { const inner = tree; tree = h(Dialog, { open: layout.dialogOpen, 'onUpdate:open': (v) => { events.push(['dialog', 'update:open', v]); layout.dialogOpen = v }, title: 'Dlg' }, { default: () => [h('input', { id: 'dlg-input' }), inner] }) }
    if (layout.config) { const inner = tree; tree = h(ConfigProvider, { teleportTo: layout.config }, { default: () => inner }) }
    return tree
  },
}

const V = {
  tag: __TAG__, makeOptions, warnings, events,
  async mount(states, opts = {}) {
    await V.unmount()
    S = states.map((s) => (s.kind === 'plain' ? plainState(s.props) : deskState(s.props)))
    Object.assign(layout, { dialog: false, dialogOpen: true, config: null, hostTarget: null }, opts.layout || {})
    app = createApp(Root)
    app.config.warnHandler = (m) => warnings.push(String(m).slice(0, 200))
    app.config.errorHandler = (e) => { warnings.push('ERROR ' + (e?.message || e)); console.error(e) }
    if (opts.hostTarget) app.provide(portalTargetKey, opts.hostTarget)
    if (opts.beforeMount) opts.beforeMount(S)
    app.mount(stage)
    if (opts.openSync !== undefined) S[opts.openSync].open = true
    await nextTick(); await raf(); await raf()
  },
  async unmount() { if (app) { app.unmount(); app = null; S = [] }; stage.innerHTML = '' ; events.length = 0 },
  // patch state i; values given as JSON-able, with helpers for options
  async set(i, patch) {
    const p = { ...patch }
    if (p.optionsN !== undefined) { p.options = markRaw(makeOptions(p.optionsN, p.gen || 0, p.html)); delete p.optionsN; delete p.gen; delete p.html }
    if (p.slots) p.slots = { ...S[i].slots, ...p.slots }
    if (p.extra) p.extra = { ...S[i].extra, ...p.extra }
    Object.assign(S[i], p)
    await nextTick()
  },
  setLayout(p) { Object.assign(layout, p); return nextTick() },
  // the Combobox exposed instance for cell i
  exposed(i) {
    const all = []
    const collect = (v) => { if (!v || typeof v !== 'object') return; if (v.component) { if (v.component.type.__name === 'Combobox') all.push(v.component); collect(v.component.subTree); return } if (v.suspense) collect(v.suspense.activeBranch); if (Array.isArray(v.children)) v.children.forEach(collect); else if (v.dynamicChildren) v.dynamicChildren.forEach(collect) }
    collect(app._instance.subTree)
    return all[i]?.exposed
  },
  async call(i, method) { V.exposed(i)[method](); await nextTick(); await raf() },
  async tick(n = 2) { await nextTick(); for (let k = 0; k < n; k++) await raf() },
  // aria-controls at the moment Desk's setTimeout(0) runs after an open
  ariaAfterOpenTimeout(i) {
    return new Promise((res) => {
      const input = stage.querySelectorAll('.cell')[i].querySelector('input')
      S[i].portalTo = input.parentElement // Desk sets portalTo in the same flush as open
      S[i].open = true
      const sync = { ctl: input.getAttribute('aria-controls'), exp: input.getAttribute('aria-expanded') }
      queueMicrotask(() => {
        const micro = { ctl: input.getAttribute('aria-controls') }
        nextTick(() => {
          const tick = { ctl: input.getAttribute('aria-controls'), exists: !!document.getElementById(input.getAttribute('aria-controls') || '') }
          setTimeout(() => {
            const id = input.getAttribute('aria-controls') || ''
            const el = document.getElementById(id)
            const chev = stage.querySelectorAll('.cell')[i].querySelector('[data-slot=chevron]')
            const cid = chev?.getAttribute('aria-controls') || ''
            res({ sync: { exp: sync.exp, hasCtl: !!sync.ctl }, tickExists: tick.exists, timeoutExists: !!el, timeoutIsListbox: !!(el && (el.getAttribute('role') === 'listbox' || el.querySelector('[role=listbox]'))), chevronExists: !!document.getElementById(cid), sameId: id === cid, insideParent: !!(el && input.parentElement.contains(el)) })
          }, 0)
        })
      })
    })
  },
  snap() { return snapshot() },
}

const IDREF = ['id', 'for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-activedescendant', 'aria-owns', 'aria-errormessage']
function snapshot() {
  const idMap = new Map()
  const nid = (v) => v.split(/\s+/).filter(Boolean).map((x) => { if (!idMap.has(x)) idMap.set(x, 'ID' + idMap.size); return idMap.get(x) }).join(' ')
  const ser = (el, depth = 0) => {
    if (el.nodeType === 3) { const t = el.textContent.trim(); return t ? JSON.stringify(t) : null }
    if (el.nodeType !== 1) return null
    const attrs = [...el.attributes].filter((a) => a.name !== 'style' && !a.name.startsWith('data-v-')).map((a) => [a.name, IDREF.includes(a.name) ? nid(a.value) : a.value]).sort()
    const kids = [...el.childNodes].map((c) => ser(c, depth + 1)).filter(Boolean)
    return `<${el.tagName.toLowerCase()}${attrs.map(([k, v]) => ` ${k}="${v}"`).join('')}>${kids.length ? '[' + kids.join(',') + ']' : ''}`
  }
  const where = (el) => { const parts = []; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (p.id && !/^(reka|v-)/.test(p.id)) { parts.push('#' + p.id); break } if (p.dataset.cell) { parts.push('cell' + p.dataset.cell); break } if (p.getAttribute('role') === 'dialog') { parts.push('dialog'); break } } return parts.join('>') || 'body' }
  const contents = [...document.querySelectorAll('[data-slot=content]')].map((c) => ({ where: where(c), html: ser(c) }))
  const stageHtml = ser(stage)
  const dialog = document.querySelector('[role=dialog]')
  const dangling = []
  for (const el of document.querySelectorAll('[aria-controls],[aria-activedescendant],[aria-labelledby],[aria-describedby]')) {
    for (const a of ['aria-controls', 'aria-activedescendant', 'aria-labelledby', 'aria-describedby']) {
      const v = el.getAttribute(a); if (v == null) continue
      for (const id of v.split(/\s+/)) if (!id || !document.getElementById(id)) dangling.push(`${el.tagName.toLowerCase()}[data-slot=${el.dataset.slot || ''}] ${a}="${id ? nid(id) : ''}"`)
    }
  }
  const ae = document.activeElement
  const focus = !ae || ae === document.body ? 'body' : `${ae.tagName.toLowerCase()}${ae.id && !/^(reka|v-)/.test(ae.id) && !ae.id.includes('-') ? '#' + ae.id : ''}[slot=${ae.dataset.slot || ''}][role=${ae.getAttribute('role') || ''}] in ${ae.closest('[data-cell]') ? 'cell' + ae.closest('[data-cell]').dataset.cell : ae.closest('[data-slot=content]') ? 'content' : ae.closest('[role=dialog]') ? 'dialog' : 'other'}`
  const geom = [...document.querySelectorAll('[data-reka-popper-content-wrapper]')].map((w) => { const r = w.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)] })
  return { geom, stage: stageHtml, contents, dialog: dialog ? ser(dialog).length + ':' + (dialog.querySelectorAll('[data-slot=content]').length) : null, dangling, focus, events: events.splice(0), warnings: warnings.splice(0), bodyElems: document.body.children.length }
}

// ------------------------------------------------------------------ bench
const BenchCell = defineComponent({
  props: { st: Object },
  setup(props) {
    const slots = { 'item-html': () => h('span', { class: 'es-link-html' }) }
    return () => { const st = props.st; return h('div', { class: 'cell' }, [h(Combobox, {
      class: 'w-full', options: st.options, modelValue: st.modelValue, query: st.query, open: st.open, filterable: false, openOnFocus: false, openOnClick: false,
      placeholder: st.placeholder, emptyText: 'No results found', portalTo: st.portalTo,
      'onUpdate:open': (v) => (st.open = v), 'onUpdate:query': (v) => (st.query = v),
    }, slots)]) }
  },
})
let bapp = null, bS = []
async function timed(fn) { const t0 = performance.now(); fn(); const t1 = performance.now(); await nextTick(); const t2 = performance.now(); await raf(); await raf(); return { sync: t1 - t0, js: t2 - t0, painted: performance.now() - t0 } }
V.bench = {
  async mount(n, nOpt = 0) {
    await V.bench.unmount()
    bS = Array.from({ length: n }, () => shallowReactive({ options: nOpt ? markRaw(makeOptions(nOpt)) : [], modelValue: null, query: '', open: false, placeholder: 'Customer', portalTo: undefined }))
    return timed(() => { bapp = createApp({ render: () => h('div', bS.map((st, i) => h(BenchCell, { key: i, st }))) }); bapp.mount(stage) })
  },
  async unmount() { if (bapp) { const a = bapp; bapp = null; await timed(() => a.unmount()); stage.innerHTML = '' } },
  async setAll(prop, kind) { let g = 0; return timed(() => bS.forEach((st, i) => { st[prop] = kind === 'opts20' ? markRaw(makeOptions(20, ++g)) : kind === 'query' ? 'q' + i + Math.random() : 'Ph ' + Math.random() })) },
  async open(i = 0) { return timed(() => { const input = stage.querySelectorAll('.cell')[i].querySelector('input'); bS[i].portalTo = input.parentElement; bS[i].options = markRaw(makeOptions(20)); bS[i].open = true }) },
  async close(i = 0) { return timed(() => { bS[i].open = false }) },
  dom() { let n = 0; const w = document.createTreeWalker(stage, NodeFilter.SHOW_ALL); while (w.nextNode()) n++; return n },
}
window.V = V
window.__ready = true
