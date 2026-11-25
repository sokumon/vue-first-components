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
import {
  defineCustomElement, defineComponent, getCurrentInstance, h, ref, shallowRef,
  onMounted, onBeforeUnmount, onUpdated, camelize, capitalize, unref,
} from 'vue'

const hyphenate = (s) => s.replace(/\B([A-Z])/g, '-$1').toLowerCase()

const SKIP = /^(@|:|v-|#|x-)|^(id|class|style|slot)$/

// [sweep/inputs] A slot can be rendered more than once (Rating #icon per star
// half, Select/Combobox #item-prefix per option, trigger + list). DOM nodes
// live in one place, so the first outlet owns the real (binder-bound) nodes
// and every other outlet gets a static deep clone.
const slotOwner = new WeakMap()
// [sweep/inputs] es-* elements inside slot content inherit the provides of
// the outlet that renders them (RadioGroup -> Radio, reka contexts), like a
// child component in a Vue template would.
function adoptNested(root, inst) {
  const visit = (n) => {
    if (n.nodeType !== 1) return
    if (n._esAdopt) { n._esAdopt(inst); return } // its own subtree is its business
    for (const c of n.children) visit(c)
  }
  visit(root)
}
const DomSlot = defineComponent({
  name: 'EsSlot',
  props: { nodes: Array, holder: Object },
  setup(props) {
    const el = ref()
    const inst = getCurrentInstance()
    let mine = null
    onMounted(() => {
      if (!slotOwner.get(props.nodes)) { slotOwner.set(props.nodes, inst); mine = props.nodes }
      else mine = props.nodes.map((n) => n.cloneNode(true))
      el.value.__esOutlet = inst
      mine.forEach((n) => { el.value.appendChild(n); adoptNested(n, inst) })
    })
    onBeforeUnmount(() => {
      if (slotOwner.get(props.nodes) === inst) {
        slotOwner.delete(props.nodes)
        props.nodes.forEach((n) => props.holder.appendChild(n))
      }
    })
    return () => h('es-slot', { ref: el, style: 'display:contents' })
  },
})

const emitNames = (e) => (Array.isArray(e) ? e : e ? Object.keys(e) : [])
const propKeys = (p) => (Array.isArray(p) ? p : Object.keys(p || {})).map(camelize).filter((k) => !HOST_OWNED.has(k))
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
// [sweep/inputs] `id` is left out: declaring it made Vue define an `id`
// accessor on the host that hides HTMLElement#id (el.id === undefined).
const HOST_OWNED = new Set(['id'])
function stripProps(p) {
  if (!p) return p
  if (Array.isArray(p)) return p.filter((k) => !HOST_OWNED.has(k))
  const out = {}
  for (const k in p) {
    if (HOST_OWNED.has(k)) continue
    const o = p[k]
    out[k] = o && typeof o === 'object' && !Array.isArray(o) ? { type: o.type } : o
  }
  return out
}

function wrap(comp, extra = {}) {
  const names = [...new Set([...emitNames(comp.emits), ...(extra.emits || [])])]
  const declared = stripProps(comp.props)
  const props = Array.isArray(declared) ? [...declared, ...(extra.props || [])]
    : { ...declared, ...Object.fromEntries((extra.props || []).map((k) => [k, null])) }
  const keys = propKeys(props)
  return defineComponent({
    name: 'Es' + (comp.name || comp.__name || 'Component'),
    inheritAttrs: false,
    props,
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
      // [sweep/inputs] slot content of another es-* element waits until that
      // element's outlet places it, then inherits the outlet's provides.
      // Elements upgrade in registration order (es-radio before
      // es-radio-group), so "inside another es-* host" counts too, not only
      // "inside an <es-slots> holder".
      let wait = false, outlet = null
      for (let n = host?.parentElement; n; n = n.parentElement) {
        if (n.tagName === 'ES-SLOT') { outlet = n.__esOutlet; break }
        if (n.tagName === 'ES-SLOTS' || n.tagName.startsWith('ES-')) { wait = true; break }
      }
      const adopted = ref(!wait)
      const adopt = (o) => {
        if (host._app && o) Object.setPrototypeOf(host._app._context.provides, o.provides)
        adopted.value = true
      }
      if (host) host._esAdopt = adopt
      if (outlet) adopt(outlet)
      // [sweep/inputs] exposed methods (focus, open, close, clear, inputElement)
      // become host properties once the inner component exists. Vue's own
      // copy runs at mount, before the deferred inner render.
      const defined = new Set()
      const exposeOnHost = () => {
        const ex = inner.value && instance.subTree?.component?.exposed
        if (!host || !ex) return
        for (const k of Object.keys(ex)) {
          // a prop accessor is an own property (e.g. `open` on pickers) and wins
          if (defined.has(k) || Object.prototype.hasOwnProperty.call(host, k)) continue
          defined.add(k)
          Object.defineProperty(host, k, { get: () => unref(ex[k]), configurable: true })
        }
      }
      onMounted(exposeOnHost)
      onUpdated(exposeOnHost)
      const on = Object.fromEntries(names.map((n) => ['on' + capitalize(camelize(n)), (...a) => emit(n, ...a)]))
      expose(new Proxy({}, { get: (_, k) => inner.value?.[k] }))
      return () => {
        host && host._esTick.value // re-render on every host update (a prop set to its cast value)
        if (!noDirs.value || !loaded.value || !adopted.value) return null
        const raw = (host ? host._props : instance.vnode.props) || {}
        const set = {}
        for (const k of keys) if (k in raw) set[k] = props[k]
        return h(comp, { ...attrs, ...set, ...on, ref: inner }, slots)
      }
    },
  })
}

// [sweep/inputs] every element is its own app, and Vue's useId() counts per
// app, so every first input on the page was `frappe-ui-v-0` (label[for] hit
// the wrong control). A per-element idPrefix makes ids unique.
let appSeq = 0
const configureApp = (app) => { app.config.idPrefix = 'es' + (++appSeq) }

export function defineEs(comp, extra) {
  const Base = defineCustomElement(wrap(comp, extra), { shadowRoot: false, configureApp })
  class EsElement extends Base {
    constructor(...a) {
      super(...a)
      this._esTick = shallowRef(0)
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
          Object.entries(groups).map(([name, nodes]) => [name, () => [h(DomSlot, { nodes, holder })]]),
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
  for (const k of propKeys([...propKeys(comp.props), ...((extra && extra.props) || [])])) {
    // [sweep/inputs] Vue defines prop accessors on the instance only when it
    // connects. petite-vue's v-if/v-for bind a *disconnected* clone first, so
    // `'options' in el` was false and arrays/objects/functions became
    // setAttribute strings ("[object Object]"). A prototype accessor makes
    // `key in el` true from construction; before connection it parks the
    // value as an own property, which Vue's _resolveProps picks up.
    if (!(k in EsElement.prototype))
      Object.defineProperty(EsElement.prototype, k, {
        get() { return this._props ? this._props[k] : undefined },
        set(v) { Object.defineProperty(this, k, { value: v, writable: true, configurable: true, enumerable: true }) },
        configurable: true,
      })
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
