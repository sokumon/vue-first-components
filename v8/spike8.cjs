// v8 checks in jsdom. Run: . ~/fb/env.sh && cd v8 && node --expose-gc spike8.cjs (also NODE_ENV=production)
const { boot } = require("./harness.cjs");
const Vue = require("vue");
const { h, ref, shallowRef, reactive, nextTick, onMounted, onErrorCaptured, watch, getCurrentInstance } = Vue;

// ---- an App with a plain Vue component that creates legacy controls in its own onMounted
const show_host = ref(false);
const from_hooks = {};
const Host = {
	name: "Host",
	setup() {
		from_hooks.host = getCurrentInstance();
		const el = ref(null);
		onMounted(() => {
			const c = new frappe.ui.form.ControlData({ df: { fieldtype: "Data", fieldname: "in_mounted", label: "In mounted" }, parent: el.value, render_input: 1 });
			from_hooks.mounted = {
				wrapper: c.$wrapper?.length === 1 && c.$wrapper[0].parentNode === el.value,
				input: c.$input?.length === 1 && c.$input[0].isConnected,
				label: c.label_span?.textContent,
				c,
			};
		});
		return () => h("div", { class: "host", ref: el });
	},
};
const watch_trigger = ref(0);
const j_comp = shallowRef(null); // group J mounts and unmounts plain components here
const App = {
	name: "App",
	setup() {
		const area = ref(null);
		watch(watch_trigger, () => {
			const c = new frappe.ui.form.ControlData({ df: { fieldtype: "Data", fieldname: "in_watch", label: "In watch" }, parent: area.value, render_input: 1 });
			from_hooks.watch = { input: c.$input?.[0]?.isConnected, label: c.label_span?.textContent };
		});
		return () => [h("div", { class: "watch-area", ref: area }), show_host.value ? h(Host) : null, j_comp.value ? h(j_comp.value) : null];
	},
};

const { app } = boot({ App });
for (const f of ["controls/Control", "controls/ControlInput", "controls/ControlData", "demo/ProbeChild", "demo/Section", "demo/SlotHost", "demo/Failing", "demo/Nest", "demo/RowKid", "demo/RenderNew", "demo/Picker", "demo/Kid"]) require(`./${f}.vue`);
require("./legacy/check.js");
require("./legacy/link_like.js");

let pass = 0, fail = 0;
const failures = [];
const check = (name, ok) => {
	ok ? pass++ : (fail++, failures.push(name));
	console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
};
const area = () => $("<div class='area'>").appendTo("body")[0];
const Data = () => frappe.ui.form.ControlData;
// a control whose view watches a store: it holds something outside itself, so sweep() acts on it
const store = shallowRef(0);
let Watched_class = null;
const Watched = () =>
	(Watched_class ||= frappe.ui.define({
		name: "frappe.ui.form.ControlWatched",
		extends: require("./controls/ControlData.vue"),
		setup(self) {
			watch(store, () => self.refresh());
			return {};
		},
	}));
const mutations = async (el, fn) => {
	const records = [];
	const mo = new MutationObserver((r) => records.push(...r));
	mo.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
	fn();
	await Promise.resolve();
	records.push(...mo.takeRecords());
	mo.disconnect();
	return records;
};
// count markup jQuery parses: $("<div>...") and friends
let jq_markup = 0;
const Init = $.fn.init;
$.fn.init = function (selector, context, root) {
	if (typeof selector === "string" && selector.trim()[0] === "<") jq_markup++;
	return Init.call(this, selector, context, root);
};
$.fn.init.prototype = Init.prototype;

(async () => {
	// ------------------------------------------------------------------ A. one app
	check("frappe.ui.app is the one createApp app, mounted", frappe.ui.app === app && !!app._container);

	// ------------------------------------------------------------------ B. template-first ControlData
	const a = area();
	jq_markup = 0;
	const c = new (Data())({ df: { fieldtype: "Data", fieldname: "title", label: "Title", reqd: 1, description: "Help <b>x</b>" }, parent: a, render_input: true });
	const made_markup = jq_markup;
	check("new returns with $wrapper in parent and $input in its .control-input", c.$wrapper[0].parentNode === a && c.$input.parent().is(".control-input") && c.$input.is("input.input-with-feedback.form-control"));
	check("make_input() only switched the template's input on: jQuery parsed no markup during new", made_markup === 0);
	check("label, required, description (HTML), tooltip, data-* from the template",
		c.label_span.textContent === "Title" && $(c.label_area).hasClass("reqd") && c.$wrapper.find(".help-box").html() === "Help <b>x</b>" &&
		!c.$wrapper.find(".help-box").hasClass("hide") && c.$wrapper.children(".tooltip-content").text() === "title" &&
		c.$wrapper.attr("data-fieldname") === "title" && c.$input.attr("maxlength") === "140" && c.$input.attr("data-fieldname") === "title");
	check("mandatory and empty: has-error-mandatory, bold input", c.$wrapper.hasClass("has-error-mandatory") && c.$wrapper.hasClass("has-error") && c.$input.hasClass("bold"));
	check("legacy fields exist: wrapper, input_area, disp_area, label_area, $input_wrapper, input, has_input",
		c.wrapper === c.$wrapper[0] && c.input_area === c.$parts.input_area && c.disp_area && c.label_area && c.$input_wrapper.length === 1 && c.input === c.$input[0] && c.has_input);

	c.set_input("abc");
	check("set_input: value in the input, display area, mandatory cleared", c.$input.val() === "abc" && $(c.disp_area).text() === "abc" && !c.$wrapper.hasClass("has-error-mandatory"));

	const quiet = await mutations(a, () => c.refresh());
	check("refresh() with nothing changed writes no DOM", quiet.length === 0);

	c.$input.val("typed by user");
	c.set_label("Renamed");
	check("a re-render keeps what was typed into the input (the input owns its value)", c.$input.val() === "typed by user" && c.label_span.textContent === "Renamed");
	c.set_input("abc");

	c.df.read_only = 1;
	c.refresh();
	check("read only: input area hidden, display shown, input disabled", $(c.input_area).hasClass("hide") && !$(c.disp_area).hasClass("hide") && c.$input.prop("disabled"));
	c.df.read_only = 0;
	c.df.hidden = 1;
	c.refresh();
	check("hidden: hide-control", c.$wrapper.hasClass("hide-control"));
	c.df.hidden = 0;
	c.refresh();
	check("shown again, writable again", !c.$wrapper.hasClass("hide-control") && !$(c.input_area).hasClass("hide") && !c.$input.prop("disabled"));

	c.toggle_label(false);
	const label_hidden = c.$wrapper.find(".clearfix").hasClass("hide");
	c.toggle_label(true);
	c.set_description("");
	check("toggle_label / set_description(\"\") are state, applied before they return", label_hidden && c.$wrapper.find(".help-box").hasClass("hide") && c.$wrapper.find(".help-box").html() === "");
	c.df.invalid = 1;
	c.set_invalid();
	check("set_invalid: has-error-invalid", c.$wrapper.hasClass("has-error-invalid"));

	const tooltip_clicks = [];
	frappe.utils.copy_to_clipboard = (t) => tooltip_clicks.push(t);
	c.tooltip.trigger("click");
	check("template listener reached through jQuery .trigger()", tooltip_clicks[0] === "title");

	const u = new (Data())({ df: { fieldtype: "Data", fieldname: "site", label: "Site", options: "URL", with_copy_button: 1 }, parent: a, render_input: 1 });
	check("URL field: setup_url_field() switched the template's link button on", u.$link?.length === 1 && u.$link.parent().is(".control-input") && u.$link_open.is("a.btn-open"));
	u.set_input("https://x.test");
	u.$wrapper.find(".action-btn").trigger("click");
	check("copy button part, its handler copies the value", tooltip_clicks.at(-1) === "https://x.test");

	const oi = new (Data())({ df: { fieldtype: "Data", fieldname: "q" }, parent: a, only_input: 1, render_input: 1 });
	check("only_input: form-group frappe-control wrapper with the input straight inside", oi.$wrapper.is(".form-group.frappe-control") && oi.$input.parent()[0] === oi.wrapper && oi.input_area === oi.wrapper);

	const detached = new (Data())({ df: { fieldtype: "Data", fieldname: "later", label: "Later" }, render_input: 1 });
	check("no parent: the wrapper is built detached, for the caller to append", detached.$wrapper.length === 1 && detached.$wrapper.parent().length === 0);
	$(a).append(detached.$wrapper);
	detached.set_label("Placed");
	check("...and after the caller appends it, updates find it", detached.$wrapper.parent()[0] === a && detached.label_span.textContent === "Placed");

	// ------------------------------------------------------------------ C. new inside Vue's flushes
	show_host.value = true;
	await nextTick();
	const m = from_hooks.mounted;
	check("new inside a component's onMounted (post flush): $wrapper placed and $input connected before new returns", m && m.wrapper && m.input && m.label === "In mounted");
	watch_trigger.value++;
	await nextTick();
	check("new inside a watcher (pre flush): DOM ready before new returns", from_hooks.watch?.input === true && from_hooks.watch.label === "In watch");
	check("...and its view's parent is that component (it ran the code and owns the element)", m.c.$fui.view.parent === from_hooks.host);
	show_host.value = false;
	await nextTick();
	check("...so when that component unmounts, the control is destroyed with it", m.c.$fui.destroyed && m.c.$fui.unmounted);

	// ------------------------------------------------------------------ D. legacy subclasses and patches
	class MyData extends frappe.ui.form.ControlData {
		make_input() {
			super.make_input();
			this.$input.addClass("mine");
		}
	}
	const set_label = frappe.ui.form.ControlData.prototype.set_label;
	const patched = [];
	frappe.ui.form.ControlData.prototype.set_label = function (label) {
		patched.push(this.df.fieldname);
		if (this.df.fieldname === "sub") this.df.label = "Patched " + this.df.label;
		return set_label.call(this, label);
	};
	const b = area();
	const s = new MyData({ df: { fieldtype: "Data", fieldname: "sub", label: "Sub" }, parent: b, render_input: 1 });
	check("JS subclass (class extends): instanceof, its make_input override ran on the template input", s instanceof frappe.ui.form.ControlData && s.$input.hasClass("mine") && s.$input.hasClass("form-control"));
	check("prototype patch made after define reaches internal calls (refresh_input -> set_label)", patched.includes("sub") && s.label_span.textContent === "Patched Sub");
	frappe.ui.form.ControlData.prototype.set_label = set_label;
	s.set_bold();
	s.df.bold = 1;
	s.set_bold();
	check("a class jQuery added stays when the binding changes (bold)", s.$input.hasClass("mine") && s.$input.hasClass("bold"));

	const cb = area();
	jq_markup = 0;
	const ck = new frappe.ui.form.ControlCheck({ df: { fieldtype: "Check", fieldname: "agree", label: "Agree", description: "Tick it" }, parent: cb, render_input: 1 });
	check("Check (unported, builds its own wrapper): its markup, in parent", ck.$wrapper.is(".form-group.frappe-control") && ck.$wrapper.find(".checkbox .input-area").length === 1 && ck.$wrapper.parent()[0] === cb);
	check("Check takes the base input: the template's input, drawn into its .input-area", ck.$input.parent().is(".input-area") && ck.$input.attr("type") === "checkbox" && ck.$input[0].isConnected);
	check("Check's removeClass('form-control') holds", !ck.$input.hasClass("form-control") && ck.$input.hasClass("input-with-feedback"));
	check("Check: label, description through its own areas; tooltip part and data-* on its wrapper",
		$(ck.label_area).text() === "Agree" && ck.$wrapper.find(".help-box").text() === "Tick it" &&
		ck.$wrapper.children(".tooltip-content").text() === "agree" && ck.$wrapper.attr("data-fieldtype") === "Check");
	check("Check: the only markup jQuery parsed is its own wrapper", jq_markup === 1);
	ck.set_input(1);
	check("Check set_input(1) ticks it; get_value() reads it", ck.input.checked && ck.get_value() === 1);
	ck.df.reqd = 1;
	ck.refresh();
	check("Check after a re-render (bold): form-control still removed, bold applied", !ck.$input.hasClass("form-control") && ck.$input.hasClass("bold"));
	ck.df.read_only = 1;
	ck.refresh();
	check("Check read only: the template input disabled", ck.$input.prop("disabled") === true);

	const lk = new frappe.ui.form.ControlLink({ df: { fieldtype: "Link", fieldname: "customer", label: "Customer", options: "Customer" }, parent: b, render_input: 1 });
	check("Link (unported, builds its own input) inside the template's input area; template input not drawn",
		lk.$input.parent().is(".link-field") && $(lk.input_area).find("input").length === 1 && lk.$input.attr("data-target") === "Customer" && lk.$input.attr("maxlength") === "140");
	lk.df.read_only = 1;
	lk.refresh();
	check("Link read only: its own input disabled through the legacy path, display shown", lk.$input.prop("disabled") === true && !$(lk.disp_area).hasClass("hide"));

	// ------------------------------------------------------------------ E. one tree: provide/inject, errors
	const root_probe = new frappe.ui.ProbeChild({ parent: area() });
	check("app.provide reaches an imperative controller drawn where no controller is", root_probe.$el.textContent === "light|no-section|0");

	const sa = area();
	const sec = new frappe.ui.Section({
		parent: sa,
		label: "Sec",
		probe: true,
		df_list: [
			{ fieldtype: "Data", fieldname: "f1", label: "F1" },
			{ fieldtype: "Data", fieldname: "f2", label: "F2", reqd: 1 },
			{ fieldtype: "Data", fieldname: "f3", label: "F3" },
		],
	});
	const f2 = sec.fields_dict.f2;
	check("parent template draws child classes: 3 ControlData ready (with $input) when new Section returns",
		Object.keys(sec.fields_dict).join() === "f1,f2,f3" && f2.$input?.[0]?.isConnected && $(sec.body).children(".frappe-control").length === 3);
	check("children's mounted() before the parent's (Vue's order)", sec.fields_at_mounted.join() === "f1,f2,f3");
	check("a template child's view is an ordinary child component of the section's view", f2.$fui.view.parent === sec.$fui.view);
	check("parent controller's provide reaches a template-drawn child class", $(sec.$el).find(".probe-child").text() === "light|Sec|0");
	const imp = new frappe.ui.ProbeChild({ parent: sec.body });
	check("...and an imperative `new` into the section's body: parent instance is the section's view, inject works",
		imp.$el.textContent === "light|Sec|0" && imp.$fui.view.parent === sec.$fui.view && imp.$fui.view.root === sec.$fui.view.root && imp.$el.parentNode === sec.body);
	imp.bump();
	check("an imperative child's flush() updates it", imp.$el.textContent === "light|Sec|1");

	const f4 = sec.add_field({ fieldtype: "Data", fieldname: "f4", label: "F4" });
	check("add_field: the template draws one more, ready when add_field returns", f4?.$input?.[0]?.isConnected && f4.label_span.textContent === "F4");
	sec.remove_field("f1");
	const f1 = sec.fields_dict.f1;
	check("remove_field: the template drops it, its controller is destroyed", f1.$fui.destroyed && !f1.$wrapper[0].isConnected);

	const seen = [];
	app.config.errorHandler = (err, vm) => seen.push([err.message, vm]);
	const err_probe = new frappe.ui.ProbeChild({ parent: sec.body });
	$(err_probe.$el).trigger("dblclick");
	check("a template listener's error goes to app.config.errorHandler (set after boot), with the one tree above it",
		seen[0]?.[0] === "handler failed" && seen[0][1].$parent === sec.$fui.view.proxy);
	let thrown = null;
	const fa = area();
	try {
		new frappe.ui.Failing({ parent: fa, boom: 1 });
	} catch (e) {
		thrown = e;
	}
	let thrown2 = null;
	try {
		new frappe.ui.Failing({ parent: fa, will_throw: 1 });
	} catch (e) {
		thrown2 = e;
	}
	check("an error in created() or in the first render makes `new` throw, and leaves no DOM", thrown?.message === "boom in created" && thrown2 instanceof TypeError && fa.childNodes.length === 0);

	const sh = new frappe.ui.SlotHost({ parent: area() });
	sh.n = 5;
	sh.flush();
	check("flush() also runs a child component's own render (state read only in its slot)", $(sh.$el).find(".n").text() === "5");

	const nest = new frappe.ui.Nest({ parent: area() });
	check("new inside a view's setup (created(), during Vue's patch) into a detached div: DOM ready at once, owned by that view",
		nest.inner_ready?.startsWith("light|") && nest.inner.$fui.owner === nest.$fui && $(nest.$el).find(".probe-child").length === 1);
	check("LIMIT: ...but its Vue parent is the nearest rendered ancestor, so the not-yet-rendered view's own provide is missed",
		nest.inner_ready === "light|no-section|0" && nest.inner.$fui.view.parent !== nest.$fui.view);
	$(nest.$el).remove();
	check("...and goes when that view goes", nest.inner.$fui.destroyed);

	// ------------------------------------------------------------------ F. jQuery removes DOM -> destroyed
	const r = area();
	const rows = [1, 2, 3].map((i) => new (Data())({ df: { fieldtype: "Data", fieldname: "r" + i, label: "R" + i }, parent: r, render_input: 1 }));
	rows[0].$wrapper.remove();
	check(".remove() of a control's wrapper destroys it", rows[0].$fui.destroyed && rows[0].$fui.unmounted);
	$(r).empty();
	check(".empty() of the host destroys the rest", rows[1].$fui.destroyed && rows[2].$fui.destroyed && r.childNodes.length === 0);
	ck.$wrapper.remove();
	check("Check: .remove() of the wrapper it built destroys it, and its view's placeholder nodes go too", ck.$fui.destroyed && cb.childNodes.length === 0);
	f2.$wrapper.remove();
	check("a template-drawn child removed by jQuery is destroyed; the section draws nothing for it", f2.$fui.destroyed && !f2.$wrapper[0].isConnected);
	sec.label = "Sec2";
	sec.flush();
	check("...and the section still renders fine afterwards", $(sec.$el).find(".section-head").text() === "Sec2" && $(sec.body).children(".frappe-control").length === 2);
	const f3 = sec.fields_dict.f3;
	$(sec.$el).remove();
	check("removing the section destroys it, its template children and its imperative children",
		sec.$fui.destroyed && f3.$fui.destroyed && imp.$fui.destroyed && err_probe.$fui.destroyed && !sec.$fui.owned?.size);
	const ph_host = area();
	const ph = new frappe.ui.SlotHost({ parent: ph_host });
	ph.show = false;
	ph.flush();
	$(ph_host).html("");
	check("a view showing only a placeholder is destroyed when its host is emptied with .html()", ph.$fui.destroyed);

	// ------------------------------------------------------------------ H. grafts (SPEC.md section 12)
	{
		// H1. rows with a child component: set every row, then flush every row (views wait apart from Vue's queue)
		const ka = area();
		const kids = Array.from({ length: 300 }, (_, i) => new frappe.ui.RowKid({ parent: ka, label: "r" + i }));
		kids.forEach((r, i) => (r.count = i + 1));
		kids.forEach((r) => r.flush());
		const badges = ka.querySelectorAll(".badge");
		check("set every RowKid, then flush every one: each child Badge is current when flush() returns", badges.length === 300 && badges[299].textContent === "300" && badges[0].textContent === "1");
		kids[5].count = 99;
		await nextTick();
		check("a set without flush() is drawn at Vue's tick (the apart pre job)", badges[5].textContent === "99");
		$(ka).remove();

		// H1b. at the tick, a view renders after its own pre watchers (Vue's order for a component)
		const pk = new frappe.ui.Picker({ parent: area() });
		const errs = [];
		const cerr = console.error, cwarn = console.warn;
		console.error = console.warn = (...a) => errs.push(a.join(" "));
		pk.items = ["x"];
		await nextTick();
		console.error = cerr;
		console.warn = cwarn;
		check("a set without flush(): the view's own pre watcher runs before its tick render", pk.$el.textContent === "X" && errs.length === 0);
		$(pk.$el).remove();

		// H2. new from inside a render does not subscribe that render to the control's state
		const warns = [];
		const warn = console.warn;
		console.warn = (...a) => (warns.push(a.join(" ")), warn(...a));
		const rn = new frappe.ui.RenderNew({ parent: area() });
		const first = rn.kids[0];
		check("new inside a render returns with its DOM", rn.$el.textContent.includes("ready") && first.$input[0] && first.label_span.textContent === "RN");
		first.set_input("changed");
		first.df.reqd = 1;
		first.refresh();
		await nextTick();
		await nextTick();
		console.warn = warn;
		check("...and changing that control does not re-run the render that made it (no loop)", rn.calls === 1 && !warns.some((w) => /recursive/i.test(w)));
		$(rn.$el).remove();

		// H3. frappe.ui.sweep(): native removal destroys a controller that holds something outside itself
		// (here a watch on a store), .detach() spares
		const sa = area();
		const sc = new (Watched())({ df: { fieldtype: "Data", fieldname: "sw", label: "Sw" }, parent: sa, render_input: 1 });
		const sb = area();
		const sd = new (Watched())({ df: { fieldtype: "Data", fieldname: "sd", label: "Sd" }, parent: sb, render_input: 1 });
		frappe.ui.sweep();
		sa.remove(); // native, no jQuery
		const $sb = $(sb).detach();
		const n_swept = frappe.ui.sweep();
		check("sweep() destroys a control with a store watcher whose DOM was removed natively", sc.$fui.destroyed && n_swept >= 1);
		check("...and spares one taken out with .detach()", !sd.$fui.destroyed);
		$sb.appendTo("body");
		sd.set_input("back");
		check("...which works again when put back", sd.$input.val() === "back");
		$sb.remove();
		check("...and is destroyed by jQuery removal as usual", sd.$fui.destroyed);

		// H3b. a control that holds nothing outside is never swept: frappe's filter popover removes its
		// panel natively and appends the kept rows to a new panel on the next open
		const panel = area();
		const rows = $("<div class='rows'>").appendTo(panel)[0];
		const pc = new (Data())({ df: { fieldtype: "Data", fieldname: "pc", label: "Pc" }, parent: rows, render_input: 1 });
		frappe.ui.sweep();
		panel.remove(); // close: native
		frappe.ui.sweep();
		frappe.ui.sweep();
		area().appendChild(rows); // open again: the same rows, native
		pc.set_input("reopened");
		check("H3b a plain control removed natively and put back natively is not destroyed by sweep", !pc.$fui.destroyed && pc.$input.val() === "reopened" && pc.$wrapper[0].isConnected);
		$(rows).remove();
	}

	// ------------------------------------------------------------------ I. port coverage: the legacy behaviour the prototype had simplified
	{
		const pa = area();
		const make = (df, extra = {}) => new (Data())({ df: { fieldtype: "Data", ...df }, parent: pa, render_input: 1, ...extra });
		const errors = [];
		const err = console.error;

		// perm: getter from frm, legacy setter only logs
		console.error = (...a) => errors.push(a.join(" "));
		const pc = make({ fieldname: "p1", label: "P1" }, { frm: { perm: [{ read: 1 }] } });
		pc.perm = "x";
		console.error = err;
		check("perm reads frm.perm; setting it logs and keeps it", pc.perm[0].read === 1 && /isn't supported/.test(errors[0] || ""));

		// get_status: the frm/perm branch (doctype + docname)
		frappe.perm = { get_field_display_status: (df) => (df.fieldname === "ro" ? "Read" : "Write") };
		frappe.model.get_doc = () => ({});
		const ro = make({ fieldname: "ro", label: "RO" }, { doctype: "Item", docname: "I-1" });
		check("get_status: doctype/docname go through frappe.perm.get_field_display_status", ro.get_status() === "Read" && $(ro.input_area).hasClass("hide") && !$(ro.disp_area).hasClass("hide"));
		const grid_ro = make({ fieldname: "gw", label: "GW" }, { doctype: "Item", docname: "I-1", grid: { display_status: "Read" } });
		check("get_status: a Write field in a read-only grid reads as Read", grid_ro.get_status() === "Read");
		frappe.defaults.is_enabled = (k) => k === "hide_empty_read_only_fields";
		const empty_ro = make({ fieldname: "ro", label: "Empty RO" }, { doctype: "Item", docname: "I-1" });
		check("get_status: hide_empty_read_only_fields hides an empty read-only field (hide-control)", empty_ro.get_status() === "None" && empty_ro.$wrapper.hasClass("hide-control"));
		frappe.defaults.is_enabled = () => false;

		// fetch_from read only: the display's title
		const ff = make({ fieldname: "ff", label: "FF", fetch_from: "customer.customer_name" }, { frm: { doc: { customer: "C1" } } });
		check("fetch_from: read only with the 'fetched from' title on the display", $(ff.disp_area).attr("title") === "This value is fetched from customer's customer_name field" && $(ff.input_area).hasClass("hide"));

		// description: code highlighting, set_new_description, toggle_description
		const highlighted = [];
		global.hljs = { highlightElement: (el) => highlighted.push(el.textContent) };
		const cd = make({ fieldname: "cd", label: "CD", description: "Use <code>frappe.call</code>" });
		await new Promise((r) => setTimeout(r, 0));
		check("description with <code>: highlighted after syntax_highlighting loads, displayed inline", highlighted[0] === "frappe.call" && cd.$wrapper.find(".help-box code")[0].style.display === "inline");
		cd.set_new_description("<b>New</b>");
		const shown = cd.$wrapper.find(".help-box").html() === "<b>New</b>" && !cd.$wrapper.find(".help-box").hasClass("hide");
		cd.set_empty_description();
		check("set_new_description / set_empty_description", shown && cd.$wrapper.find(".help-box").html() === "" && cd.$wrapper.find(".help-box").hasClass("hide"));
		cd.toggle_description(true);
		check("toggle_description(true) shows the box", !cd.$wrapper.find(".help-box").hasClass("hide"));

		// InfoCard: documentation_url and show_description_on_click (frappe's info_card.js, unchanged)
		const cards = [];
		frappe.ui.Card = class { constructor(o) { this.o = o; cards.push(o); } toggle() { this.open = !this.open; } hide() { this.open = false; } };
		const doc_url = make({ fieldname: "du", label: "Doc URL", documentation_url: "https://docs.test/x" });
		const trigger = $(doc_url.label_span).find("svg.info-trigger, svg");
		check("documentation_url: InfoCard puts its trigger and card into the template's label", trigger.length === 1 && $(doc_url.label_span).find(".info-card").length === 1 && /View Documentation/.test(cards.at(-1).message) && doc_url.label_span.textContent.startsWith("Doc URL"));
		doc_url.df.reqd = 1;
		doc_url.refresh();
		check("...and the label's re-render (reqd) keeps them", $(doc_url.label_span).find(".info-card").length === 1 && $(doc_url.label_area).hasClass("reqd"));
		const on_click = make({ fieldname: "oc", label: "On click", description: "Hidden help", show_description_on_click: 1 });
		check("show_description_on_click: the description goes into an InfoCard, not the help box", cards.at(-1).message === "Hidden help" && on_click.$wrapper.find(".help-box").hasClass("hide") && $(on_click.label_span).find(".info-card").length === 1);

		// translatable: the button in the label row, drawn by the template, opens the TranslationManager
		const opened = [];
		frappe.views = { TranslationManager: class { constructor(o) { opened.push(o.source_text); } } };
		const get_value = frappe.model.get_value;
		frappe.model.get_value = (dt, dn, f) => (f === "tr" ? "Hello" : undefined);
		const tr = make({ fieldname: "tr", label: "TR", translatable: 1 }, { frm: { doc: {} }, doc: { tr: "Hello" }, doctype: "Item", docname: "I-1" });
		const $btn = tr.$wrapper.find(".clearfix .btn-translation");
		$btn.trigger("click");
		check("translatable: the template's button in the label row opens the TranslationManager", $btn.length === 1 && opened[0] === "Hello");
		tr.refresh();
		check("...drawn once", tr.$wrapper.find(".btn-translation").length === 1);
		delete frappe.views;
		frappe.model.get_value = get_value;

		// barcode, IBAN
		frappe.ui.Scanner = class { constructor(o) { o.on_scan({ result: { text: "SCAN-1" } }); } };
		const bc = make({ fieldname: "bc", label: "BC", options: "Barcode" });
		bc.$scan_btn.find("a").trigger("click");
		await new Promise((r) => setTimeout(r, 0));
		check("Barcode: the scan button part, its click scans into the value", bc.$scan_btn.is(".link-btn") && bc.$scan_btn.parent().is(".control-input") && bc.get_value() === "SCAN-1");
		const ib = make({ fieldname: "ib", label: "IBAN", options: "IBAN" });
		ib.$input.val("DE89370400440532013000").trigger("blur");
		check("IBAN: formatted on blur, parsed without spaces", ib.$input.val() === "DE89 3704 0044 0532 0130 00" && ib.get_value() === "DE89370400440532013000");

		// validate: email, phone
		const em = make({ fieldname: "em", label: "Email", options: "Email" });
		await em.set_value("not an email");
		check("validate: an invalid Email sets df.invalid and has-error-invalid", em.df.invalid === true && em.$wrapper.hasClass("has-error-invalid"));
		await em.set_value("a@b.c");
		check("...a valid one clears it", em.df.invalid === false && !em.$wrapper.hasClass("has-error-invalid"));

		// set_input_attributes: input_css, input_class, alignment, placeholder, data-doctype; singles skip
		const at = make({ fieldname: "at", label: "AT", input_css: { color: "red" }, input_class: "extra", alignment: "Right", placeholder: "Type" }, { doctype: "Item" });
		check("input_css, input_class, alignment, placeholder, data-doctype on the template's input",
			at.input.style.color === "red" && at.input.style.textAlign === "right" && at.$input.hasClass("extra") && at.$input.attr("placeholder") === "Type" && at.$input.attr("data-doctype") === "Item");
		const single = make({ fieldname: "sg", label: "SG" }, { frm: { meta: { issingle: 1 } } });
		check("a Single's Data field gets no maxlength (legacy skip)", single.$input.attr("maxlength") === undefined && single.$input.attr("data-fieldname") === undefined);

		// grid: set_invalid marks the grid cell and the input
		const cell = $("<div class='grid-static-col'>").appendTo(pa)[0];
		const gc = new (Data())({ df: { fieldtype: "Data", fieldname: "gi", label: "GI", invalid: 1 }, parent: cell, render_input: 1, grid: {}, grid_row: { columns: { gi: {} } } });
		gc.set_invalid();
		check("set_invalid in a grid: the cell and the input get 'invalid', the column is_invalid", $(cell).hasClass("invalid") && gc.$input.hasClass("invalid") && gc.grid_row.columns.gi.is_invalid === true);

		// toggle(), initial_value, on_make, label "&nbsp;"
		let made = 0;
		const iv = make({ fieldname: "iv", label: "IV", initial_value: "start", on_make: () => made++ });
		await new Promise((r) => setTimeout(r, 0));
		check("initial_value set at make; df.on_make called once", iv.get_value() === "start" && made === 1);
		iv.toggle(false);
		const hidden = iv.$wrapper.hasClass("hide-control");
		iv.toggle(true);
		check("toggle(false/true)", hidden && !iv.$wrapper.hasClass("hide-control"));
		iv.set_label(" ");
		check("set_label with a label: df.label updated and drawn", iv.df.label === " " && iv.label_span.innerHTML === " ");

		// Switch (frappe's switch.js, unported): its own wrapper, takes the base input
		frappe.ui.form.ControlSwitch = class ControlSwitch extends frappe.ui.form.ControlCheck {
			make_input() { super.make_input(); this.$input.attr("role", "switch"); }
			make_wrapper() {
				this.$wrapper = $(`<div class="form-group frappe-control"><label class="switch-control"><span class="switch-text"><span class="label-area"></span><span class="disp-area"></span><div class="help-box small text-extra-muted hide"></div></span><span class="input-area"></span><span class="switch-visual"></span><span class="ml-1 help"></span></label></div>`).appendTo(this.parent);
			}
		};
		const sw = new frappe.ui.form.ControlSwitch({ df: { fieldtype: "Switch", fieldname: "sw1", label: "Sw", description: "d" }, parent: pa, render_input: 1 });
		sw.set_input(1);
		check("Switch: a real checkbox with role=switch in its .input-area, ticked; label and description in its spans",
			sw.input.type === "checkbox" && sw.$input.attr("role") === "switch" && sw.$input.parent().is(".input-area") && sw.input.checked && $(sw.label_area).text() === "Sw" && sw.$wrapper.find(".help-box").text() === "d" && !sw.$wrapper.find(".help-box").hasClass("hide"));
		$(pa).remove();
	}


	// ------------------------------------------------------------------ J. fixes from the v8 break reports
	{
		const ja = area();
		// J1. a control reached through Vue reactive state (frappe's form builder keeps frm in a ref())
		const jc = new (Data())({ df: { fieldtype: "Data", fieldname: "j1", label: "J1" }, parent: ja, render_input: 1 });
		const held = reactive({ c: jc });
		const via_ref = ref(jc);
		let j1_error = null;
		try {
			held.c.df.label = "Through proxy";
			held.c.refresh();
			held.c.set_input("via proxy");
			await via_ref.value.set_value("via ref");
			via_ref.value.flush();
		} catch (e) {
			j1_error = e;
		}
		check("J1 a control inside reactive()/ref(): refresh, set_input, set_value and flush work, $fui is the controller's own",
			!j1_error && held.c.$fui === jc.$fui && jc.label_span.textContent === "Through proxy" && jc.$input.val() === "via ref");
		held.c.$wrapper.remove();
		check("J1 ...and jQuery removal through the proxy destroys it once", jc.$fui.destroyed);

		// J2. template-drawn children that Vue mounts on its own schedule (state set, no flush())
		const ts = new frappe.ui.Section({ parent: area() });
		ts.fields = [
			{ fieldtype: "Data", fieldname: "t1", label: "T1" },
			{ fieldtype: "Data", fieldname: "t2", label: "T2" },
		];
		const j2_errors = [];
		const handler = app.config.errorHandler;
		app.config.errorHandler = (e) => j2_errors.push(e.message);
		await nextTick();
		await nextTick();
		check("J2 children drawn by a parent's template at Vue's tick: mounted() ran for each, with wrapper and input",
			j2_errors.length === 0 && ts.ready_order.join() === "t1,t2" && $(ts.body).find(".frappe-control input").length === 2 && ts.fields_dict.t2.$input[0].isConnected);

		// J3. a control refreshed from a descendant's onMounted gets its input (flush() is not a no-op there)
		const jr = new (Data())({ df: { fieldtype: "Data", fieldname: "j3", label: "J3" }, parent: ja, render_input: 0 });
		let seen = null;
		new frappe.ui.Kid({
			parent: jr.$parts.input_wrapper,
			on_mounted() {
				jr.df.label = "Relabelled";
				jr.refresh();
				seen = { input: !!jr.input && jr.$input[0] === jr.input && jr.input.isConnected, label: jr.label_span.textContent };
			},
		});
		await nextTick();
		await nextTick();
		jr.set_input("works");
		check("J3 refresh() from a child's onMounted draws the input at once; $input is the drawn input",
			seen?.input === true && seen.label === "Relabelled" && $(jr.input_area).find("input").val() === "works");

		// J4. one failing mounted() among template-drawn siblings does not strand the later ones
		const fs = new frappe.ui.Section({ parent: area() });
		fs.fields = [
			{ fieldtype: "Data", fieldname: "a", label: "A" },
			{ fieldtype: "Data", fieldname: "b", label: "B", on_make() { throw new Error("on_make b"); } },
			{ fieldtype: "Data", fieldname: "c", label: "C" },
		];
		let j4 = null;
		try {
			fs.flush();
		} catch (e) {
			j4 = e.message;
		}
		check("J4 flush() rethrows a child's mounted() error, and the later sibling is still made", j4 === "on_make b" && fs.ready_order.join() === "a,c" && fs.fields_dict.c.$input[0].isConnected);
		app.config.errorHandler = handler;

		// J5. a plain component builds controls into a detached element and puts it elsewhere (frappe.ui.Dialog
		// builds its fields into a detached modal and appends it to <body> on show())
		const dlg = {};
		j_comp.value = {
			name: "Panel",
			setup() {
				const el = ref(null);
				onMounted(() => {
					const modal = document.createElement("div");
					dlg.placed = new (Data())({ df: { fieldtype: "Data", fieldname: "note", label: "Note" }, parent: modal, render_input: 1 });
					dlg.modal = modal;
					const kept = document.createElement("div");
					dlg.unplaced = new (Data())({ df: { fieldtype: "Data", fieldname: "later", label: "Later" }, parent: kept, render_input: 1 });
					const inside = document.createElement("div");
					dlg.inside = new (Data())({ df: { fieldtype: "Data", fieldname: "inside", label: "Inside" }, parent: inside, render_input: 1 });
					el.value.appendChild(inside);
				});
				return () => h("div", { class: "panel", ref: el });
			},
		};
		await nextTick();
		document.body.appendChild(dlg.modal); // show()
		j_comp.value = null; // the panel goes
		await nextTick();
		dlg.placed.set_input("still here");
		check("J5 controls made in a component's hook into a detached host, then placed elsewhere, outlive that component",
			!dlg.placed.$fui.destroyed && dlg.placed.$wrapper[0].isConnected && dlg.placed.$input.val() === "still here" && !dlg.unplaced.$fui.destroyed);
		check("J5 ...while one it put into its own DOM goes with it", dlg.inside.$fui.destroyed);
		$(dlg.modal).remove();

		// J6. app-registered components named like native inputs don't replace the control's input
		app.component("Select", { name: "DeskSelect", render: () => h("div", { class: "desk-select" }) });
		app.component("Textarea", { name: "DeskTextarea", render: () => h("div", { class: "desk-textarea" }) });
		app.component("Input", { name: "DeskInput", render: () => h("div", { class: "desk-input" }) });
		class JSelect extends frappe.ui.form.ControlData {
			static html_element = "select";
		}
		class JText extends frappe.ui.form.ControlData {
			static html_element = "textarea";
		}
		const js = new JSelect({ df: { fieldtype: "Select", fieldname: "js", label: "JS" }, parent: ja, render_input: 1 });
		const jt = new JText({ df: { fieldtype: "Text", fieldname: "jt", label: "JT" }, parent: ja, render_input: 1 });
		const ji = new (Data())({ df: { fieldtype: "Data", fieldname: "ji", label: "JI" }, parent: ja, render_input: 1 });
		check("J6 with Select/Textarea/Input registered on the app, inputs stay native select/textarea/input (type as an attribute)",
			js.input.tagName === "SELECT" && jt.input.tagName === "TEXTAREA" && ji.input.tagName === "INPUT" && js.$input.attr("type") === "text");
		delete app._context.components.Select;
		delete app._context.components.Textarea;
		delete app._context.components.Input;

		// J7. refresh() puts back what the template drew, as legacy refresh() rewrote it
		ji.$wrapper.addClass("hide-control");
		ji.$input.prop("disabled", true);
		ji.refresh();
		check("J7 refresh() removes an outside hide-control and re-enables an outside-disabled input", !ji.$wrapper.hasClass("hide-control") && !ji.$input.prop("disabled"));
		const quiet = await mutations(ja, () => ji.refresh());
		check("J7 ...and still writes no DOM when nothing differs", quiet.length === 0);

		// J8. an error boundary above the creating component does not stop `new` from throwing
		const j8 = {};
		const Maker = {
			setup() {
				const el = ref(null);
				onMounted(() => {
					try {
						j8.c = new frappe.ui.Failing({ parent: el.value, will_throw: 1 });
					} catch (e) {
						j8.threw = e;
					}
				});
				return () => h("div", { ref: el });
			},
		};
		j_comp.value = {
			name: "Boundary",
			setup() {
				onErrorCaptured((e) => {
					j8.captured = e;
					return false;
				});
				return () => h(Maker);
			},
		};
		await nextTick();
		await nextTick();
		check("J8 under an errorCaptured boundary that returns false, `new` still throws the render error and leaves nothing",
			j8.threw instanceof TypeError && !j8.c);
		j_comp.value = null;
		await nextTick();

		// J9. .detach(), put back, then removed natively with its container: sweep destroys it
		const box = area();
		const da = new (Watched())({ df: { fieldtype: "Data", fieldname: "da", label: "Da" }, parent: box, render_input: 1 });
		const db = new (Watched())({ df: { fieldtype: "Data", fieldname: "db", label: "Db" }, parent: box, render_input: 1 });
		frappe.ui.sweep();
		da.$wrapper.detach().appendTo(box);
		frappe.ui.sweep();
		box.remove();
		frappe.ui.sweep();
		check("J9 a control detached once and put back is destroyed when its container goes natively", da.$fui.destroyed && db.$fui.destroyed);
		const kept = area();
		const dk = new (Watched())({ df: { fieldtype: "Data", fieldname: "dk", label: "Dk" }, parent: kept, render_input: 1 });
		frappe.ui.sweep();
		const $kept = $(kept).detach();
		frappe.ui.sweep();
		check("J9 ...while one still out with .detach() is spared", !dk.$fui.destroyed);
		$kept.remove();
		$(ja).remove();
		$(ts.$el).remove();
		$(fs.$el).remove();
	}

	// ------------------------------------------------------------------ G. garbage collection
	if (global.gc) {
		const refs = [];
		(() => {
			const kept = area();
			for (let i = 0; i < 200; i++) refs.push(new WeakRef(new (Data())({ df: { fieldtype: "Data", fieldname: "g" + i, label: "G" }, parent: kept, render_input: 1 })));
			$(kept).remove();
			let loose = document.createElement("div");
			for (let i = 0; i < 200; i++) refs.push(new WeakRef(new (Data())({ df: { fieldtype: "Data", fieldname: "l" + i, label: "L" }, parent: loose, render_input: 1 })));
			const in_section = new frappe.ui.Section({ parent: area(), df_list: [{ fieldtype: "Data", fieldname: "z", label: "Z" }] });
			refs.push(new WeakRef(in_section), new WeakRef(in_section.fields_dict.z));
			$(in_section.$el).remove();
			loose = null;
		})();
		for (let i = 0; i < 6; i++) {
			await new Promise((r) => setTimeout(r, 10));
			global.gc();
		}
		const alive = refs.filter((r) => r.deref()).length;
		check(`dropped controllers are collected: removed by jQuery, or never attached (${alive} of ${refs.length} alive)`, alive === 0);
	} else console.log("skip GC check: run with --expose-gc");

	console.log(`\n${pass} passed, ${fail} failed`);
	if (fail) console.log("failed: " + failures.join(" | "));
	process.exit(fail ? 1 : 0);
})().catch((e) => {
	console.error(e);
	process.exit(2);
});
