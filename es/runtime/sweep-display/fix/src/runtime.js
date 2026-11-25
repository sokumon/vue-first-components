// es-* runtime for jQuery-driven pages: every <es-*> element on the page is
// rendered by ONE Vue app.
//
//   createApp(Root)  ── mounted once into <es-app> (end of <body>)
//   Root ── Bucket × ⌈n/64⌉ ── <Teleport :to="host" :key> ── EsNode(entry) ── <Component …props …listeners>{ slots }
//                                                                              └ slot fn → EsSlotOutlet → <es-slot>
//                                                                                   (moves the host's light-DOM nodes in;
//                                                                                    renders <Teleport :to="nestedHost"> for
//                                                                                    every es-* element in those nodes)
//
// A nested es-* element (inside another element's slot content) is rendered
// from the outlet that renders that slot, so it is a real child of the parent
// component: provide/inject, useId, app plugins and devtools see one tree.
//
// Public Vue API only, plus three internals, each checked at start-up
// (verifyInternals) so a Vue upgrade that moves them fails loudly:
//   instance.update()            run a component's render now (sync mount on connect)
//   teleportVNode.targetStart/targetAnchor   the anchors Teleport puts in the host,
//                                 used to tell Vue's nodes from nodes jQuery put there
//   publicInstance.$             component instance behind a ref (for `exposed`)
// and one public trick: render(h('i'), spare) flushes Vue's post-flush queue synchronously.
import {
  createApp, render, defineComponent, h, Teleport, shallowReactive, shallowRef, markRaw,
  getCurrentInstance, withDirectives, camelize, capitalize, nextTick, toRaw, Fragment,
} from 'vue'

const hyphenate = (s) => s.replace(/\B([A-Z])/g, '-$1').toLowerCase()
const BUCKET = 16
const OVERRIDABLE = new Set(['focus', 'blur']) // exposed methods allowed to shadow HTMLElement's
const defs = new Map() // tag -> def
const esEvents = new WeakSet() // CustomEvents this runtime dispatched
let seq = 0, busy = 0, moving = 0
let app = null, rootInst = null, appEl = null, portalEl = null
const rootExtras = [] // components rendered once at the root (Toasts, Dialogs)
const configureFns = []
const dirty = new Set()
const dirtyOutlets = new Set() // outlets whose slot content grew (their props do not change)

// ---------------------------------------------------------------- definitions
const typesOf = (o) => {
  const t = o && typeof o === 'object' && !Array.isArray(o) ? o.type : o
  return t == null || t === true ? [] : Array.isArray(t) ? t : [t]
}
function makeDef(tag, comp) {
  const props = new Map()
  const raw = comp.props
  if (Array.isArray(raw)) raw.forEach((k) => props.set(camelize(k), { types: [] }))
  else if (raw) for (const k in raw) props.set(camelize(k), { types: typesOf(raw[k]) })
  const emits = Array.isArray(comp.emits) ? comp.emits : comp.emits ? Object.keys(comp.emits) : []
  const names = [] // [property name, prop] incl. hyphenated aliases
  for (const k of props.keys()) for (const n of new Set([k, hyphenate(k)])) names.push([n, k])
  return { tag, comp: markRaw(comp), props, names, emits: [...new Set(emits)] }
}

function convert(v, types, name) {
  if (types.includes(Boolean)) {
    if (v === '' || v === 'true' || v === name || v === hyphenate(name)) return true
    if (v === 'false') return false
  }
  // FIX(sweep-display): props declared only through TypeScript types reach
  // the runtime untyped; a JSON array/object attribute is parsed for them.
  if (!types.length && /^\s*[[{]/.test(v)) { try { const j = JSON.parse(v); if (j && typeof j === 'object') return j } catch {} }
  if (types.includes(String) || !types.length) return v
  if (types.includes(Number) && v.trim() !== '' && !isNaN(+v)) return +v
  if ((types.includes(Object) || types.includes(Array)) && /^\s*[[{]/.test(v)) {
    try { return JSON.parse(v) } catch {}
  }
  return v
}

// ---------------------------------------------------------------- entries
// One entry per host element: the state its EsNode renders from.
function entryOf(el) {
  if (el._es) return el._es
  const def = defs.get(el.localName)
  if (!def) return null
  const e = (el._es = markRaw({
    id: ++seq, ver: 0, host: el, def,
    props: shallowReactive({}), attrs: shallowReactive({}), src: {},
    slots: null, holder: null, tick: shallowRef(0),
    owner: null, node: null, tv: null, inner: null, exposed: new Set(), killed: false,
  }))
  for (const a of [...el.attributes]) applyAttr(e, a.name, true)
  // properties set before the element upgraded shadow the prototype accessors
  for (const [n, k] of def.names)
    if (Object.prototype.hasOwnProperty.call(el, n)) { const v = el[n]; delete el[n]; e.props[k] = v; e.src[k] = 'prop' }
  e.listeners = {}
  for (const name of def.emits) e.listeners['on' + capitalize(camelize(name))] = (...args) => emitOut(e, name, args)
  // A native event that shares an emit's name (change, click, input…) stops
  // at the host, so .on(name) sees only the component's event. Added before
  // any jQuery handler, so stopImmediatePropagation reaches those too.
  for (const name of def.emits) if (!name.includes(':'))
    el.addEventListener(name, (ev) => { if (!esEvents.has(ev)) ev.stopImmediatePropagation() })
  mo.observe(el, { attributes: true, childList: true })
  return e
}

function applyAttr(e, name, initial) {
  const el = e.host, def = e.def
  if (name === 'id' || name === 'slot') return
  let v = el.getAttribute(name)
  if (name === 'es-id' && def.props.has('id')) return setFromAttr(e, 'id', v)
  if (def.props.has('title') && (name === 'title' || name === 'es-title')) {
    // A `title` prop must not leave a native tooltip on the host: the attribute
    // moves to es-title (kept, so .clone() carries it). Read it with .prop('title').
    if (name === 'title') {
      if (v == null) return
      el.setAttribute('es-title', v)
      el.removeAttribute('title')
    }
    return setFromAttr(e, 'title', el.getAttribute('es-title'))
  }
  const k = camelize(name)
  if (def.props.has(k)) return setFromAttr(e, k, v)
  if (v == null) delete e.attrs[name]
  else e.attrs[name] = v
  if (!initial) dirty.add(e)
}
function setFromAttr(e, k, v) {
  if (v == null) { if (e.src[k] === 'attr') { delete e.props[k]; delete e.src[k] } }
  else { e.props[k] = convert(v, e.def.props.get(k).types, k); e.src[k] = 'attr' }
  dirty.add(e)
}

function emitOut(e, name, args) {
  const detail = args.length <= 1 ? args[0] : args
  let ok = true
  for (const n of new Set([name, hyphenate(name)])) {
    const ev = new CustomEvent(n, { detail, bubbles: true, cancelable: true })
    esEvents.add(ev)
    ok = e.host.dispatchEvent(ev) && ok
  }
  // v-model: the element keeps the value the component asked for, like an
  // <input>. A listener can veto it with e.preventDefault().
  if (ok && name.startsWith('update:')) {
    const k = camelize(name.slice(7))
    if (e.def.props.has(k)) { e.props[k] = args[0]; e.src[k] = 'prop' }
  }
}

// ---------------------------------------------------------------- slots
// <es-slots hidden>: slot content not rendered right now (closed dialog body)
// waits here, inside the host, so $('#id') still finds it. Made on demand.
function holderOf(e) {
  if (!e.holder) { e.holder = document.createElement('es-slots'); e.holder.hidden = true }
  if (e.holder.parentNode !== e.host) {
    moving++
    try { e.host.prepend(e.holder) } finally { moving-- }
  }
  return e.holder
}
const pending = (e, n) => !!e.holder && n.parentNode === e.holder
// Light-DOM children become slot content. A clone of a rendered element
// carries a copy of the holder plus stale render output: the holder copy and
// what its outlets showed are the content, the rest is dropped.
function takeSlots(e) {
  const el = e.host
  const kids = [...el.childNodes]
  const old = kids.find((n) => n.nodeName === 'ES-SLOTS')
  let content = kids
  if (old) {
    content = [...old.childNodes]
    const seen = new Set()
    for (const s of el.querySelectorAll('es-slot[data-es-name]:not([data-es-stamp])')) {
      let inner = false
      for (let p = s.parentElement; p && p !== el; p = p.parentElement) if (p.localName === 'es-slot' || p === old) { inner = true; break }
      if (inner || seen.has(s.dataset.esName)) continue
      seen.add(s.dataset.esName)
      content.push(...s.childNodes)
    }
    kids.forEach((n) => n.remove())
  }
  e.slots = shallowReactive({})
  moving++
  try {
    addContent(e, content, false)
    // FIX(sweep-display): always leave the (possibly empty) holder in the host,
    // so a .clone() of a host with no slot content is recognised as a clone and
    // its stale render is dropped instead of becoming default-slot content.
    holderOf(e)
  } finally { moving-- }
}
function addContent(e, nodes, prepend) {
  const list = prepend ? [...nodes].reverse() : nodes
  for (const n of list) {
    if ((n.nodeType === 3 && !n.data.trim()) || n.nodeType === 8) { n.remove(); continue }
    if (n.nodeType !== 1 && n.nodeType !== 3) continue
    const name = (n.nodeType === 1 && n.getAttribute('slot')) || 'default'
    const g = e.slots[name] || (e.slots[name] = shallowReactive([]))
    prepend ? g.unshift(n) : g.push(n)
    const o = owners.get(toRaw(g))
    if (o) dirtyOutlets.add(o)
    holderOf(e).appendChild(n)
  }
}

// ---------------------------------------------------------------- host mutations
// jQuery writes into a host (.html/.text/.empty/.append/.prepend). Vue's own
// nodes sit between the Teleport anchors; anything outside them is new slot
// content. If the anchors are gone (.html/.text/.empty), what is left is the
// new slot content and the component is mounted afresh.
function onChildList(e) {
  const el = e.host
  if (!e.slots) return
  const start = e.tv && e.tv.targetStart, end = e.tv && e.tv.targetAnchor
  const rendered = e.node && start
  if (rendered && (start.parentNode !== el || end.parentNode !== el)) {
    moving++
    try {
      const holderKept = !!e.holder && e.holder.parentNode === el
      const rest = [...el.childNodes].filter((n) => n !== e.holder && n !== start && n !== end)
      if (!holderKept) { e.slots = shallowReactive({}); e.holder = null }
      // Vue's surviving nodes would otherwise be read as content
      const vueNodes = new Set()
      if (e.node.subTree) collectVue(e.node.subTree, vueNodes)
      addContent(e, rest.filter((n) => !vueNodes.has(n)), false)
      // FIX(sweep-display): Vue unmounts a Fragment root (renderless components
      // such as TooltipProvider) by walking nextSibling from its start to its
      // end anchor. jQuery took those nodes out, so the walk hit null and the
      // crash left the whole app unable to render. Put the old render back
      // between the Teleport anchors, in order, so Vue can unmount it cleanly.
      const old = []
      orderedVue(e.node.subTree, old)
      el.append(start, ...old.filter((n) => n && n !== start && n !== end), end)
    } finally { moving-- }
    remount(e)
    return
  }
  moving++
  try {
    const before = [], after = []
    let state = rendered ? 0 : 2 // 0 before start, 1 inside, 2 after end
    for (const n of [...el.childNodes]) {
      if (n === e.holder) continue
      if (rendered && n === start) { state = 1; continue }
      if (rendered && n === end) { state = 2; continue }
      if (state === 0) before.push(n)
      else if (state === 2) after.push(n)
    }
    if (!before.length && !after.length) return
    addContent(e, before, true)
    addContent(e, after, false)
    dirty.add(e)
  } finally { moving-- }
}
function orderedVue(v, out) {
  if (!v || typeof v !== 'object') return
  if (v.component) return orderedVue(v.component.subTree, out)
  if (v.type === Fragment) {
    out.push(v.el)
    if (Array.isArray(v.children)) v.children.forEach((c) => orderedVue(c, out))
    out.push(v.anchor)
    return
  }
  if (v.type === Teleport) { out.push(v.el, v.anchor); return }
  if (v.el) out.push(v.el)
}
function collectVue(vnode, out) {
  if (!vnode) return
  if (vnode.el) out.add(vnode.el)
  if (vnode.anchor) out.add(vnode.anchor)
  if (vnode.component) return collectVue(vnode.component.subTree, out)
  if (Array.isArray(vnode.children)) vnode.children.forEach((c) => c && typeof c === 'object' && collectVue(c, out))
}
function remount(e) {
  e.ver++
  const o = e.owner
  if (o) o.refresh()
}

// One observer for every host (attributes + direct children).
const mo = new MutationObserver(processRecords)
function processRecords(recs) {
  const lists = new Set()
  for (const r of recs) {
    const e = r.target._es
    if (!e) continue
    if (r.type === 'attributes') applyAttr(e, r.attributeName)
    else lists.add(e)
  }
  lists.forEach(onChildList)
  flushDirty()
}
function drain() {
  const recs = mo.takeRecords()
  if (recs.length) processRecords(recs)
}

// ---------------------------------------------------------------- rendering
let batching = null // Set of instances to update when ES.batch() returns
function syncUpdate(inst) {
  if (!inst || inst.isUnmounted) return
  if (batching) { batching.add(inst); return }
  if (busy) { queueMicrotask(() => syncUpdate(inst)); return }
  busy++
  try { inst.update() } finally { busy-- }
  // Template refs, onMounted/onUpdated hooks and post watchers wait in Vue's
  // post-flush queue. The public render() flushes that queue when it returns
  // (all of it when it patches an existing tree), so re-rendering a spare <i>
  // runs them now: right after .appendTo(), el.focus() and exposed members
  // that read template refs work.
  if (!busy) render(spareVNode(), spareEl)
}
const spareEl = document.createElement('div')
const spareVNode = () => h('i')
function flushDirty() {
  if (dirty.size) {
    const list = [...dirty]
    dirty.clear()
    for (const e of list) if (e.node) syncUpdate(e.node)
  }
  if (dirtyOutlets.size) {
    const list = [...dirtyOutlets]
    dirtyOutlets.clear()
    for (const o of list) if (o.alive) syncUpdate(o.inst)
  }
}

function teleportFor(e, owner) {
  if (!e.slots) takeSlots(e) // before Teleport puts its anchors in the host
  const v = h(Teleport, { to: e.host, key: e.id + ':' + e.ver }, [h(EsNode, { entry: e, owner, onVnodeBeforeUnmount: nodeGone })])
  e.tv = v
  return v
}

function nodeGone(vnode) {
  const e = vnode.props.entry
  if (e.node === vnode.component) { e.node = null; e.owner = null; e.inner = null }
}
const EsNode = defineComponent({
  name: 'EsNode',
  props: { entry: Object, owner: Object },
  setup(p) {
    const e = p.entry
    const inst = getCurrentInstance()
    e.node = inst
    e.owner = p.owner
    e.killed = false
    const setRef = (v) => { if (v && e.node === inst) exposeOnHost(e, v) }
    return () => {
      e.tick.value
      dirty.delete(e)
      const slots = {}
      for (const name in e.slots) if (e.slots[name].length)
        slots[name] = (scope) => [h(EsSlotOutlet, { entry: e, name, scope, group: e.slots[name] })]
      return h(e.def.comp, { ...e.attrs, ...e.props, ...e.listeners, ref: setRef }, slots)
    }
  },
})

function exposeOnHost(e, pub) {
  e.inner = pub
  const inst = pub.$
  const keys = inst && inst.exposed ? Object.keys(inst.exposed) : []
  for (const k of keys) {
    if (e.exposed.has(k) || k[0] === '$' || k[0] === '_' || e.def.props.has(k)) continue
    if (k in e.host && !OVERRIDABLE.has(k)) continue
    e.exposed.add(k)
    Object.defineProperty(e.host, k, {
      configurable: true,
      get() {
        const v = e.inner && e.inner[k]
        return typeof v === 'function' ? (...a) => { ES.flush(); return e.inner[k](...a) } : v
      },
    })
  }
}

// Slot outlet. The first outlet of a slot shows the live nodes (jQuery
// handlers and data intact); a slot rendered more than once at the same time
// gets deep clones in the later outlets. A slot whose content is one
// <template> is stamped per call (per row / per item), with the slot props
// bound into [data-es-text] and announced by an `es-slot` event.
const owners = new WeakMap() // raw group -> outlet state
const EsSlotOutlet = defineComponent({
  name: 'EsSlotOutlet',
  props: { entry: Object, name: String, scope: null, group: Object },
  setup(p) {
    const e = p.entry, group = p.group, raw = toRaw(group)
    const inst = getCurrentInstance()
    const tick = shallowRef(0)
    const st = markRaw({
      inst, el: null, e, group, owner: false, mine: null, tpl: null, alive: true,
      refresh() { if (st.alive) { tick.value++; syncUpdate(inst) } },
    })
    if (group.length === 1 && group[0].nodeName === 'TEMPLATE') {
      st.tpl = group[0]
      st.mine = [...st.tpl.content.cloneNode(true).childNodes].filter((n) => n.nodeType === 1 || (n.nodeType === 3 && n.data.trim()))
    } else if (!owners.get(raw)) { owners.set(raw, st); st.owner = true; st.mine = group }
    else st.mine = group.map((n) => n.cloneNode(true))
    return () => {
      tick.value
      if (st.owner) group.length // appended content re-renders this outlet
      const nested = scanNested(st)
      const kids = nested.map((ne) => teleportFor(ne, st))
      const props = { 'data-es-name': p.name }
      if (st.tpl) props['data-es-stamp'] = ''
      return withDirectives(h('es-slot', props, kids), [[vPlace, st]])
    }
  },
})

// es-* elements in an outlet's nodes that belong to it (not to a deeper es-*).
function scanNested(st) {
  const out = []
  const nodes = st.el ? [...st.el.childNodes, ...(st.owner ? st.group.filter((n) => pending(st.e, n)) : [])] : st.mine
  const visit = (n) => {
    if (n.nodeType !== 1) return
    if (defs.has(n.localName)) {
      const ne = entryOf(n)
      if (ne.owner && ne.owner !== st && ne.owner.alive !== false && ne.node) {
        // still rendered by its previous owner: let that one drop it first
        const old = ne.owner
        queueMicrotask(() => { old.refresh(); st.refresh() })
        return
      }
      out.push(ne)
      return
    }
    if (n.localName === 'template' || n.localName === 'es-slots') return
    for (const c of n.children) visit(c)
  }
  nodes.forEach(visit)
  return out
}

function applyScope(st) {
  const scope = st.inst.props.scope || {}
  for (const n of st.mine) if (n.nodeType === 1) {
    for (const t of [n, ...n.querySelectorAll('[data-es-text]')]) {
      const path = t.getAttribute && t.getAttribute('data-es-text')
      if (!path) continue
      const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), scope)
      t.textContent = v == null ? '' : String(v)
    }
  }
}
function announce(st, update) {
  const ev = new CustomEvent('es-slot', {
    detail: { name: st.inst.props.name, scope: st.inst.props.scope, el: st.el, nodes: st.mine, update },
  })
  esEvents.add(ev)
  st.e.host.dispatchEvent(ev)
}

const vPlace = {
  beforeMount(el, { value: st }) {
    st.el = el
    el._esOutlet = st
    moving++
    try {
      for (const n of st.mine) if (!st.owner || pending(st.e, n) || !n.parentNode) el.appendChild(n)
    } finally { moving-- }
    if (st.tpl) { applyScope(st); announce(st, false) }
  },
  beforeUpdate(el, { value: st }) {
    if (st.tpl) { applyScope(st); announce(st, true); return }
    if (!st.owner) return
    moving++
    try {
      let next = null
      for (let i = st.group.length - 1; i >= 0; i--) {
        const n = st.group[i]
        if (pending(st.e, n)) el.insertBefore(n, next && next.parentNode === el ? next : null)
        if (n.parentNode === el) next = n
      }
    } finally { moving-- }
  },
  beforeUnmount(el, { value: st }) {
    st.alive = false
    if (!st.owner) return
    owners.delete(toRaw(st.group))
    const current = st.e.slots && st.e.slots[st.inst.props.name] === st.group
    if (!current) return
    moving++
    try { st.group.forEach((n) => n.parentNode === el && holderOf(st.e).appendChild(n)) } finally { moving-- }
  },
}

// Top-level elements live in a two-level tree (root -> groups of 16 buckets ->
// buckets of 16), so adding or removing one re-renders one bucket of <=16 Teleports.
const groups = shallowReactive([])
const open = new Set() // buckets with room
const Bucket = defineComponent({
  name: 'EsBucket',
  props: { b: Object },
  setup(p) {
    const b = p.b
    b.inst = getCurrentInstance()
    b.alive = true
    return () => b.list.map((e) => teleportFor(e, b))
  },
})
const Group = defineComponent({
  name: 'EsGroup',
  props: { g: Object },
  setup(p) {
    p.g.inst = getCurrentInstance()
    return () => p.g.list.map((b) => h(Bucket, { key: b.id, b }))
  },
})
function addTop(e) {
  let b = open.values().next().value
  if (!b) {
    b = markRaw({ id: ++seq, list: shallowReactive([]), inst: null, top: true, alive: false })
    b.refresh = () => syncUpdate(b.inst)
    let g = groups[groups.length - 1]
    if (!g || g.list.length >= BUCKET) { g = markRaw({ id: ++seq, list: shallowReactive([]), inst: null }); groups.push(g) }
    g.list.push(b)
    b.group = g
    open.add(b)
  }
  b.list.push(e)
  if (b.list.length >= BUCKET) open.delete(b)
  e.owner = b // claimed now; EsNode confirms
  syncUpdate(b.inst || b.group.inst || rootInst)
}
function removeTop(e, b) {
  const i = b.list.indexOf(e)
  if (i < 0) return
  b.list.splice(i, 1)
  open.add(b)
  syncUpdate(b.inst)
}

const Root = defineComponent({
  name: 'EsRoot',
  setup() {
    return () => [...rootExtras.map((c, i) => h(c, { key: 'x' + i })), ...groups.map((g) => h(Group, { key: g.id, g }))]
  },
})

function ensureApp() {
  if (app) return
  appEl = document.createElement('es-app')
  portalEl = document.createElement('es-portal')
  document.body.append(appEl, portalEl)
  if (!document.querySelector('style[data-es-ui-base]')) {
    // hosts render as their content; the sheets carry the same rules (plus the :not(:defined) guard)
    const st = document.createElement('style')
    st.setAttribute('data-es-ui-base', '')
    st.textContent = `:where(${[...defs.keys()].join(',')}){display:contents}es-app,es-portal,es-slot{display:contents}es-slots{display:none!important}`
    document.head.appendChild(st)
  }
  app = createApp(Root)
  app.config.idPrefix = 'es'
  for (const fn of configureFns) fn(app, ES)
  render(spareVNode(), spareEl)
  rootInst = app.mount(appEl).$
  verifyInternals()
}
function verifyInternals() {
  if (typeof rootInst.update !== 'function') throw new Error('es-ui: Vue internal instance.update() missing (Vue ' + app.version + ')')
  const probe = document.createElement('div')
  const v = h(Teleport, { to: probe }, [h('i')])
  const r = createApp({ render: () => v }).mount(document.createElement('div'))
  const ok = v.targetStart && v.targetStart.parentNode === probe && v.targetAnchor && r.$ && r.$.vnode
  r.$.appContext.app.unmount()
  if (!ok) throw new Error('es-ui: Teleport targetStart/targetAnchor or public instance `$` moved (Vue ' + app.version + ')')
}

// ---------------------------------------------------------------- connect / disconnect
function ownerOf(host) {
  for (let n = host.parentNode; n; n = n.parentNode) {
    if (n.nodeType === 9) return 'top'
    if (n.nodeType !== 1) return null
    const ln = n.localName
    if (ln === 'es-slot') return n._esOutlet || 'wait'
    if (ln === 'es-slots' || defs.has(ln)) return 'wait'
  }
  return null
}

let parsing = null
function onConnect(host) {
  const e = entryOf(host)
  if (!e) return
  hookJquery()
  if (document.readyState === 'loading') {
    if (!parsing) {
      parsing = new Set()
      document.addEventListener('DOMContentLoaded', () => { const l = parsing; parsing = null; ES.batch(() => l.forEach((x) => x.isConnected && onConnect(x))) }, { once: true })
    }
    parsing.add(host)
    return
  }
  ensureApp()
  disc.delete(e)
  if (moving) return
  drain() // attributes set before insertion ($('<es-x>').attr(...)) are still queued records
  const o = ownerOf(host)
  if (o === 'top') {
    if (e.owner && !e.owner.top) { const old = e.owner; old.refresh() }
    if (!e.owner) addTop(e)
  } else if (o && o !== 'wait') {
    if (e.owner !== o) {
      if (e.owner && e.owner.top) removeTop(e, e.owner)
      else if (e.owner) e.owner.refresh()
      o.refresh()
    }
  } else if (o === 'wait' && e.owner && e.owner.top) removeTop(e, e.owner)
}

// Removal unmounts after the frame (so .detach() + re-append keeps state);
// jQuery's .remove()/.empty()/.html() (they run $.cleanData) unmount at once.
const disc = new Set()
let discQueued = false
function onDisconnect(host) {
  const e = host._es
  if (!e || moving) return
  if (e.killed) return finalize(e)
  disc.add(e)
  if (discQueued) return
  discQueued = true
  const run = () => {
    discQueued = false
    const l = [...disc]
    disc.clear()
    l.forEach((x) => { if (!x.host.isConnected) finalize(x) })
  }
  if (document.hidden) setTimeout(run, 100)
  else requestAnimationFrame(() => setTimeout(run))
}
function finalize(e) {
  disc.delete(e)
  const o = e.owner
  if (!o) return
  if (o.top) removeTop(e, o)
  else if (o.alive) o.refresh()
}
let hooked = false
function hookJquery() {
  const $ = window.jQuery
  if (hooked || !$ || !$.cleanData) return
  hooked = true
  const orig = $.cleanData
  $.cleanData = function (elems) {
    for (let i = 0, el; (el = elems[i]) != null; i++) if (el._es) el._es.killed = true
    return orig.apply(this, arguments)
  }
}

// ---------------------------------------------------------------- element classes
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"]),[contenteditable=""],[contenteditable=true]'
function unionRect(self, base) {
  const rs = [...self.children].filter((c) => c.nodeName !== 'ES-SLOTS').map((c) => c.getBoundingClientRect()).filter((r) => r.width || r.height)
  if (!rs.length) return base.call(self)
  const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top))
  return new DOMRect(l, t, Math.max(...rs.map((r) => r.right)) - l, Math.max(...rs.map((r) => r.bottom)) - t)
}
const baseRect = Element.prototype.getBoundingClientRect
const baseRects = Element.prototype.getClientRects

// Hosts are display:contents, so they answer for their content's box and
// focus (jQuery's :visible, .offset(), floating-ui anchors, .focus()).
export class EsElement extends HTMLElement {
  constructor() { super(); entryOf(this) }
  connectedCallback() { onConnect(this) }
  disconnectedCallback() { onDisconnect(this) }
  getBoundingClientRect() { return unionRect(this, baseRect) }
  getClientRects() {
    const r = this.getBoundingClientRect()
    return r.width || r.height ? [r] : baseRects.call(this)
  }
  focus(o) {
    for (const t of this.querySelectorAll(FOCUSABLE)) if (!t.closest('es-slots')) return t.focus(o)
  }
  get esComponent() { return this._es && this._es.inner }
}

// <es-slot> is display:contents too; reka `as-child` triggers merge onto it,
// so it measures, focuses and mirrors aria-*/role/data-state onto its content,
// and re-dispatches focus/blur (which do not bubble) from focusin/focusout.
const MIRROR = /^(aria-|role$|data-state$)/
class EsSlotElement extends HTMLElement {
  _esTarget() {
    for (const e of this.querySelectorAll(FOCUSABLE)) if (!e.closest('es-slots')) return e
    return null
  }
  getBoundingClientRect() { return unionRect(this, baseRect) }
  getClientRects() { return [this.getBoundingClientRect()] }
  focus(o) { const t = this._esTarget(); t ? t.focus(o) : super.focus(o) }
  connectedCallback() {
    if (!this._esFocus) {
      this._esFocus = true
      const relay = (type) => (e) => {
        if (e.target === this || this.contains(e.relatedTarget)) return
        this.dispatchEvent(new FocusEvent(type, { relatedTarget: e.relatedTarget }))
      }
      this.addEventListener('focusin', relay('focus'))
      this.addEventListener('focusout', relay('blur'))
    }
    if (this._esOb || ![...this.attributes].some((a) => MIRROR.test(a.name))) return
    this._esMirrored = new Set()
    this._esOb = new MutationObserver(() => this._esSync())
    this._esOb.observe(this, { attributes: true, childList: true, subtree: true })
    this._esSync()
  }
  disconnectedCallback() { this._esOb && this._esOb.disconnect(); this._esOb = null }
  _esSync() {
    const t = this._esTarget()
    if (!t) return
    if (t !== this._esLast) { this._esMirrored.clear(); this._esLast = t }
    for (const a of this.attributes) if (MIRROR.test(a.name) && t.getAttribute(a.name) !== a.value) { t.setAttribute(a.name, a.value); this._esMirrored.add(a.name) }
    for (const n of this._esMirrored) if (!this.hasAttribute(n)) { t.removeAttribute(n); this._esMirrored.delete(n) }
  }
}

const isMethod = (k) => {
  for (let p = HTMLElement.prototype; p; p = Object.getPrototypeOf(p)) {
    const d = Object.getOwnPropertyDescriptor(p, k)
    if (d) return typeof d.value === 'function'
  }
  return false
}

export function defineEs(tag, comp) {
  if (customElements.get(tag)) return false
  const def = makeDef(tag, comp)
  defs.set(tag, def)
  class C extends EsElement {}
  for (const k of def.props.keys()) {
    if (k === 'id' || k === 'slot' || isMethod(k)) continue
    for (const n of new Set([k, hyphenate(k)])) {
      Object.defineProperty(C.prototype, n, {
        configurable: true,
        get() { drain(); return this._es ? this._es.props[k] : undefined },
        set(v) {
          const e = entryOf(this)
          e.props[k] = v
          e.src[k] = 'prop'
          dirty.add(e)
        },
      })
    }
  }
  customElements.define(tag, C)
  return true
}

// ---------------------------------------------------------------- public API
export const ES = {
  version: null,
  defineEs,
  get app() { return app },
  get portal() { ensureAppIfReady(); return portalEl },
  tags: () => [...defs.keys()],
  def: (tag) => defs.get(tag),
  /** Run fn(app, ES) on the one app: now if it exists, else when it is created. */
  configure(fn) { configureFns.push(fn); if (app) fn(app, ES) },
  /** Render a component once at the root (toast/dialog hosts). */
  addRoot(comp) { rootExtras.push(markRaw(comp)); if (rootInst) syncUpdate(rootInst) },
  /** Run fn with rendering held back, then render everything it connected in one pass (still before batch returns). */
  batch(fn) {
    if (batching) return fn()
    const set = (batching = new Set())
    try { return fn() } finally {
      batching = null
      drain()
      // parents first: a group or root render mounts its new buckets with their lists
      const order = [rootInst, ...groups.map((g) => g.inst), ...[...set]]
      const done = new Set()
      for (const i of order) if (i && set.has(i) && !done.has(i)) { done.add(i); syncUpdate(i) }
      for (const i of set) if (!done.has(i)) syncUpdate(i)
    }
  },
  /** Apply pending attribute/prop/children changes and render them now. */
  flush() { drain(); flushDirty() },
  /** Resolves after Vue's next flush (post-mount hooks, watchers). */
  tick: () => { ES.flush(); return nextTick() },
  stats: () => { let top = 0, buckets = 0; for (const g of groups) for (const b of g.list) { buckets++; top += b.list.length } return { groups: groups.length, buckets, top } },
}
function ensureAppIfReady() { if (!app && document.body) ensureApp() }

// Pending prop/attribute changes render in one batch in a microtask (like
// Vue's own scheduler), or at once on ES.flush().
const origAdd = dirty.add.bind(dirty)
let soon = false
dirty.add = (e) => {
  if (!soon) { soon = true; queueMicrotask(() => { soon = false; drain(); flushDirty() }) }
  return origAdd(e)
}

if (!customElements.get('es-slot')) customElements.define('es-slot', EsSlotElement)
