// Shim "fragfix": petite-vue 0.4.1 bug fix. v-if/v-for directly inside a <template v-if/v-for>
// block reads el.parentElement, which is null for children of a DocumentFragment, and
// crashes on insertBefore. Make parentElement fall back to a fragment parent.
const d = Object.getOwnPropertyDescriptor(Node.prototype, 'parentElement')
Object.defineProperty(Node.prototype, 'parentElement', { configurable: true,
  get() { const p = d.get.call(this); if (p) return p; const n = this.parentNode; return n && n.nodeType === 11 && !n.host ? n : null } })
export default {}
