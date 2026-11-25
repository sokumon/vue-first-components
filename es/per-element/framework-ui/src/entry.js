// @framework/ui components as <es-fw-*> custom elements (sweep/framework-ui).
import { defineEs } from './define-es.js'
import * as FUI from 'frappe-ui'
import { setConfig, frappeRequest } from 'frappe-ui'
import './style.css'
import { createApp, h, ref, reactive } from 'vue'
import * as VueRouter from 'vue-router'

const fieldMods = import.meta.glob('../../../../frappe/ui/src/components/Fields/*Field.vue', { eager: true })
import { FormLayout, registerFieldType, getFieldComponent, NO_COMMIT, CommitKey } from '@framework/ui/FormLayout'
import { ResolveFieldKey } from '@framework/ui/components/FormLayout/types'
import { ListViewShell } from '@framework/ui/ListView'
import { Filter } from '@framework/ui/Filter'
import { SortBy } from '@framework/ui/SortBy'
import { GroupBy, GroupByTable } from '@framework/ui/GroupBy'
import { QuickFilter } from '@framework/ui/QuickFilter'
import { ColumnSettings } from '@framework/ui/ColumnSettings'
import { ConditionBuilder } from '@framework/ui/ConditionBuilder'
import * as AT from '@framework/ui/ActivityTimeline'
import * as FU from '@framework/ui/FileUpload'
import { InviteUser } from '@framework/ui/InviteUser'
import { EmailAccounts } from '@framework/ui/EmailAccounts'
import { Link } from '@framework/ui/components/Link'
import { Grid } from '@framework/ui/components/Grid'
import { NotificationPanel, NotificationItem } from '@framework/ui/components/Notifications'
import { List, ListFooter, ListBulkBar } from '@framework/ui/experimental/List'
import { AutomationCanvas, AutomationCanvasIcon } from '@framework/ui/AutomationCanvas'

setConfig('resourceFetcher', frappeRequest)

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const registered = [], failed = []
function register(name, comp) {
  const tag = 'es-fw-' + kebab(name)
  try { customElements.define(tag, defineEs(comp)); registered.push(tag) } catch (e) { failed.push([tag, e.message]) }
}
// window.__fw is set before any element upgrades (page hooks such as
// EsConfigureApp read it from inside connectedCallback).
const COMPS = {
  FormLayout, ListViewShell, Filter, SortBy, GroupBy, GroupByTable, QuickFilter, ColumnSettings, ConditionBuilder,
  ActivityTimeline: AT.ActivityTimeline, TimelineContainer: AT.TimelineContainer, AttachmentChip: AT.AttachmentChip,
  EmailItem: AT.EmailItem, CommentItem: AT.CommentItem, LogItem: AT.LogItem, VersionItem: AT.VersionItem,
  FileUploadDialog: FU.FileUploadDialog, AttachmentsList: FU.AttachmentsList, UploadTray: FU.UploadTray,
  InviteUser, EmailAccounts, Link, Grid, NotificationPanel, NotificationItem, List, ListFooter, ListBulkBar,
  AutomationCanvas, AutomationCanvasIcon,
}
window.__fw = { createApp, h, ref, reactive, VueRouter, ResolveFieldKey, FUI, comps: COMPS, registerFieldType, getFieldComponent, NO_COMMIT, CommitKey, FU, AT }
for (const [p, m] of Object.entries(fieldMods)) register(p.split('/').pop().replace('.vue', ''), m.default)
for (const [n, c] of Object.entries(COMPS)) register(n, c)
window.__es = { registered, failed }
