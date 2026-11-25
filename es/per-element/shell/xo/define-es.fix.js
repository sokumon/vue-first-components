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
  onMounted, onBeforeUnmount, camelize, capitalize,
} from 'vue'

const hyphenate = (s) => s.replace(/\B([A-Z])/g, '-$1').toLowerCase()

const SKIP = /^(@|:|v-|#|x-)|^(id|class|style|slot)$/

const DomSlot = defineComponent({
  name: 'EsSlot',
  props: { part: Object },
  setup(props) {
    const el = ref()
    const self = getCurrentInstance()
    // [sweep/shell fix B] the es-slot carries the instance rendered at the
    // slot location; a custom element moved in reads its provides from it.
    // [sweep/shell fix D] move the slot's own container (<es-slots-part>,
    // display:contents), not a node list captured at connect. The slot nodes
    // then never change parent: petite-vue's v-if / v-for remember the parent
    // they were walked in (insertBefore on it later), and replace nodes
    // (comment anchor + clone) that a captured list would miss.
    onMounted(() => { el.value.__esSlotInst = self; el.value.appendChild(props.part) })
    onBeforeUnmount(() => { const h = props.part.__esHolder; if (h && props.part.parentNode === el.value) h.appendChild(props.part) })
    return () => h('es-slot', { ref: el, style: 'display:contents' })
  },
})

const PARKED = { parked: true }
// Nearest slot context of a node: the DomSlot instance of the <es-slot> it sits
// in, PARKED while it waits in an <es-slots> holder, null when top-level.
function slotCtx(el) {
  for (let n = el.parentNode; n; n = n.parentNode) {
    if (n.nodeName === 'ES-SLOT') return n.__esSlotInst || PARKED
    if (n.nodeName === 'ES-SLOTS') return PARKED
  }
  return null
}

// [sweep/shell fix F] hosts are layout-transparent by default, like a Vue
// component that renders straight into its parent: `:where(es-x){display:contents}`
// has zero specificity, so any class on the host (`block h-screen`) wins.
// Without it an inline/block host sits between a flex/grid parent and the
// component root, and `flex-1 min-h-0` / grid stretch chains break
// (SettingsDialog panels stop scrolling, MobileNav items shrink).
let layoutSheet
const seenTags = new Set()
function contentsByDefault(tag) {
  if (seenTags.has(tag)) return
  seenTags.add(tag)
  if (!layoutSheet) {
    layoutSheet = new CSSStyleSheet()
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, layoutSheet]
  }
  layoutSheet.insertRule(`:where(${tag}){display:contents}`, layoutSheet.cssRules.length)
}

const emitNames = (e) => (Array.isArray(e) ? e : e ? Object.keys(e) : [])
const propKeys = (p) => (Array.isArray(p) ? p : Object.keys(p || {})).map(camelize)
const DIRECTIVE = /^(@|:|v-)/
const hasDirectives = (el) => [...el.attributes].some((a) => DIRECTIVE.test(a.name))

// One promise for "the page's binder has had its DOMContentLoaded turn".
// [sweep/shell fix E] a `defer` bundle runs while readyState is already
// 'interactive' but before DOMContentLoaded (where host binders mount), so
// readyState alone said "loaded" and slot content rendered (and moved) before
// the binder walked it. The navigation timing entry says whether DCL started.
const dclPending = () =>
  document.readyState === 'loading' ||
  performance.getEntriesByType?.('navigation')?.[0]?.domContentLoadedEventStart === 0
let docReady
const whenDocReady = () =>
  (docReady ||= new Promise((r) =>
    dclPending()
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
      const loaded = ref(!dclPending())
      if (!loaded.value) whenDocReady().then(() => (loaded.value = true))
      if (!noDirs.value) {
        const ob = new MutationObserver(() => { if (!hasDirectives(host)) { ob.disconnect(); noDirs.value = true } })
        ob.observe(host, { attributes: true })
        onBeforeUnmount(() => ob.disconnect())
      }
      const on = Object.fromEntries(names.map((n) => ['on' + capitalize(camelize(n)), (...a) => emit(n, ...a)]))
      expose(new Proxy({}, { get: (_, k) => inner.value?.[k] }))
      return () => {
        host && host._esTick.value // re-render on every host update (a prop set to its cast value)
        if (!noDirs.value || !loaded.value) return null
        // [sweep/shell fix B] slot content of another es-* element renders only
        // while that slot is rendered, inside the slot location's provide chain
        // (Sidebar -> SidebarItem collapsed state, TabsRoot -> TabsTrigger, ...).
        const ctx = host && host._esCtx.value
        if (ctx === PARKED) return null
        if (ctx && host._app) Object.setPrototypeOf(host._app._context.provides, ctx.provides)
        const raw = (host ? host._props : instance.vnode.props) || {}
        const set = {}
        for (const k of keys) if (k in raw) set[k] = props[k]
        return h(comp, { ...attrs, ...set, ...on, ref: inner, key: ctx ? ctx.uid : 0 }, slots)
      }
    },
  })
}

export function defineEs(comp) {
  const keys = propKeys(comp.props)
  const Base = defineCustomElement(wrap(comp), { shadowRoot: false })
  class EsElement extends Base {
    constructor(...a) {
      super(...a)
      this._esTick = shallowRef(0)
      this._esCtx = shallowRef(null)
      // [sweep/shell fix A] Vue defines prop accessors only in connectedCallback
      // (_resolveProps). A binder that sets props on a not-yet-connected element
      // (petite-vue v-if / v-for clones) tests `key in el`, misses, and calls
      // setAttribute -> "[object Object]" / "false". Own, configurable
      // accessors from the start; _resolveProps later redefines them.
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(this, k)) continue
        Object.defineProperty(this, k, {
          get() { return this._props[k] },
          set(v) { this._setProp(k, v, false, false) },
          configurable: true, enumerable: false,
        })
      }
    }
    connectedCallback() {
      contentsByDefault(this.localName)
      if (!this._esHolder) {
        const holder = (this._esHolder = document.createElement('es-slots'))
        holder.hidden = true
        const parts = {}
        // A clone of an upgraded element (petite-vue v-if / v-for clone their
        // template element) carries a copy of the old holder plus whatever
        // Vue had rendered. The holder copy is the slot content; the rest is
        // stale render output.
        const kids = [...this.childNodes]
        const old = kids.find((n) => n.nodeName === 'ES-SLOTS')
        // Parts of this host: those in the holder copy, and those a rendered
        // slot had moved into the copied Vue output (nearest es-* host is us).
        const owner = (n) => { for (let a = n.parentElement; a; a = a.parentElement) if (/^ES-/.test(a.tagName) && !/^ES-SLOTS?(-PART)?$/.test(a.tagName)) return a }
        const src = old
          ? [...old.childNodes, ...[...this.querySelectorAll('es-slots-part')].filter((n) => owner(n) === this && !old.contains(n))]
              .flatMap((n) => n.nodeName === 'ES-SLOTS-PART' ? [...n.childNodes] : [n])
          : kids
        for (const n of src) {
          if (n.nodeType === 3 && !n.data.trim()) { n.remove(); continue }
          const name = (n.nodeType === 1 && n.getAttribute('slot')) || 'default'
          if (!parts[name]) {
            const part = (parts[name] = document.createElement('es-slots-part'))
            part.style.display = 'contents'
            part.__esHolder = holder
            holder.appendChild(part)
          }
          parts[name].appendChild(n)
        }
        if (old) kids.forEach((n) => n.remove())
        this._esSlotFns = Object.fromEntries(
          Object.entries(parts).map(([name, part]) => [name, () => [h(DomSlot, { part })]]),
        )
      }
      const ctx = slotCtx(this)
      const moved = ctx !== this._esCtx.value
      if (moved) this._esCtx.value = ctx
      super.connectedCallback()
      // Placed by a slot that just mounted: render now, as a Vue child would be,
      // so the parent's onMounted sees it (SettingsRow finds its control's id).
      if (moved && ctx && ctx !== PARKED && this._instance && this._instance.job) this._instance.job()
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
      // [sweep/shell fix C] a component that re-emits a native event it got from
      // its own light-DOM output (emit('click', $event)) would fire host
      // listeners twice: once by native bubbling, once as the CustomEvent.
      if (vnode.ce) {
        const ce = vnode.ce
        vnode.ce = (inst) => {
          ce(inst)
          const emit = inst.emit
          inst.emit = (ev, ...args) => {
            const e = args[0]
            if (e instanceof Event && e.type === ev && e.bubbles && e.target instanceof Node && this.contains(e.target)) return
            return emit(ev, ...args)
          }
        }
      }
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
