// defineEs(Component) -> a custom element class that behaves like the Vue
// component used from a template: real slots, no directive leakage.
//
// Fixes over Vue's defineCustomElement(comp, { shadowRoot: false }):
//  1. Slots are real slot *functions*. Vue's light-DOM mode moves children into
//     <slot> outlets after render, so `slots.default` / `$slots.x` stay empty
//     and every render-function component (Button, Dialog title checks...)
//     drops the content. Here each light-DOM child group becomes a slot fn that
//     renders an <es-slot style="display:contents"> and moves the same nodes in.
//  2. Slot nodes that are not rendered (closed Dialog) wait in a hidden
//     <es-slots> holder inside the host, so a host-page binder (petite-vue,
//     Alpine, jQuery) sees and binds them. runtime-dom's app.mount() clears the
//     container (`container.textContent = ''`), which used to drop the holder
//     before the binder walked it, so it is put back after every mount.
//  3. The element's root is a thin wrapper, not the component. Vue's
//     renderSlot() turns every <slot> of a custom element's *root* component
//     into a native <slot> tag (runtime-core renderSlot, `currentRenderingInstance.ce`),
//     which ignores slot functions. One level down, the component renders its
//     slots normally.
//  4. The wrapper forwards only the props the host actually set (attribute or
//     property), not every declared prop. It declares the component's props
//     *without defaults*: a default on the CE root is reflected back into
//     `ce._props` (runtime-core resolvePropValue -> `instance.ce._setProp`),
//     and Boolean props are cast to `false`. Forwarding those made every
//     `defineModel('open', { default: false })` look controlled
//     (prop present + onUpdate:open listener) so Select/Dropdown never opened.
//  5. Multi-word props get hyphenated property aliases (`el['model-value']`).
//     petite-vue sets `:model-value` as a property only when `key in el`;
//     otherwise it calls setAttribute and the component gets the string
//     "false" / "0" (truthy) instead of false / 0.
//  6. The element mounts at once (so Vue defines its prop accessors and
//     petite-vue's `key in el` sets real properties), but the wrapper renders
//     the component only after the binder has consumed its directive attributes
//     (petite-vue removes `:x`/`@x` after binding) and the document has
//     finished loading (DOMContentLoaded, where host binders mount), so slot
//     content is bound before Vue can move it anywhere (e.g. a Teleport).
//  7. Template-directive attributes (@x, :x, v-*, #x) are never read as props;
//     the host binder owns them. `id`, `class`, `style` stay on the host.
//  8. Removing the element unmounts its Vue app (Vue's disconnectedCallback,
//     on nextTick); teleported content goes with it.
// [sweep/framework-ui experimental fixes, on top of the baseline above]
//  F1. Exposed methods reach the element: Vue's CE copies `instance.exposed`
//      keys onto the host once, at mount, from the *wrapper*, whose expose was
//      an empty Proxy, so el.scrollToLatest / el.reload / el.fitView were
//      undefined. The inner component's exposed keys are defined on the host
//      after each inner mount.
//  F2. Emits fired synchronously while the host binder sets a prop (inside
//      _setProp -> _update -> pre-flush watchers) are re-dispatched in a
//      microtask. petite-vue 0.4.1's flushJobs() drops a job re-queued while
//      it is flushing (`queue.includes(job)` is still true), so state set by
//      such an event never re-rendered.
//  F3. Native events whose name a component declares as an emit (click,
//      change, input, ...) no longer reach listeners registered on the host:
//      a Vue parent's `@click` on a component that declares `click` gets only
//      the component event. Ancestors still see the native event.
//  F4. Scoped / repeated slots: `<template slot="cell">` is cloned per slot
//      invocation and handed with its slot props to a page binder hook,
//      `window.EsBindSlot(el, slotProps) -> { update(props)?, unmount()? }`
//      (petite: reactive scope + createApp(scope).mount(el), update = Object.assign).
//  F5. Only events the host actually listens for get a listener on the inner
//      component (tracked via addEventListener), so components that test
//      "is the parent listening" (List's sortable headers, useModel's local
//      mode) behave as in a Vue template.
//  F6. `window.EsConfigureApp(app)` runs for every element's app, so a page can
//      install one shared router (RouterLink rows) or other app plugins.
import {
  defineCustomElement, defineComponent, getCurrentInstance, h, ref, shallowRef,
  onMounted, onBeforeUnmount, onUpdated, camelize, capitalize, unref, watch, withDirectives,
} from 'vue'

const hyphenate = (s) => s.replace(/\B([A-Z])/g, '-$1').toLowerCase()

const SKIP = /^(@|:|v-|#|x-)|^(id|class|style|slot)$/

const DomSlot = defineComponent({
  name: 'EsSlot',
  props: { nodes: Array, holder: Object },
  setup(props) {
    const el = ref()
    onMounted(() => props.nodes.forEach((n) => el.value.appendChild(n)))
    onBeforeUnmount(() => props.nodes.forEach((n) => props.holder.appendChild(n)))
    return () => h('es-slot', { ref: el, style: 'display:contents' })
  },
})

// F4: a <template slot="x"> is stamped once per invocation and bound by the page.
const TemplateSlot = defineComponent({
  name: 'EsTemplateSlot',
  props: { template: Object, slotProps: Object },
  setup(props) {
    const el = ref()
    let app = null
    const stamp = (target = el.value) => {
      app && app.unmount && app.unmount()
      app = null
      target.replaceChildren(props.template.content.cloneNode(true))
      const bind = window.EsBindSlot
      if (bind) app = bind(target, { ...(props.slotProps || {}) }) || null
    }
    // Stamped when the element is created, before it is inserted: a parent that
    // re-mounts the row and re-focuses its control in the same flush finds it.
    const created = { created: (e) => stamp(e) }
    // New slot props go into the bound scope in place (keeps focus/DOM state);
    // a binder without update() gets a fresh stamp.
    watch(() => props.slotProps, (sp) => {
      if (!el.value) return
      if (app && app.update) app.update({ ...(sp || {}) })
      else stamp()
    })
    onBeforeUnmount(() => app && app.unmount && app.unmount())
    return () => withDirectives(h('es-slot', { ref: el, style: 'display:contents' }), [[created]])
  },
})
const NATIVE = (n) => typeof HTMLElement !== 'undefined' && ('on' + n.toLowerCase()) in HTMLElement.prototype

const emitNames = (e) => (Array.isArray(e) ? e : e ? Object.keys(e) : [])
const propKeys = (p) => (Array.isArray(p) ? p : Object.keys(p || {})).map(camelize)
const DIRECTIVE = /^(@|:|v-)/
const hasDirectives = (el) => [...el.attributes].some((a) => DIRECTIVE.test(a.name))

// One promise for "the page's binder has had its DOMContentLoaded turn".
let docReady
const whenDocReady = () =>
  (docReady ||= new Promise((r) =>
    document.readyState === 'loading'
      ? addEventListener('DOMContentLoaded', () => setTimeout(r), { once: true })
      : r(),
  ))

// Declared props minus default/required/validator: the wrapper only relays.
function stripProps(p) {
  if (!p || Array.isArray(p)) return p
  const out = {}
  for (const k in p) {
    const o = p[k]
    out[k] = o && typeof o === 'object' && !Array.isArray(o) ? { type: o.type } : o
  }
  return out
}

function wrap(comp) {
  const names = emitNames(comp.emits)
  const keys = propKeys(comp.props)
  return defineComponent({
    name: 'Es' + (comp.name || comp.__name || 'Component'),
    inheritAttrs: false,
    props: stripProps(comp.props),
    emits: names,
    setup(props, { attrs, emit, slots, expose }) {
      const inner = ref()
      const instance = getCurrentInstance()
      const host = instance.ce
      const noDirs = ref(!host || !hasDirectives(host))
      const loaded = ref(document.readyState !== 'loading')
      if (!loaded.value) whenDocReady().then(() => (loaded.value = true))
      if (!noDirs.value) {
        const ob = new MutationObserver(() => { if (!hasDirectives(host)) { ob.disconnect(); noDirs.value = true } })
        ob.observe(host, { attributes: true })
        onBeforeUnmount(() => ob.disconnect())
      }
      const fire = (n, a) => (host && host._esSetting ? queueMicrotask(() => emit(n, ...a)) : emit(n, ...a))
      const on = Object.fromEntries(names.map((n) => ['on' + capitalize(camelize(n)), (...a) => fire(n, a)]))
      const listened = (n) => !host || host._esListened.has(n) || host._esListened.has(hyphenate(n))
      expose(new Proxy({}, { get: (_, k) => inner.value?.[k] }))
      let last = null
      const exposeOnHost = () => {
        const ex = last && last.component && last.component.exposed
        if (!host || !ex) return
        for (const k of Object.keys(ex)) {
          if (k in host && !host._esExposed.has(k)) continue
          host._esExposed.add(k)
          Object.defineProperty(host, k, { get: () => unref(last.component.exposed[k]), configurable: true })
        }
      }
      onMounted(exposeOnHost)
      onUpdated(exposeOnHost)
      return () => {
        host && host._esTick.value // re-render on every host update (a prop set to its cast value)
        if (!noDirs.value || !loaded.value) return null
        const raw = (host ? host._props : instance.vnode.props) || {}
        const set = {}
        for (const k of keys) if (k in raw) set[k] = props[k]
        const ons = {}
        for (const n of names) if (listened(n)) ons['on' + capitalize(camelize(n))] = on['on' + capitalize(camelize(n))]
        return (last = h(comp, { ...attrs, ...set, ...ons, ref: inner }, slots))
      }
    },
  })
}

export function defineEs(comp) {
  // F6: every element is its own app; a page hook installs app-level plugins
  // (a shared vue-router, i18n, ...) into each one (Vue 3.5 `configureApp`).
  const Base = defineCustomElement(wrap(comp), {
    shadowRoot: false,
    configureApp: (app) => typeof window !== 'undefined' && window.EsConfigureApp && window.EsConfigureApp(app),
  })
  const declared = emitNames(comp.emits)
  const EMITS = new Set(declared.flatMap((n) => [n, hyphenate(n)]))
  const COLLIDE = new Set(declared.filter(NATIVE))
  class EsElement extends Base {
    constructor(...a) {
      super(...a)
      this._esTick = shallowRef(0)
      this._esSetting = 0
      this._esListened = new Set()
      this._esExposed = new Set()
      this._esWrapped = new WeakMap()
    }
    _setProp(...a) {
      this._esSetting++
      try { return super._setProp(...a) } finally { this._esSetting-- }
    }
    addEventListener(type, fn, opts) {
      if (this._esListened && !this._esListened.has(type) && EMITS.has(type)) { this._esListened.add(type); this._esTick && this._esTick.value++ }
      if (fn && this._esWrapped && COLLIDE.has(type)) {
        // F3: native events of a declared emit's name are the component's business.
        let w = this._esWrapped.get(fn)
        if (!w) {
          w = (e) => (e instanceof CustomEvent ? (typeof fn === 'function' ? fn.call(this, e) : fn.handleEvent(e)) : undefined)
          this._esWrapped.set(fn, w)
        }
        return super.addEventListener(type, w, opts)
      }
      return super.addEventListener(type, fn, opts)
    }
    removeEventListener(type, fn, opts) {
      return super.removeEventListener(type, (fn && this._esWrapped.get(fn)) || fn, opts)
    }
    connectedCallback() {
      if (!this._esHolder) {
        const holder = (this._esHolder = document.createElement('es-slots'))
        holder.hidden = true
        const groups = {}
        // A clone of an upgraded element (petite-vue v-if / v-for clone their
        // template element) carries a copy of the old holder plus whatever
        // Vue had rendered. The holder copy is the slot content; the rest is
        // stale render output.
        const kids = [...this.childNodes]
        const old = kids.find((n) => n.nodeName === 'ES-SLOTS')
        for (const n of old ? [...old.childNodes] : kids) {
          if (n.nodeType === 3 && !n.data.trim()) { n.remove(); continue }
          const name = (n.nodeType === 1 && n.getAttribute('slot')) || 'default'
          ;(groups[name] ||= []).push(n)
          holder.appendChild(n)
        }
        if (old) kids.forEach((n) => n.remove())
        this._esSlotFns = Object.fromEntries(
          Object.entries(groups).map(([name, nodes]) => {
            const tpl = nodes.length === 1 && nodes[0].nodeName === 'TEMPLATE' ? nodes[0] : null
            return [name, tpl ? (sp) => [h(TemplateSlot, { template: tpl, slotProps: sp })] : () => [h(DomSlot, { nodes, holder })]]
          }),
        )
      }
      super.connectedCallback()
      // app.mount() emptied the host; the holder goes back as its first child
      // (Vue only patches relative to its own nodes, so a leading sibling is safe).
      if (this._esHolder.parentNode !== this) this.prepend(this._esHolder)
    }
    _parseSlots() { this._slots = {} } // replaced by the holder above
    _renderSlots() {}
    _setAttr(key) { if (!SKIP.test(key)) super._setAttr(key) }
    _update() {
      this._esTick.value++
      super._update()
    }
    _createVNode() {
      const vnode = super._createVNode()
      if (this._esSlotFns && Object.keys(this._esSlotFns).length) {
        vnode.children = { ...this._esSlotFns }
        vnode.shapeFlag |= 32 // ShapeFlags.SLOTS_CHILDREN
      }
      return vnode
    }
  }
  // Hyphenated aliases so binders that test `key in el` (petite-vue) set real
  // values for `:model-value`, `:show-close-button`, ...
  for (const k of propKeys(comp.props)) {
    const hk = hyphenate(k)
    if (hk !== k && !(hk in EsElement.prototype))
      Object.defineProperty(EsElement.prototype, hk, {
        get() { return this[k] },
        set(v) { this[k] = v },
        configurable: true,
      })
  }
  return EsElement
}
