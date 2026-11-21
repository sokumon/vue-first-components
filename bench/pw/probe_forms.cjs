// Real forms on the v5 controls: which fields are Vue-drawn, legacy behaviour, and timings.
// Runs on the legacy build too (the v5-only checks then report "legacy").
const { open } = require("./session.cjs");
(async () => {
	const { browser, page, errors, base } = await open();
	const q = (fn, arg) => page.evaluate(fn, arg);
	const r = {};
	const t = {};
	if (process.env.NAVLOG) page.on("framenavigated", (f) => f === page.mainFrame() && console.log("NAV", f.url()));
	page.on("load", () => process.env.NAVLOG && console.log("LOAD", page.url()));

	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(4000);
	const v5 = await q(() => !!frappe.ui.form.Control.view);
	console.log("controls:", v5 ? "v5" : "legacy");

	// open a big form, timed from set_route to the form's first refresh
	for (const [doctype, name] of [["User", "Administrator"], ["Role", "System Manager"], ["System Settings", "System Settings"]]) {
		const ms = await q(async ([doctype, name]) => {
			const start = performance.now();
			frappe.set_route("Form", doctype, name);
			await new Promise((resolve) => {
				const check = () => (window.cur_frm?.doctype === doctype && cur_frm.docname === name && cur_frm.layout?.wrapper?.is(":visible") ? resolve() : setTimeout(check, 10));
				check();
			});
			return performance.now() - start;
		}, [doctype, name]);
		await page.waitForTimeout(800);
		const info = await q(() => {
			const controls = Object.values(cur_frm.fields_dict);
			const vue = controls.filter((c) => c.$view?.component);
			const drawn = controls.filter((c) => c.wrapper?.__vueParentComponent || c.$wrapper?.[0]?.__vueParentComponent);
			const inputs = controls.filter((c) => c.$input?.[0]?.__vueParentComponent);
			let refresh = 0;
			for (let i = 0; i < 5; i++) { const s = performance.now(); for (const c of controls) c.refresh(); refresh += performance.now() - s; }
			return { fields: controls.length, v5_controllers: vue.length, vue_drawn_wrappers: drawn.length, vue_drawn_inputs: inputs.length, refresh_all_ms: +(refresh / 5).toFixed(1) };
		});
		t[doctype] = { open_ms: Math.round(ms), ...info };
	}

	// a Data field on a real form: type, save, reload
	await page.goto(base + "/desk/todo/new", { waitUntil: "load" });
	await page.waitForFunction(() => window.cur_frm?.doctype === "ToDo" && cur_frm.fields_dict.description, null, { timeout: 30000 });
	await page.waitForTimeout(800);
	Object.assign(r, await q(async () => {
		const o = {};
		const f = cur_frm.fields_dict.status; // Select
		o["Select field drew its options"] = f.$input.find("option").length >= 3;
		await cur_frm.set_value("status", "Closed");
		o["frm.set_value reaches a Select"] = f.$input.val() === "Closed";
		const pr = cur_frm.fields_dict.priority;
		pr.$input.val("High").trigger("change");
		await new Promise((r) => setTimeout(r, 300));
		o["a change on the input reaches the model"] = cur_frm.doc.priority === "High";
		return o;
	}));
	await q(() => cur_frm.set_value("description", "v5 proof"));
	await page.keyboard.press("Control+s");
	await page.waitForFunction(() => !cur_frm.doc.__islocal, null, { timeout: 15000 }).catch(() => {});
	r["a new ToDo saves"] = await q(() => !cur_frm.doc.__islocal && cur_frm.doc.status === "Closed" && cur_frm.doc.priority === "High" ? true : { local: cur_frm.doc.__islocal, status: cur_frm.doc.status, priority: cur_frm.doc.priority });

	// typing into a Data field with real keys, on User
	await page.goto(base + "/desk/user/Administrator", { waitUntil: "load" });
	await page.waitForFunction(() => window.cur_frm?.docname === "Administrator", null, { timeout: 30000 });
	await page.waitForTimeout(1000);
	const sel = '.frappe-control[data-fieldname="middle_name"] input';
	if (await page.locator(sel).count()) {
		await page.locator(sel).first().click();
		await page.keyboard.type("Pune");
		await page.waitForTimeout(800);
		r["typing into a Data field sets the model (debounced input)"] = await q(() => cur_frm.doc.middle_name === "Pune" && cur_frm.is_dirty());
	} else r["typing into a Data field sets the model (debounced input)"] = "no middle_name field on screen";

	// the risk: a jQuery .val() surviving a Vue re-render of the control
	r["$input.val() survives a re-render of the control"] = await q(() => {
		const c = cur_frm.fields_dict.middle_name;
		if (!c.$view) return "legacy";
		const view = c.$view.component;
		c.set_formatted_input("from the model"); c.flush();
		c.$input.val("typed, not saved");
		const before = view.subTree;
		view.update(); // a real, synchronous re-render
		if (view.subTree === before) return "did not re-render";
		return c.$input.val() === "typed, not saved" || c.$input.val();
	});
	r["...and a changed bound value is still written"] = await q(() => {
		const c = cur_frm.fields_dict.middle_name;
		if (!c.$view) return "legacy";
		c.set_formatted_input("new from the model"); c.flush();
		const ok = c.$input.val() === "new from the model";
		c.set_formatted_input(""); c.flush();
		return ok;
	});
	// legacy patterns on a v5 control
	Object.assign(r, await q(() => {
		const o = {};
		const c = cur_frm.fields_dict.middle_name;
		c.$wrapper.addClass("from-script");
		c.toggle(false); c.toggle(true);
		o["a class added by a script survives refresh"] = c.$wrapper.hasClass("from-script");
		o["frm.toggle_display hides and shows"] = (() => { cur_frm.toggle_display("middle_name", false); const h = c.$wrapper.hasClass("hide-control"); cur_frm.toggle_display("middle_name", true); return h && !c.$wrapper.hasClass("hide-control"); })();
		o["frm.set_df_property(label) redraws the label"] = (() => { cur_frm.set_df_property("middle_name", "label", "Where"); return c.$wrapper.find(".control-label").text().trim() === "Where"; })();
		o["frm.toggle_reqd marks the field"] = (() => { cur_frm.toggle_reqd("middle_name", true); const ok = c.$wrapper.find(".control-label").hasClass("reqd"); cur_frm.toggle_reqd("middle_name", false); return ok; })();
		o["fields_dict wrapper is still .frappe-control[data-fieldname]"] = c.$wrapper.is('.frappe-control[data-fieldname="middle_name"]');
		return o;
	}));

	// Check and Switch build their own wrapper and take the base class's input
	Object.assign(r, await q(async () => {
		const o = {};
		const d = new frappe.ui.Dialog({ title: "checks", fields: [{ fieldname: "c", fieldtype: "Check", label: "C", default: 1 }, { fieldname: "s", fieldtype: "Switch", label: "S" }, { fieldname: "dep", fieldtype: "Data", label: "Dep", depends_on: "eval:doc.c" }] });
		d.show();
		await new Promise((r) => setTimeout(r, 300));
		const c = d.fields_dict.c, sw = d.fields_dict.s;
		o["Check has a real checkbox"] = c.input?.type === "checkbox" && c.$input.closest(".input-area").length === 1;
		o["Switch has a real checkbox"] = sw.input?.type === "checkbox";
		o["Check default reaches get_values"] = d.get_values()?.c === 1 || d.get_values();
		c.$input.prop("checked", false).trigger("change");
		await new Promise((r) => setTimeout(r, 300));
		o["unticking a Check reaches the value and depends_on"] = d.get_value("c") === 0 && d.fields_dict.dep.$wrapper.hasClass("hide-control");
		d.hide();
		return o;
	}));

	// a dialog built from fields (FieldGroup), with its own Data/Select controls
	Object.assign(r, await q(async () => {
		const o = {};
		const d = new frappe.ui.Dialog({ title: "v5", fields: [{ fieldname: "a", fieldtype: "Data", label: "A", reqd: 1 }, { fieldname: "b", fieldtype: "Select", options: "x\ny", label: "B" }, { fieldname: "c", fieldtype: "Int", label: "C" }] });
		d.show();
		await new Promise((r) => setTimeout(r, 400));
		d.set_value("a", "hello"); d.set_value("c", 42);
		await new Promise((r) => setTimeout(r, 100));
		const v = d.get_values();
		o["Dialog fields: set_value / get_values"] = v?.a === "hello" && v?.c === 42 ? true : v;
		o["Dialog is visible with its fields"] = d.$wrapper.is(":visible") && d.$wrapper.find(".frappe-control").length >= 3;
		d.hide();
		await new Promise((r) => setTimeout(r, 400));
		o["Dialog hides"] = !d.$wrapper.is(":visible");
		return o;
	}));

	console.table(t);
	let pass = 0, total = 0;
	for (const [k, v] of Object.entries(r)) { total++; if (v === true) pass++; console.log(`  ${v === true ? "PASS" : "FAIL"}  ${k}${v === true ? "" : "  -> " + JSON.stringify(v)}`); }
	console.log(`\n${pass}/${total} passed`);
	const real = errors.filter((e) => !/socket\.io/.test(e));
	console.log("console errors and Vue warnings:", real.length ? real.slice(0, 8) : "none");
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
