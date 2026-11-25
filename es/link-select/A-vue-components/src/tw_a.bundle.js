// Variant A ("Vue components", the v8 pattern) for wc/three-ways: Link and Select drawn with frappe-ui.
// Loaded before controls.bundle.js, in place of vue_first8.bundle.js (mode v8's entry, which this
// follows): the v8 runtime and v8's Control / ControlInput / ControlData, then ControlLink and
// ControlSelect, so every subclass controls.bundle.js defines (Dynamic Link, Table MultiSelect,
// Link Combobox, Int, ...) extends these classes. control.js no longer imports base_control,
// base_input, data, select or link. web_form.bundle.js imports this bundle first, for the same reason.
import * as Vue from "vue";
import "./vue_first8/define.js";
import desk_renderer from "./vue_first8/renderer.js";
import App from "./vue_first8/App.vue";
import Control from "./vue_first8/controls/Control.vue";
import ControlInput from "./vue_first8/controls/ControlInput.vue";
import ControlData from "./vue_first8/controls/ControlData.vue";
import LinkInput from "./tw_a/LinkInput.vue";
import ControlLink from "./tw_a/ControlLink.vue";
import SelectInput from "./tw_a/SelectInput.vue";
import ControlSelect from "./tw_a/ControlSelect.vue";
import "./tw_a/select_globals.js";
import fui_css from "./tw_a/fui-a.css.js";

if (!frappe.ui.form?.ControlLink?.__tw_a) {
	frappe.provide("frappe.ui.form");
	for (const options of [Control, ControlInput, ControlData, LinkInput, ControlLink, SelectInput, ControlSelect]) frappe.ui.define(options);
	frappe.ui.form.ControlLink.__tw_a = true;
	// from data.js, which controls.bundle.js no longer loads
	frappe.provide("frappe.phone_call");
	frappe.ui.form.ControlReadOnly = frappe.ui.form.ControlData;

	// frappe-ui's styles, scoped to .tw-fui (fui/css.cjs), plus the native select kept out of sight
	const style = document.createElement("style");
	style.dataset.twA = "";
	style.textContent =
		fui_css +
		"\n.tw-native-select{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;" +
		"margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;border:0!important;opacity:0!important}" +
		"\n.tw-ul-standin{display:none!important}.tw-link-combobox .link-btn{position:static;align-items:center;gap:2px}" +
		"\n.tw-select{width:100%}.frappe-control .tw-fui [data-slot=trigger]{width:100%}";
	document.head.appendChild(style);

	// the one app: every controller's view is a child in it
	const root = document.createElement("div");
	root.id = "fui-root";
	document.body.appendChild(root);
	const app = frappe.ui.create_app(App);
	app.mount(root);
	// destroys controllers whose DOM was removed without jQuery (el.remove(), innerHTML), at idle
	frappe.ui.start_sweeping();
	window.__vue_first = { Vue, desk_renderer, version: "v8+tw_a" };
}
