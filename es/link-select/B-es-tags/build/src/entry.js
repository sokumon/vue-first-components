// B (es-* tags) for Desk's Link and Select: only the tags this variant needs,
// from frappe-ui unchanged, rendered by the one app in runtime.js (wc/jq runtime
// plus the sweep fixes). Package-wide wiring only; nothing here edits a component.
import * as Vue from 'vue'
import { ES, defineEs } from './runtime.js'
import { Combobox, Select, portalTargetKey } from 'frappe-ui'

const registered = []
for (const [tag, comp] of [['es-combobox', Combobox], ['es-select', Select]]) if (defineEs(tag, comp)) registered.push(tag)
// overlays teleport into <es-portal> (inside the CSS scope)
ES.configure((app) => app.provide(portalTargetKey, ES.portal))
ES.version = Vue.version
Object.assign(ES, { registered, Vue })
if (typeof window !== 'undefined' && !window.ES) window.ES = ES
export { ES, defineEs }
