// In-page side of the Combobox bench. run.cjs drives it through window.B.
import { createApp, defineComponent, h, nextTick, shallowReactive, markRaw } from 'vue'
import Combobox from 'fui-src/components/Combobox/Combobox.vue'
import MiniInput from './MiniInput.vue'
import './style.css'

const stage = document.getElementById('stage')
const raf = () => new Promise((r) => requestAnimationFrame(r))
const raf2 = async () => { await raf(); await raf() }

// ---------------------------------------------------------------- reactivity counters (MODE=count)
const fxLog = []
let fxOn = false // in MODE=count: on from each mount until the next mount (so opening is counted too)
globalThis.__fx = (kind, scope) => { if (fxOn) fxLog.push([kind, scope]) }

// ---------------------------------------------------------------- data
const WORDS = ['Retail', 'Wholesale', 'Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark Ind', 'Wayne Ent', 'Wonka']
export function makeOptions(n, gen = 0) {
  return Array.from({ length: n }, (_, i) => ({
    label: `Customer ${String(i).padStart(4, '0')} ${WORDS[(i + gen) % WORDS.length]}`,
    value: `CUST-${gen}-${i}`,
    description: i % 3 ? null : 'Retail customer',
  }))
}

// Desk variant B props (wc/three-ways/B-es-tags/desk/es_link.bundle.js make_input)
function deskItem(extra = {}) {
  return shallowReactive({
    options: [], modelValue: null, query: '', open: false, filterable: false,
    openOnFocus: false, openOnClick: false, placeholder: 'Customer', emptyText: 'No results found',
    portalTo: undefined, ...extra,
  })
}

// One Cell per control so an update to one control's props re-renders only that cell, as the
// es-* runtime does per host.
const Cell = defineComponent({
  name: 'BenchCell',
  props: { item: Object, kind: String },
  setup(props) {
    const slots = { 'item-html': () => h('span', { class: 'es-link-html' }) }
    return () => {
      const it = props.item
      if (props.kind === 'mini') {
        return h('div', { class: 'cell' }, [h(MiniInput, {
          modelValue: it.modelValue, query: it.query, placeholder: it.placeholder, options: it.options, open: it.open,
          'onUpdate:query': (v) => (it.query = v),
        })])
      }
      return h('div', { class: 'cell' }, [h(Combobox, {
        class: 'w-full es-link-input',
        options: it.options, modelValue: it.modelValue, query: it.query, open: it.open,
        filterable: it.filterable, openOnFocus: it.openOnFocus, openOnClick: it.openOnClick,
        placeholder: it.placeholder, emptyText: it.emptyText, portalTo: it.portalTo,
        'onUpdate:open': (v) => (it.open = v),
        'onUpdate:query': (v) => (it.query = v),
        'onUpdate:modelValue': (v) => (it.modelValue = v),
      }, slots)])
    }
  },
})

// MODE=count|dev: which components re-render, and (dev only) what triggered it
const updates = { updated: {}, triggers: {} }
const updateSpy = {
  updated() { const n = nameOf(this.$); updates.updated[n] = (updates.updated[n] || 0) + 1 },
  renderTriggered(e) {
    const n = nameOf(this.$)
    const t = e.target && (e.target.__v_isRef ? 'ref' : Array.isArray(e.target) ? 'array' : 'object')
    const keys = e.target && !e.target.__v_isRef && typeof e.target === 'object' ? Object.keys(e.target).slice(0, 6).join(',') : ''
    const k = `${n} <- ${e.type} ${t}.${String(e.key)}${keys ? ' {' + keys + '}' : ''}`
    updates.triggers[k] = (updates.triggers[k] || 0) + 1
  },
}

const devEntries = []
if (__MODE__ === 'dev') new PerformanceObserver((l) => devEntries.push(...l.getEntries().map((e) => ({ name: e.name, startTime: e.startTime, duration: e.duration })))).observe({ entryTypes: ['measure'] })

let app = null
let items = []
let rawHost = null

async function timed(fn) {
  const t0 = performance.now()
  fn()
  const t1 = performance.now()
  await nextTick()
  const t2 = performance.now()
  await raf2()
  const t3 = performance.now()
  return { sync: t1 - t0, tick: t2 - t0, painted: t3 - t0 }
}

const B = {
  fui: __FUI__, fuiPath: __FUI_PATH__, mode: __MODE__,
  makeOptions,
  // kind: 'combobox' | 'mini' | 'input'; opts: { options: n, filterable }
  async mount(kind, n, opts = {}) {
    await B.unmount()
    const nOpt = opts.options || 0
    if (kind === 'input') {
      return timed(() => {
        rawHost = document.createElement('div')
        for (let i = 0; i < n; i++) {
          const d = document.createElement('div'); d.className = 'cell'
          const inp = document.createElement('input')
          inp.className = 'form-input w-full'; inp.placeholder = 'Customer'; inp.autocomplete = 'off'
          d.appendChild(inp); rawHost.appendChild(d)
        }
        stage.appendChild(rawHost)
      })
    }
    items = Array.from({ length: n }, () => deskItem({
      options: nOpt ? markRaw(makeOptions(nOpt)) : [],
      filterable: opts.filterable ?? false,
      ...(opts.props || {}),
    }))
    const Root = { render: () => h('div', { class: 'space-y-1' }, items.map((it, i) => h(Cell, { key: i, item: it, kind }))) }
    if (B.mode === 'count') { fxLog.length = 0; fxOn = true }
    const r = await timed(() => {
      app = createApp(Root)
      if (B.mode === 'dev') app.config.performance = true
      if (B.mode === 'count' || B.mode === 'dev') app.mixin(updateSpy)
      app.mount(stage)
    })
    return r
  },
  async unmount() {
    if (rawHost) {
      const r = await timed(() => { rawHost.remove(); rawHost = null })
      return r
    }
    if (!app) return null
    const a = app
    app = null
    const r = await timed(() => a.unmount())
    items = []
    stage.innerHTML = ''
    return r
  },
  // set a prop on all (or the first k) items in one tick
  async setAll(prop, valueFn, k = items.length) {
    return timed(() => { for (let i = 0; i < k; i++) items[i][prop] = valueFn(i) })
  },
  async open(i = 0, extra = {}) {
    return timed(() => { Object.assign(items[i], extra); items[i].open = true })
  },
  async close(i = 0) { return timed(() => { items[i].open = false }) },
  // per-keystroke typing into control i's own <input>
  async type(text, i = 0) {
    const input = stage.querySelectorAll('.cell')[i].querySelector('input')
    input.focus()
    const out = []
    for (let c = 1; c <= text.length; c++) {
      const t0 = performance.now()
      input.value = text.slice(0, c)
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text[c - 1], inputType: 'insertText' }))
      const t1 = performance.now()
      await nextTick()
      const tt = performance.now()
      await raf2()
      const t2 = performance.now()
      out.push({ ch: text.slice(0, c), sync: t1 - t0, tick: tt - t0, painted: t2 - t0, rows: document.querySelectorAll('[role=option]').length })
    }
    return out
  },
  takeUpdates() { const u = JSON.parse(JSON.stringify(updates)); updates.updated = {}; updates.triggers = {}; return u },
  optionRows: () => document.querySelectorAll('[role=option]').length,
  // ------------------------------------------------------------ counting
  instanceTree(cellIndex = 0) {
    const cellVNode = stage._vnode.component.subTree.children[cellIndex]
    const out = []
    walkInst(cellVNode.component, 0, out)
    return out
  },
  counts(cellIndex = 0) {
    const tree = B.instanceTree(cellIndex)
    const scopeToNode = new Map(tree.map((n) => [n.scope, n]))
    const per = {}
    for (const n of tree) n.fx = {}
    const totals = {}
    const ownerOf = (scope) => {
      for (let s = scope; s; s = s.parent) if (scopeToNode.has(s)) return scopeToNode.get(s)
      return null
    }
    const instScopes = new Set(tree.map((n) => n.scope))
    let unowned = {}
    if (B.mode === 'count') {
      // attribute only creations belonging to this cell's subtree; plus global per-control average
      for (const [kind, scope] of fxLog) {
        totals[kind] = (totals[kind] || 0) + 1
        const owner = ownerOf(scope)
        if (owner) {
          if (kind === 'scope' && instScopes.has(scope) && owner.scope === scope) { owner.fx.instScope = 1; continue }
          owner.fx[kind] = (owner.fx[kind] || 0) + 1
        }
      }
    }
    const cellEl = stage.querySelector('.space-y-1').children[cellIndex]
    const dom = countDom(cellEl)
    const rows = tree.map(({ scope, ...rest }) => rest)
    return { tree: rows, totalsAllCells: totals, n: items.length, dom, docNodes: countDom(document.body) }
  },
  // MODE=dev: Vue's app.config.performance measures, per component name. init = setup(), render =
  // render fn calls (mount + updates), mountSelf = 'mount' minus the child mounts nested inside it.
  devMeasures() {
    const es = devEntries.splice(0).sort((a, b) => a.startTime - b.startTime || b.duration - a.duration)
    const agg = {}
    const get = (k) => (agg[k] ||= { mounts: 0, init: 0, render: 0, renders: 0, mountIncl: 0, mountSelf: 0 })
    const stack = []
    for (const e of es) {
      const m = /^<(.+?)> (\w+)$/.exec(e.name)
      if (!m) continue
      const a = get(m[1])
      if (m[2] === 'init') a.init += e.duration
      if (m[2] === 'render') { a.render += e.duration; a.renders++ }
      if (m[2] !== 'mount') continue
      a.mounts++; a.mountIncl += e.duration; a.mountSelf += e.duration
      const end = e.startTime + e.duration
      while (stack.length && stack[stack.length - 1].end <= e.startTime) stack.pop()
      if (stack.length) stack[stack.length - 1].a.mountSelf -= e.duration
      stack.push({ end, a })
    }
    return agg
  },
}

function nameOf(inst) {
  const t = inst.type
  return t.__name || t.name || (t.render ? 'anon' : 'anon')
}
function walkInst(inst, depth, out) {
  out.push({ name: nameOf(inst), depth, scope: inst.scope })
  walkVNode(inst.subTree, depth + 1, out)
}
function walkVNode(v, depth, out) {
  if (!v || typeof v !== 'object') return
  if (v.component) return walkInst(v.component, depth, out)
  if (v.suspense) return walkVNode(v.suspense.activeBranch, depth, out)
  if (Array.isArray(v.children)) for (const c of v.children) walkVNode(c, depth, out)
}
function countDom(root) {
  if (!root) return null
  let all = 0, el = 0, text = 0, comment = 0
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
  let n = w.currentNode
  while (n) {
    all++
    if (n.nodeType === 1) el++
    else if (n.nodeType === 3) text++
    else if (n.nodeType === 8) comment++
    n = w.nextNode()
  }
  return { all, el, text, comment }
}

window.B = B
window.__benchReady = true
