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
  onMounted, onBeforeUnmount, onUpdated, watch, camelize, capitalize,
} from 'vue'

const hyphenate = (s) => s.replace(/\B([A-Z])/g, '-$1').toLowerCase()

const SKIP = /^(@|:|v-|#|x-)|^(id|class|style|slot)$/
const HOST_ONLY = /^(class|style)$/

// ---- sweep/display experimental fixes (marked FIX-n) -----------------------
// FIX-1 a slot rendered more than once at the same time (Breadcrumbs #prefix per
//       crumb, Tree #item-suffix per row): the first outlet owns the live
//       nodes, later outlets get deep clones (static copies).
// FIX-2 as-child: listeners a parent merges onto the outlet (reka <Slot>):
//       onFocus/onBlur also fire from focusin/focusout (focus/blur never reach
//       a display:contents wrapper), aria-* are mirrored to a sole element child.
// FIX-3 the display:contents outlet reports its children's box from
//       getBoundingClientRect/getClientRects, so floating-ui can anchor to it.
// FIX-4 the outlet records its own `provides`; es-* elements inside are
//       re-linked to it (so a nested <es-tooltip> sees <es-tooltip-provider>'s
//       reka context) and only render once placed.
const boxes = (els) => els.flatMap((c) =>
  getComputedStyle(c).display === 'contents' ? boxes([...c.children]) : [c.getBoundingClientRect()])
const unionRect = (els, self) => {
  const rs = boxes(els).filter((r) => r.width || r.height)
  if (!rs.length) return Element.prototype.getBoundingClientRect.call(self)
  const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top))
  const R = Math.max(...rs.map((r) => r.right)), B = Math.max(...rs.map((r) => r.bottom))
  return new DOMRect(l, t, R - l, B - t)
}
function linkEsTree(nodes) {
  for (const n of nodes) {
    if (n.nodeType !== 1) continue
    if (n._esLink) n._esLink()
    n.querySelectorAll('*').forEach((d) => d._esLink && d._esLink())
  }
}
const compose = (f, g) => (f && g && f !== g ? (e) => { f(e); g(e) } : f || g)
const DomSlot = defineComponent({
  name: 'EsSlot',
  inheritAttrs: false,
  props: { nodes: Array, holder: Object },
  setup(props, { attrs }) {
    const el = ref()
    const inst = getCurrentInstance()
    let mine = null, owner = false
    // FIX-2 mirror aria-* onto a sole element child (aria-describedby belongs on the button).
    function mirrorAria() {
      const els = (mine || []).filter((n) => n.nodeType === 1)
      if (els.length !== 1) return
      for (const k in attrs) if (k.startsWith('aria-')) {
        if (attrs[k] == null) els[0].removeAttribute(k); else els[0].setAttribute(k, attrs[k])
      }
    }
    onMounted(() => {
      const e = el.value
      e._esProvides = inst.provides
      if (props.nodes.__esOwner) mine = props.nodes.map((n) => n.cloneNode(true))
      else { props.nodes.__esOwner = inst; owner = true; mine = props.nodes }
      mine.forEach((n) => e.appendChild(n))
      e.getBoundingClientRect = function () { return unionRect([...this.children], this) }
      e.getClientRects = function () { return [this.getBoundingClientRect()] }
      mirrorAria()
      linkEsTree(mine)
    })
    onUpdated(mirrorAria)
    onBeforeUnmount(() => {
      if (owner) { props.nodes.forEach((n) => props.holder.appendChild(n)); props.nodes.__esOwner = null }
    })
    // FIX-2 focus/blur do not bubble to the display:contents outlet; their
    // bubbling twins focusin/focusout do, with the real element as target.
    return () => h('es-slot', {
      ...attrs,
      onFocusin: compose(attrs.onFocusin, attrs.onFocus),
      onFocusout: compose(attrs.onFocusout, attrs.onBlur),
      ref: el, style: 'display:contents',
    })
  },
})

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
      const on = Object.fromEntries(names.map((n) => ['on' + capitalize(camelize(n)), (...a) => emit(n, ...a)]))
      expose(new Proxy({}, { get: (_, k) => inner.value?.[k] }))
      // FIX-7 defineExpose()d methods become element methods (tree.expandAll()).
      if (host) watch(inner, (v) => {
        const ex = v && v.$ && v.$.exposed
        if (ex) for (const k of Object.keys(ex))
          if (typeof ex[k] === 'function' && !(k in host)) host[k] = (...a) => inner.value?.[k](...a)
      })
      return () => {
        host && host._esTick.value // re-render on every host update (a prop set to its cast value)
        if (!noDirs.value || !loaded.value) return null
        if (host && !host._esPlaced.value) return null // FIX-4
        const raw = (host ? host._props : instance.vnode.props) || {}
        const set = {}
        for (const k of keys) if (k in raw) set[k] = props[k]
        // FIX-5 host attributes that are not props reach the component under
        // their attribute name (aria-label, data-*), not camelized (ariaLabel, dataT).
        const fall = {}
        for (const k in attrs) fall[/^on[A-Z]/.test(k) ? k : hyphenate(k)] = attrs[k]
        // FIX-6 host class/style are the component's class/style, as in a template.
        if (host) {
          const c = host.getAttribute('class'), st = host.getAttribute('style')
          if (c) fall.class = c
          if (st) fall.style = st
        }
        return h(comp, { ...fall, ...set, ...on, ref: inner }, slots)
      }
    },
  })
}

export function defineEs(comp) {
  const Base = defineCustomElement(wrap(comp), { shadowRoot: false })
  const hasTitle = propKeys(comp.props).includes('title')
  class EsElement extends Base {
    constructor(...a) {
      super(...a)
      this._esTick = shallowRef(0)
      this._esPlaced = shallowRef(true)
    }
    // FIX-4: an es-* inside slot content waits until its outlet places it,
    // then takes the outlet's provides as its parent context.
    _esLink() {
      for (let n = this.parentNode; n; n = n.parentNode) {
        if (n.nodeName === 'ES-SLOTS') { if (!this._esWasPlaced) this._esPlaced.value = false; return }
        if (n.nodeName === 'ES-SLOT' && n._esProvides) {
          if (this._app) Object.setPrototypeOf(this._app._context.provides, n._esProvides)
          this._esWasPlaced = true; this._esPlaced.value = true; return
        }
        if (n.nodeType === 1 && n.localName.startsWith('es-') && !n._esHolder && !this._esWasPlaced) {
          this._esPlaced.value = false; return // parent es-* not upgraded yet: it will move us into its holder
        }
      }
      this._esWasPlaced = true; this._esPlaced.value = true
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
      this._esLink()
    }
    _parseSlots() { this._slots = {} } // replaced by the holder above
    _renderSlots() {}
    _setAttr(key) {
      if (HOST_ONLY.test(key)) { this._esTick && this._esTick.value++; return } // FIX-6 re-render on class/style change
      if (hasTitle && (key === 'title' || key === 'es-title')) {
        // FIX-8 a `title` prop must not leave a native tooltip on the host: the
        // attribute moves to `es-title` (kept, so v-if/v-for clones carry it).
        const v = this.getAttribute(key)
        if (key === 'title' && v == null) return // our own removal
        if (v != null || key === 'es-title') this._setProp('title', v == null ? undefined : v, false, true)
        if (key === 'title') queueMicrotask(() => { this.setAttribute('es-title', v); this.removeAttribute('title') }) // not now: Vue is iterating this.attributes
        return
      }
      if (!SKIP.test(key)) super._setAttr(key)
    }
    // FIX-9 a prop named id/title is not reflected to the host attribute
    // (`:id` on es-form-label rewrote the host's id; `:title` left a native tooltip).
    _setProp(key, val, shouldReflect = true, shouldUpdate = false) {
      return super._setProp(key, val, key === 'id' || (key === 'title' && hasTitle) ? false : shouldReflect, shouldUpdate)
    }
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
