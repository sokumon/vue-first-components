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
  onMounted, onBeforeUnmount, camelize, capitalize, watch,
} from 'vue'

const hyphenate = (s) => s.replace(/\B([A-Z])/g, '-$1').toLowerCase()

const SKIP = /^(@|:|v-|#|x-)|^(id|class|style|slot)$/

// Nested es-* hosts inside slot content get the slot's component instance as
// their provide/inject parent, so <es-tab-list> inside <es-tabs> sees TabsRoot.
// Vue's own CE parent link (_setParent) only reaches the outer host's root
// instance, never the providers the outer component renders around its slot.
const placeNested = (nodes, inst) => {
  for (const n of nodes) {
    if (n.nodeType !== 1) continue
    for (const e of [n, ...n.querySelectorAll('*')])
      if (e._esPlace && !e.parentElement.closest('es-slots')) e._esPlace(inst)
  }
}

// True while the host is light-DOM content of an ancestor es-* element: parked
// in its holder, or under it before it upgraded (customElements.define
// upgrades in registration order, so <es-tab-list> can mount before <es-tabs>).
const awaitsParent = (host) => {
  for (let e = host.parentElement; e; e = e.parentElement) {
    const n = e.localName
    if (n === 'es-slot') return false
    if (n === 'es-slots' || n.startsWith('es-')) return true
  }
  return false
}

const DomSlot = defineComponent({
  name: 'EsSlot',
  props: { nodes: Array, holder: Object },
  setup(props) {
    const el = ref()
    const inst = getCurrentInstance()
    onMounted(() => { props.nodes.forEach((n) => el.value.appendChild(n)); placeNested(props.nodes, inst) })
    // Only take back nodes this outlet still owns: when the same slot is
    // rendered by a newer outlet (tab panel switch, re-render) the old one
    // unmounting must not pull the nodes out of the new one.
    onBeforeUnmount(() => props.nodes.forEach((n) => n.parentNode === el.value && props.holder.appendChild(n)))
    return () => h('es-slot', { ref: el, style: 'display:contents' })
  },
})

// <es-slot> is display:contents, so when a component renders the slot
// `as-child` (reka PopoverTrigger, DropdownMenuTrigger, HoverCardTrigger...)
// the trigger element reka measures, focuses and stamps aria-* on is a box-less
// wrapper. It answers for its content: rects are the union of its children,
// focus() goes to the first focusable descendant, and aria-*/role/data-state
// set on it are mirrored onto that descendant, and focus/blur of the content
// are re-dispatched on the wrapper.
const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"]),[contenteditable=""],[contenteditable=true]'
const MIRROR = /^(aria-|role$|data-state$)/
class EsSlotElement extends HTMLElement {
  _esTarget() {
    for (const e of this.querySelectorAll(FOCUSABLE)) if (!e.closest('es-slots')) return e
    return null
  }
  getBoundingClientRect() {
    const rs = [...this.children].filter((c) => c.nodeName !== 'ES-SLOTS').map((c) => c.getBoundingClientRect()).filter((r) => r.width || r.height)
    if (!rs.length) return super.getBoundingClientRect()
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top))
    return new DOMRect(l, t, Math.max(...rs.map((r) => r.right)) - l, Math.max(...rs.map((r) => r.bottom)) - t)
  }
  getClientRects() { return [this.getBoundingClientRect()] }
  focus(o) { const t = this._esTarget(); t ? t.focus(o) : super.focus(o) }
  connectedCallback() {
    if (this._esOb || ![...this.attributes].some((a) => MIRROR.test(a.name))) return
    this._esMirrored = new Set()
    this._esOb = new MutationObserver(() => this._esSync())
    this._esOb.observe(this, { attributes: true, childList: true, subtree: true })
    this._esSync()
    // focus/blur do not bubble, so a trigger's onFocus/onBlur (HoverCard,
    // Tooltip) bound on this wrapper never fires; re-dispatch from focusin/out.
    if (!this._esFocus) {
      this._esFocus = true
      const relay = (type) => (e) => {
        if (e.target === this || this.contains(e.relatedTarget)) return
        this.dispatchEvent(new FocusEvent(type, { relatedTarget: e.relatedTarget }))
      }
      this.addEventListener('focusin', relay('focus'))
      this.addEventListener('focusout', relay('blur'))
    }
  }
  disconnectedCallback() { this._esOb?.disconnect(); this._esOb = null }
  _esSync() {
    const t = this._esTarget()
    if (!t) return
    if (t !== this._esLast) { this._esMirrored.clear(); this._esLast = t }
    for (const a of this.attributes) if (MIRROR.test(a.name) && t.getAttribute(a.name) !== a.value) { t.setAttribute(a.name, a.value); this._esMirrored.add(a.name) }
    for (const n of this._esMirrored) if (!this.hasAttribute(n)) { t.removeAttribute(n); this._esMirrored.delete(n) }
  }
}
if (!customElements.get('es-slot')) customElements.define('es-slot', EsSlotElement)

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
      // Context bridge (see placeNested).
      const placedBy = shallowRef(null)
      if (host) host._esPlace = (slotInst) => {
        if (placedBy.value === slotInst) return
        placedBy.value = slotInst
        instance.provides = slotInst.provides
      }
      // Inner exposed members (Popover close(), ScrollArea viewportElement...)
      // become element properties once the inner component exists. Vue's CE
      // copies `exposed` keys only at mount, before the deferred inner render.
      if (host) watch(inner, (v) => {
        if (!v) return
        for (const k of Object.keys(v)) {
          if (k[0] === '$' || k[0] === '_' || k in host) continue
          Object.defineProperty(host, k, { get: () => inner.value?.[k], configurable: true })
        }
      }, { flush: 'post' })
      const on = Object.fromEntries(names.map((n) => ['on' + capitalize(camelize(n)), (...a) => emit(n, ...a)]))
      expose(new Proxy({}, { get: (_, k) => inner.value?.[k] }))
      return () => {
        host && host._esTick.value // re-render on every host update (a prop set to its cast value)
        if (!noDirs.value || !loaded.value) return null
        // Parked in an ancestor es-*'s slot holder: render once that slot is
        // rendered, so injections resolve against the real parent tree.
        if (host && !placedBy.value && awaitsParent(host)) return null
        const p = placedBy.value
        const raw = (host ? host._props : instance.vnode.props) || {}
        const set = {}
        for (const k of keys) if (k in raw) set[k] = props[k]
        // Re-placed under a new slot instance after the old one unmounted:
        // re-create the inner component so its injections are current.
        return h(comp, { ...attrs, ...set, ...on, ref: inner, key: p && p.uid }, slots)
      }
    },
  })
}

export function defineEs(comp) {
  const Base = defineCustomElement(wrap(comp), { shadowRoot: false })
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
