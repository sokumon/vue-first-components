// Test branch only: wires the v8 design (vue-first-components/v8) into the desk.
// Loaded before controls.bundle.js: the form controls' three base classes are v8 classes, and every
// other control (Int, Link, Select, Table, Check, ...) still extends them as before.
// The build would add `frappe.ui.define(_sfc_main)` to each .vue named frappe.ui.*; here the entry does it.
import * as Vue from "vue";
import "./vue_first8/define.js";
import desk_renderer from "./vue_first8/renderer.js";
import { install as install_router } from "./vue_first8/desk_router.js";
import { routerKey, routeLocationKey, Button as FuiButton } from "./vue_first8/fui-lib.js";
import App from "./vue_first8/App.vue";
import Control from "./vue_first8/controls/Control.vue";
import ControlInput from "./vue_first8/controls/ControlInput.vue";
import ControlData from "./vue_first8/controls/ControlData.vue";
import VueProbe from "./vue_first8/VueProbe.vue";
import FuiProbe from "./vue_first8/FuiProbe.vue";
import SetupProbe from "./vue_first8/SetupProbe.vue";
import GlobalRow from "./vue_first8/GlobalRow.vue";
import PerfRow from "./vue_first8/PerfRow.vue";
import PlainRow from "./vue_first8/PlainRow.vue";
// frappe.ui.Page (ui/Page.vue) when the bench is in mode v8page, else null (see ~/fb/pwt/mode.sh)
import PagePort from "./vue_first8/page_port.js";

for (const options of [Control, ControlInput, ControlData, VueProbe, FuiProbe, SetupProbe, PerfRow, GlobalRow]) frappe.ui.define(options);
// from data.js, which controls.bundle.js no longer loads
frappe.provide("frappe.phone_call");
frappe.ui.form.ControlReadOnly = frappe.ui.form.ControlData;

// frappe.ui.Page: desk.bundle.js (loaded before this bundle) defined page.js's class; the v8 class
// replaces it. Nothing extends frappe.ui.Page and the desk makes pages at runtime
// (frappe.ui.make_app_page, `new frappe.ui.Page`), so every page from here on is a v8 one. Statics an
// earlier script set on the old class (mobile_nav's title_action) carry over.
if (PagePort) {
	const legacy_page = frappe.ui.Page;
	frappe.ui.define(PagePort);
	for (const key of Object.keys(legacy_page || {})) if (!(key in frappe.ui.Page)) frappe.ui.Page[key] = legacy_page[key];
	frappe.ui.LegacyPage = legacy_page;
}

// the one app: every controller's view is a child in it
const root = document.createElement("div");
root.id = "fui-root";
document.body.appendChild(root);
const app = frappe.ui.create_app(App);
install_router(app, { routerKey, routeLocationKey });
app.mount(root);
// destroys controllers whose DOM was removed without jQuery (el.remove(), innerHTML), at idle
frappe.ui.start_sweeping();

window.__vue_first = { Vue, desk_renderer, PlainRow, FuiProbe, FuiButton, version: "v8" };
