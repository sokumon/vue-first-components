// Registers every capitalised component export of frappe-ui as <es-kebab-name>
// and every @framework/ui component as <es-fw-kebab-name>, all rendered by the
// one app in runtime.js. Package-wide only: nothing here names a component.
import * as Vue from 'vue'
import * as VueRouter from 'vue-router'
import { ES, defineEs } from './runtime.js'
import * as FUI from 'frappe-ui'
import * as FW_ActivityTimeline from '@framework/ui/ActivityTimeline'
import * as FW_AutomationCanvas from '@framework/ui/AutomationCanvas'
import * as FW_ColumnSettings from '@framework/ui/ColumnSettings'
import * as FW_Composer from '@framework/ui/Composer'
import * as FW_ConditionBuilder from '@framework/ui/ConditionBuilder'
import * as FW_DataImport from '@framework/ui/DataImport'
import * as FW_EmailAccounts from '@framework/ui/EmailAccounts'
import * as FW_FileUpload from '@framework/ui/FileUpload'
import * as FW_Filter from '@framework/ui/Filter'
import * as FW_FormLayout from '@framework/ui/FormLayout'
import * as FW_Grid from '@framework/ui/Grid'
import * as FW_GroupBy from '@framework/ui/GroupBy'
import * as FW_InviteUser from '@framework/ui/InviteUser'
import * as FW_Link from '@framework/ui/Link'
import * as FW_ListView from '@framework/ui/ListView'
import * as FW_Notifications from '@framework/ui/Notifications'
import * as FW_Onboarding from '@framework/ui/Onboarding'
import * as FW_Phone from '@framework/ui/Phone'
import * as FW_QuickFilter from '@framework/ui/QuickFilter'
import * as FW_SetupFlow from '@framework/ui/SetupFlow'
import * as FW_SignupBanner from '@framework/ui/SignupBanner'
import * as FW_SortBy from '@framework/ui/SortBy'
import * as FW_TableMultiSelect from '@framework/ui/TableMultiSelect'
import * as FW_TrialBanner from '@framework/ui/TrialBanner'
import * as FW_List from '@framework/ui/experimental/List'

const fieldMods = import.meta.glob('../../../../../frappe/ui/src/components/Fields/*.vue', { eager: true })

const kebab = (s) => s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const isComponent = (v) => v && typeof v === 'object' && !Array.isArray(v) && (v.setup || v.render || v.__name || v.template)

const registered = [], failed = []
function register(prefix, name, comp) {
  const tag = prefix + kebab(name)
  try { if (defineEs(tag, comp)) registered.push(tag) } catch (e) { failed.push([tag, e.message]) }
}
for (const [n, v] of Object.entries(FUI)) if (/^[A-Z]/.test(n) && isComponent(v)) register('es-', n, v)
const FW = [FW_ActivityTimeline, FW_AutomationCanvas, FW_ColumnSettings, FW_Composer, FW_ConditionBuilder, FW_DataImport,
  FW_EmailAccounts, FW_FileUpload, FW_Filter, FW_FormLayout, FW_Grid, FW_GroupBy, FW_InviteUser, FW_Link, FW_ListView,
  FW_Notifications, FW_Onboarding, FW_Phone, FW_QuickFilter, FW_SetupFlow, FW_SignupBanner, FW_SortBy,
  FW_TableMultiSelect, FW_TrialBanner, FW_List]
for (const [p, m] of Object.entries(fieldMods)) register('es-fw-', p.split('/').pop().replace('.vue', ''), m.default)
for (const mod of FW) for (const [n, v] of Object.entries(mod)) if (/^[A-Z]/.test(n) && isComponent(v)) register('es-fw-', n, v)

// Package-wide wiring of the one app: overlays teleport into <es-portal>
// (inside the CSS scope), toasts and imperative dialogs have their hosts,
// frappe-ui resources talk to a Frappe backend.
FUI.setConfig('resourceFetcher', FUI.frappeRequest)
ES.configure((app) => app.provide(FUI.portalTargetKey, ES.portal))
ES.addRoot(FUI.ToastProvider, { unless: ['es-toast-provider', 'es-frappe-ui-provider'] }) // a second <Toaster> shows every toast twice (Dialogs dedups itself)
ES.addRoot(FUI.Dialogs)

ES.version = Vue.version
Object.assign(ES, { registered, failed, toast: FUI.toast, dialog: FUI.dialog, Vue, VueRouter, frappeUI: FUI })
if (typeof window !== 'undefined' && !window.ES) window.ES = ES
export { ES, defineEs }
