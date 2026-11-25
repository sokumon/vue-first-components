// Turn every component frappe-ui exports (plus some @framework/ui Fields) into
// an <es-*> custom element. One Vue copy, light DOM (shadowRoot:false) so the
// global Tailwind sheet styles them and Teleports land in <body>.
import { defineEs } from './define-es.js'
import * as FUI from 'frappe-ui'
import CheckField from '@framework/ui/components/Fields/CheckField.vue'
import SelectField from '@framework/ui/components/Fields/SelectField.vue'
import RatingField from '@framework/ui/components/Fields/RatingField.vue'
import DateField from '@framework/ui/components/Fields/DateField.vue'
import './style.css'

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const isComponent = (v) =>
  v && typeof v === 'object' && (v.setup || v.render || v.template || v.__name || v.name) && !Array.isArray(v)

const registered = [], failed = []
function register(name, comp) {
  const tag = 'es-' + kebab(name)
  try {
    customElements.define(tag, defineEs(comp))
    registered.push(tag)
  } catch (e) { failed.push([tag, e.message]) }
}
for (const [name, v] of Object.entries(FUI)) {
  if (/^[A-Z]/.test(name) && isComponent(v)) register(name, v)
}
Object.entries({ CheckField, SelectField, RatingField, DateField }).forEach(([n, c]) => register('Fw' + n, c))
window.__es = { registered, failed }

// Sweep-only additions: the imperative halves of overlay components, which an
// IIFE that only registers tags leaves unreachable from the host page.
import { createApp, h } from 'vue'
const registerShortcuts = (configs) => {
  const el = document.createElement('div')
  const app = createApp({ setup() { FUI.useKeyboardShortcut(configs); return () => null } })
  app.mount(el)
  return () => app.unmount()
}
window.FUI = { toast: FUI.toast, dialog: FUI.dialog, registerShortcuts }
// Control mount for differential checks: the same component as a plain Vue app.
window.FUI.mount = (name, props, el, slots) => createApp({ render: () => h(FUI[name], props, slots) }).mount(el)
window.FUI.h = h
