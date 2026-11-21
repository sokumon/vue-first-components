// Regression checks for the defects the two v8 break reports found (run in v8 mode):
//   F1  controls reached through Vue reactive state ($fui Proxy invariant): Customize Form's Form Builder
//       Update saves a description; typing in a Form Builder Code property raises nothing
//   F2  flush() inside lifecycle hooks: template-drawn children mounted at Vue's tick; refresh() from a
//       descendant's onMounted draws the input
//   F3  ownership: a Dialog prepared in a Vue component's hook keeps its fields after that component goes
//   F4  app-registered Select/Textarea/Input do not replace control inputs
//   F5  one failing template child's mounted() does not strand later siblings
//   F6  "set state, let the tick render" stays linear for rows whose child takes props
//   F7  refresh() puts back hide-control / disabled changed from outside
//   F8  an error boundary does not stop `new` from throwing
//   F9  a controller once .detach()ed is swept when its container is removed natively
//   F10 sweep leaves plain controls alone: the list filter popover's kept rows survive a sweep while
//       the panel is closed (frappe's suite hit this as an intermittent control_attach failure)
const { open } = require("./session.cjs");
let pass = 0, fail = 0;
const check = (name, ok, info) => {
	ok ? pass++ : fail++;
	console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && info !== undefined ? "  " + JSON.stringify(info).slice(0, 400) : ""}`);
};
(async () => {
	const { browser, page, errors, base } = await open();
	const q = (fn, arg) => page.evaluate(fn, arg);
	const desk = async (route) => {
		await page.goto(base + route, { waitUntil: "load" });
		await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 30000 });
		await page.waitForTimeout(1500);
	};
	const delete_setters = () =>
		q(async () => {
			const r = (await frappe.call("frappe.client.get_list", { doctype: "Property Setter", filters: { doc_type: "Note", field_name: "title", property: "description" }, fields: ["name"] })).message;
			for (const x of r) await frappe.xcall("frappe.client.delete", { doctype: "Property Setter", name: x.name }).catch((e) => console.error("delete", x.name, e?.message || e));
		});

	// ---------------------------------------------------------------- F1 Form Builder (Customize Form)
	await desk("/desk/customize-form");
	await delete_setters();
	await page.waitForFunction(() => cur_frm?.doctype === "Customize Form");
	await q(() => cur_frm.set_value("doc_type", "Note"));
	await page.waitForTimeout(3500);
	const start_errors = errors.length;
	await page.locator(".form-builder-container .field", { hasText: "Title" }).first().click();
	await page.waitForTimeout(1000);
	// a Code property (depends_on): CodeControl.vue keeps its control in a ref()
	const ace = page.locator('.form-builder-container .frappe-control[data-fieldname="depends_on"] .ace_text-input').first();
	await ace.focus();
	await page.keyboard.type("eval:1");
	await page.waitForTimeout(800);
	for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace");
	await page.waitForTimeout(800);
	const desc = page.locator('.form-builder-container [data-fieldname="description"] textarea').first();
	await desc.click();
	await page.keyboard.type("v8 probe");
	await page.keyboard.press("Tab");
	await page.waitForTimeout(800);
	await page.getByRole("button", { name: "Update" }).click();
	await page.waitForTimeout(4000);
	const ps = await q(async () => (await frappe.call("frappe.client.get_list", { doctype: "Property Setter", filters: { doc_type: "Note", field_name: "title", property: "description" }, fields: ["value"] })).message);
	const fb_errors = errors.slice(start_errors);
	check("F1 Form Builder: typing in a Code property and in Description, then Update, saves the Property Setter with no errors", ps.length === 1 && ps[0].value === "v8 probe" && fb_errors.length === 0, { ps, fb_errors });
	await delete_setters();
	const proxied = await q(() => {
		const { reactive, ref } = __vue_first.Vue;
		const c = cur_frm.fields_dict.doc_type;
		try {
			const r = reactive({ frm: cur_frm });
			r.frm.fields_dict.doc_type.refresh();
			r.frm.refresh_field("doc_type");
			ref(c).value.set_input("Note");
			return { ok: r.frm.fields_dict.doc_type.$fui === c.$fui };
		} catch (e) {
			return { error: e.message };
		}
	});
	check("F1 a form control through reactive()/ref(): refresh, refresh_field, set_input work", proxied.ok === true, proxied);

	// ---------------------------------------------------------------- F2..F9 on a plain desk page
	await desk("/desk/todo");
	const r = await q(async () => {
		const { h, nextTick, onMounted, onErrorCaptured } = __vue_first.Vue;
		const o = {};
		const tick = () => new Promise((res) => setTimeout(res, 30));
		const app_errors = [];
		const handler = frappe.ui.app.config.errorHandler;
		frappe.ui.app.config.errorHandler = (e) => app_errors.push(e.message);

		// F2a: children drawn by a parent's render, mounted by Vue at its tick (no flush())
		const Field = frappe.ui.view_of(frappe.ui.form.ControlData);
		frappe.ui.define({
			name: "frappe.ui.P8Section",
			data() {
				return { fields: [] };
			},
			created() {
				this.ready = [];
			},
			render(ctx) {
				return h("div", { class: "p8-section" }, ctx.fields.map((df) => h(Field, { key: df.fieldname, df, render_input: 1, onReady: (c) => ctx.ready.push(c.df.fieldname) })));
			},
		});
		const s = new frappe.ui.P8Section({ parent: $("<div>").appendTo(document.body) });
		s.fields = [{ fieldtype: "Data", fieldname: "a", label: "A" }, { fieldtype: "Data", fieldname: "b", label: "B" }];
		await nextTick();
		await tick();
		o.F2a = { ready: s.ready.join(), inputs: s.$el.querySelectorAll("input").length, errors: app_errors.slice() };
		// F5: one failing mounted() among them
		s.fields = [...s.fields, { fieldtype: "Data", fieldname: "c", label: "C", on_make() { throw new Error("on_make c"); } }, { fieldtype: "Data", fieldname: "d", label: "D" }];
		let threw = null;
		try {
			s.flush();
		} catch (e) {
			threw = e.message;
		}
		o.F5 = { threw, ready: s.ready.join(), inputs: s.$el.querySelectorAll("input").length };
		$(s.$el).remove();

		// F2b: refresh() from a descendant's onMounted
		frappe.ui.define({
			name: "frappe.ui.P8Kid",
			setup(self) {
				onMounted(() => self.on_mounted?.());
				return {};
			},
			render: () => h("span", { class: "p8-kid" }, "kid"),
		});
		const area = $("<div>").appendTo(document.body);
		const ctl = frappe.ui.form.make_control({ df: { fieldtype: "Data", fieldname: "k", label: "K" }, parent: area, render_input: false });
		let seen = null;
		new frappe.ui.P8Kid({
			parent: ctl.$parts.input_wrapper,
			on_mounted() {
				ctl.df.label = "Relabelled";
				ctl.refresh();
				seen = { input: !!ctl.input?.isConnected && ctl.$input[0] === ctl.input, label: ctl.label_span.textContent };
			},
		});
		await nextTick();
		await tick();
		ctl.set_input("works");
		o.F2b = { seen, value: $(ctl.input_area).find("input").val() };

		// F3: a Dialog prepared in a plain component's onMounted outlives that component
		const Panel = {
			name: "Panel",
			setup() {
				onMounted(() => {
					o.dlg = new frappe.ui.Dialog({ title: "Prepared", fields: [{ fieldtype: "Data", fieldname: "note", label: "Note" }, { fieldtype: "Check", fieldname: "ok", label: "OK" }] });
				});
				return () => h("div", { class: "panel" }, "panel");
			},
		};
		frappe.ui.define({ name: "frappe.ui.P8Host", data: () => ({ show: true }), render: (ctx) => h("div", { class: "p8-host" }, ctx.show ? [h(Panel)] : []) });
		const host = new frappe.ui.P8Host({ parent: $("<div>").appendTo(document.body) });
		await tick();
		host.show = false;
		host.flush();
		await tick();
		const d = o.dlg;
		d.show();
		await new Promise((res) => setTimeout(res, 400));
		d.set_value("note", "hello");
		await tick();
		o.F3 = { destroyed: d.fields_list.filter((f) => f.$fui?.destroyed).map((f) => f.df.fieldname), note_connected: !!d.fields_dict.note.$input?.[0]?.isConnected, values: d.get_values(true) };
		d.hide();
		delete o.dlg;

		// F4: app-registered components named like native elements
		frappe.ui.app.component("Select", { name: "DeskSelect", render: () => h("div", { class: "desk-select" }) });
		frappe.ui.app.component("Textarea", { name: "DeskTextarea", render: () => h("div", { class: "desk-textarea" }) });
		frappe.ui.app.component("Input", { name: "DeskInput", render: () => h("div", { class: "desk-input" }) });
		const sel = frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "s", label: "S", options: "a\nb\nc" }, parent: area, render_input: true });
		const txt = frappe.ui.form.make_control({ df: { fieldtype: "Small Text", fieldname: "t", label: "T" }, parent: area, render_input: true });
		const dat = frappe.ui.form.make_control({ df: { fieldtype: "Data", fieldname: "dd", label: "DD" }, parent: area, render_input: true });
		o.F4 = { select: sel.input.tagName, options: sel.$input.find("option").length, text: txt.input.tagName, data: dat.input.tagName };
		for (const k of ["Select", "Textarea", "Input"]) delete frappe.ui.app._context.components[k];

		// F7: refresh() re-applies what legacy refresh re-applied
		dat.$wrapper.addClass("hide-control");
		dat.$input.prop("disabled", true);
		dat.refresh();
		o.F7 = { hide_control: dat.$wrapper.hasClass("hide-control"), disabled: dat.$input.prop("disabled") };

		// F8: an error boundary above the creating component
		frappe.ui.define({ name: "frappe.ui.P8Bad", render: (ctx) => h("div", { class: "p8-bad" }, ctx.explode ? ctx.missing.deep : "ok") });
		const Maker = {
			setup() {
				let el = null;
				onMounted(() => {
					try {
						// a detached host: the view's Vue parent is Maker (below the boundary), not the
						// controller whose DOM holds Maker
						o.F8 = { made: !!new frappe.ui.P8Bad({ parent: document.createElement("div"), explode: true }), el: !!el };
					} catch (e) {
						o.F8 = { threw: e.constructor.name };
					}
				});
				return () => h("div", { ref: (x) => (el = x) });
			},
		};
		const Boundary = {
			setup() {
				onErrorCaptured(() => false);
				return () => h(Maker);
			},
		};
		frappe.ui.define({ name: "frappe.ui.P8BoundaryHost", render: () => h("div", [h(Boundary)]) });
		const bh = new frappe.ui.P8BoundaryHost({ parent: $("<div>").appendTo(document.body) });
		await tick();
		$(bh.$el).remove();

		// F6: rows with a prop-taking child, set all then let the tick render
		const Badge = { props: ["n"], render() { return h("b", { class: "badge" }, this.n); } };
		frappe.ui.define({ name: "frappe.ui.P8KidRow", data: () => ({ count: 0 }), render: (ctx) => h("div", { class: "row-kid" }, [ctx.label, h(Badge, { n: ctx.count })]) });
		const timing = {};
		for (const n of [2000, 8000]) {
			const times = [];
			for (let k = 0; k < 3; k++) {
				const rh = $("<div>").appendTo(document.body)[0];
				const rows = Array.from({ length: n }, (_, i) => new frappe.ui.P8KidRow({ parent: rh, label: "r" + i }));
				await nextTick();
				const t = performance.now();
				rows.forEach((row, i) => (row.count = i + 1));
				await nextTick();
				times.push(performance.now() - t);
				timing["ok" + n] = rh.querySelectorAll(".badge")[n - 1].textContent === String(n);
				$(rh).remove();
				await tick();
			}
			timing[n] = times.sort((a, b) => a - b)[1];
		}
		o.F6 = timing;
		area.remove();
		frappe.ui.app.config.errorHandler = handler;
		o.app_errors = app_errors;
		return o;
	});
	check("F2 children a parent's render draws are mounted at Vue's tick (no flush()), each with its input", r.F2a.ready === "a,b" && r.F2a.inputs === 2 && r.F2a.errors.length === 0, r.F2a);
	check("F2 refresh() from a descendant's onMounted draws the input at once, and $input is it", r.F2b.seen?.input === true && r.F2b.seen.label === "Relabelled" && r.F2b.value === "works", r.F2b);
	check("F3 a Dialog prepared in a component's onMounted keeps its fields after the component goes", r.F3.destroyed.length === 0 && r.F3.note_connected && r.F3.values.note === "hello", r.F3);
	check("F4 app-registered Select/Textarea/Input do not replace the controls' native elements", r.F4.select === "SELECT" && r.F4.options === 3 && r.F4.text === "TEXTAREA" && r.F4.data === "INPUT", r.F4);
	check("F5 a failing mounted() rethrows from flush() and the later sibling is still made", r.F5.threw === "on_make c" && r.F5.ready === "a,b,d" && r.F5.inputs === 4, r.F5);
	check("F6 set all rows then the tick: linear (4x the rows within 8x the time)", r.F6.ok2000 && r.F6.ok8000 && r.F6[8000] < 8 * Math.max(r.F6[2000], 5), r.F6);
	check("F7 refresh() removes an outside hide-control and re-enables an outside-disabled input", r.F7.hide_control === false && r.F7.disabled === false, r.F7);
	check("F8 under a boundary returning false, `new` still throws the render error", r.F8?.threw === "TypeError", r.F8);

	// F9: detach once, put back, then native removal of the container: swept. Sweep acts on controllers
	// that hold something outside themselves: these watch a store.
	await q(() => {
		const { shallowRef, watch } = __vue_first.Vue;
		const store = shallowRef(0);
		const Watched = frappe.ui.define({
			name: "frappe.ui.P8Watched",
			setup(self) {
				watch(store, () => self.flush());
				return {};
			},
			render: (ctx) => __vue_first.Vue.h("div", { class: "p8-watched" }, ctx.label),
		});
		const mk = (parent, label) => new Watched({ parent, label });
		window.__box = $("<div>").appendTo(document.body);
		window.__a = mk(__box, "A");
		window.__b = mk(__box, "B");
		frappe.ui.sweep();
		$(__a.$el).detach().appendTo(__box);
		frappe.ui.sweep();
		__box[0].remove();
		frappe.ui.sweep();
		window.__k = $("<div>").appendTo(document.body);
		window.__c = mk(__k, "C");
		frappe.ui.sweep();
		window.__kd = __k.detach();
		frappe.ui.sweep();
	});
	const f9 = await q(() => ({ a: __a.$fui.destroyed, b: __b.$fui.destroyed, c_spared: !__c.$fui.destroyed }));
	check("F9 a controller detached once and put back is swept with its container; one still detached is spared", f9.a && f9.b && f9.c_spared, f9);

	// F10: File list filter popover: add a filter, close, sweep while closed, reopen
	await desk("/desk/file");
	await page.waitForFunction(() => cur_list?.filter_area, null, { timeout: 30000 });
	await page.locator(".filter-section .filter-button").click();
	await page.locator(".filter-popover .add-filter").click();
	await page.locator(".es-combobox__panel[data-state='open'] .es-combobox__input").fill("Attached To Name");
	await page.waitForTimeout(400);
	await page.keyboard.press("Enter");
	await page.waitForTimeout(500);
	const atn = page.locator('input[data-fieldname="attached_to_name"]');
	await atn.click();
	await page.keyboard.type("x");
	await atn.blur();
	await page.waitForTimeout(800);
	await page.locator(".filter-section .filter-button").click();
	await page.waitForTimeout(600); // the panel is removed natively
	const swept10 = await q(() => frappe.ui.sweep());
	await page.locator(".filter-section .filter-button").click();
	await page.waitForTimeout(600);
	const f10 = { swept: swept10, inputs: await atn.count(), destroyed: await q(() => cur_list.filter_area.filter_list.filters.filter((f) => f.field?.$fui?.destroyed).length) };
	check("F10 a filter row's control survives a sweep while the filter panel is closed, and is there on reopen", f10.inputs === 1 && f10.destroyed === 0, f10);
	await page.locator(".filter-section .filter-button").click();
	await page.waitForTimeout(500);
	await q(() => cur_list.filter_area.clear());

	const unexpected = errors.filter((e) => !/http 4\d\d/.test(e));
	check("no console errors, page errors or Vue warnings", unexpected.length === 0 && r.app_errors.length === 0, { unexpected, app: r.app_errors });
	console.log(`\n${pass} passed, ${fail} failed`);
	await browser.close();
	process.exit(fail ? 1 : 0);
})().catch((e) => {
	console.error(e);
	process.exit(2);
});
