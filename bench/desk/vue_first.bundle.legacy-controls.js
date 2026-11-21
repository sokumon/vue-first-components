// Test branch only: wires the v5 design (vue-first-components/v5) into the desk.
// The build would add `frappe.ui.define(_sfc_main)` to each .vue named frappe.ui.*; here the entry does it.
import * as Vue from "vue";
import "./vue_first/define.js";
import desk_renderer from "./vue_first/renderer.js";
import { install as install_router } from "./vue_first/desk_router.js";
import { routerKey, routeLocationKey, Button as FuiButton } from "./vue_first/fui-lib.js";
import App from "./vue_first/App.vue";
import VueProbe from "./vue_first/VueProbe.vue";
import FuiProbe from "./vue_first/FuiProbe.vue";
import SetupProbe from "./vue_first/SetupProbe.vue";
import GlobalRow from "./vue_first/GlobalRow.vue";
import PerfRow from "./vue_first/PerfRow.vue";
import PlainRow from "./vue_first/PlainRow.vue";

for (const options of [VueProbe, FuiProbe, SetupProbe, PerfRow, GlobalRow]) frappe.ui.define(options);

const root = document.createElement("div");
root.id = "fui-root";
document.body.appendChild(root);
frappe.ui.app = desk_renderer.createApp(App);
install_router(frappe.ui.app, { routerKey, routeLocationKey });
frappe.ui.app.mount(root);

window.__vue_first = { Vue, desk_renderer, PlainRow, FuiProbe, FuiButton };
