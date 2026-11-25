// speed2/verify/break.cjs <label> : adversarial checks of B's lazy / deferred mounting (Link stand-ins, lazy Select,
// idle Select options), run on legacy controls (window.__es_link_off, same build) and on B, then diffed.
// Values and visible text must match legacy; es-only state (mounted / pending) is recorded under keys starting "es_".
// env: MODES (default "legacy,es"), ONLY=scenario,... Writes out/break-<label>.json and prints a diff.
// Run inside session.sh (no own lock).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open, settle } = require("../../harness/lib.cjs");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const MODES = (process.env.MODES || "legacy,es").split(",");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

function helpers() {
	const vis = __tw.vis, text = __tw.text;
	const shown = (e) => {
		if (!vis(e) || e.closest("[aria-hidden=true]")) return false;
		const r = e.getBoundingClientRect();
		return r.width > 4 && r.height > 4 && getComputedStyle(e).opacity !== "0";
	};
	// what the user sees, without touching $input/input/awesomplete (that would force a mount)
	window.__seen = (c) => {
		if (!c || !c.$wrapper) return null;
		const w = c.$wrapper[0];
		if (!vis(w)) return { m: "hidden" };
		const ci = w.querySelector(".control-input") || w;
		const el = [...ci.querySelectorAll("input, select, button, [role=combobox]")].filter(shown)[0];
		if (el && vis(ci)) {
			const o = { m: "in", ro: !!(el.disabled || el.readOnly || el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled")) };
			if (el.tagName === "SELECT") o.t = el.selectedOptions[0] ? text(el.selectedOptions[0]) : "";
			else if (el.tagName === "INPUT") o.t = el.value;
			else o.t = text(el);
			return o;
		}
		const d = c.disp_area;
		return { m: vis(d) ? "disp" : "none", t: vis(d) ? text(d) : null };
	};
	window.__es = (c) => {
		const w = c.$wrapper && c.$wrapper[0];
		if (!w) return null;
		return { host: !!w.querySelector("es-combobox, es-select"), pending: !!(c._es_ph || c._es_sel_pending) };
	};
	window.__f = (c) => ({ doc: c.frm && c.doc ? (c.doc[c.df.fieldname] ?? null) : undefined, seen: __seen(c), es_: __es(c), reqd_err: c.$wrapper.hasClass("has-error") });
	window.__all = (fd, only_vis = true) => {
		const out = {};
		for (const [k, c] of Object.entries(fd)) {
			if (!["Link", "Dynamic Link", "Select"].includes(c.df && c.df.fieldtype)) continue;
			if (only_vis && !(c.$wrapper && vis(c.$wrapper[0]))) continue;
			out[k] = __f(c);
		}
		return out;
	};
	window.__raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
	window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	window.__first = async (dt) => {
		try { const l = await frappe.db.get_list(dt, { limit: 1, order_by: "name asc" }); return l[0] ? l[0].name : null; } catch (e) { return null; }
	};
	window.__lazy = () => { const L = frappe.ui.form.es_link_lazy; return L ? { pending: L.pending(), forced: { ...L.forced } } : null; };
	window.__focus_field = () => { const a = document.activeElement; return a ? ($(a).closest("[data-fieldname]").attr("data-fieldname") || a.tagName) : null; };
}

async function new_form(page, base, dt) {
	await page.goto(base + "/desk/" + dt.toLowerCase().replace(/ /g, "-") + "/new");
	await page.waitForFunction((dt) => window.cur_frm && cur_frm.doctype === dt && cur_frm.layout.wrapper.is(":visible"), dt, { timeout: 60000 });
	await page.waitForTimeout(1500);
	await page.evaluate(helpers);
}
async function click_tab(page, fieldname) {
	const h = await page.evaluateHandle((f) => { const t = cur_frm.layout.tabs.find((t) => t.df.fieldname === f); return t && t.tab_link.find(".nav-link")[0]; }, fieldname);
	const el = h.asElement();
	if (!el) return false;
	await el.click();
	await page.waitForTimeout(500);
	return true;
}
// expand every collapsed section of the active tab by clicking its head
async function expand_all(page) {
	const n = await page.evaluate(() => cur_frm.layout.sections.filter((s) => s.is_collapsed && s.is_collapsed() && s.wrapper.is(":visible")).length);
	for (let i = 0; i < n; i++) {
		const h = await page.evaluateHandle(() => { const s = cur_frm.layout.sections.find((s) => s.is_collapsed && s.is_collapsed() && s.wrapper.is(":visible")); return s && (s.head ? s.head[0] : s.wrapper.find(".section-head")[0]); });
		const el = h.asElement();
		if (!el) break;
		await el.click();
		await page.waitForTimeout(250);
	}
	await page.waitForTimeout(300);
	return n;
}
async function type_and_rows(page, rec, txt) {
	await page.keyboard.type(txt, { delay: 40 });
	await page.waitForTimeout(1100);
	await settle(page, rec);
	return page.evaluate(() => __tw.options().slice(0, 5));
}

const SCEN = {};

// 1. app code reads $input / awesomplete of fields not yet shown (other tab, collapsed section, depends_on hidden),
// binds events, calls .focus(); then the user reveals them and uses them (erp Item, new)
const S1F = ["purchase_uom", "weight_uom", "brand", "asset_category", "valuation_method", "variant_based_on", "quality_inspection_template", "asset_naming_series"];
SCEN["item-app-reads-hidden"] = async ({ page, rec, base }) => {
	await new_form(page, base, "Item");
	const r = {};
	r.es_before = await page.evaluate((F) => ({ lazy: __lazy(), st: Object.fromEntries(F.map((f) => [f, __es(cur_frm.fields_dict[f])])) }), S1F);
	r.api = await page.evaluate((F) => {
		window.__log = [];
		const o = {};
		for (const f of F) {
			const c = cur_frm.fields_dict[f];
			const $i = c.$input;
			o[f] = { len: $i.length, tag: $i[0].tagName, same: c.input === $i[0], aw: c.df.fieldtype === "Link" ? !!c.awesomplete && typeof c.awesomplete.evaluate === "function" : null, link: c.$link ? c.$link.length : null, connected: $i[0].isConnected };
			$i.on("focus blur change awesomplete-selectcomplete input", (e) => __log.push(f + ":" + e.type));
			$i.focus();
			o[f].focused_hidden = document.activeElement === $i[0];
			c.$input.attr("data-app-mark", "x");
		}
		o.active = __focus_field();
		return o;
	}, S1F);
	await page.evaluate(() => document.activeElement && document.activeElement.blur());
	await page.waitForTimeout(400);
	await click_tab(page, "inventory_section");
	await expand_all(page);
	r.inventory_tab = await page.evaluate(() => ({ all: __all(cur_frm.fields_dict), marks: cur_frm.layout.wrapper.find(".tab-pane.active [data-app-mark]").length }));
	r.valuation_pick = await pick_select(page, "valuation_method", "Moving Average");
	const h = await page.evaluateHandle(() => cur_frm.fields_dict.weight_uom.$input[0]);
	await h.asElement().click();
	r.weight_rows = await type_and_rows(page, rec, "Kg");
	await page.keyboard.press("Enter");
	await page.waitForTimeout(1200);
	await page.evaluate(() => document.activeElement && document.activeElement.blur());
	await page.waitForTimeout(800);
	r.weight_after = await page.evaluate(() => __f(cur_frm.fields_dict.weight_uom));
	// depends_on: tick is_fixed_asset / has_variants, the hidden fields appear
	await click_tab(page, "details");
	await page.evaluate(async () => { await cur_frm.set_value("is_fixed_asset", 1); });
	await page.waitForTimeout(800);
	await expand_all(page);
	r.details_tab = await page.evaluate(() => __all(cur_frm.fields_dict));
	await page.evaluate(async () => { await cur_frm.set_value("has_variants", 1); });
	await page.waitForTimeout(800);
	r.variants_tab_shown = await click_tab(page, "variants_section").catch(() => "not clickable");
	r.variants_tab = await page.evaluate(() => __all(cur_frm.fields_dict));
	r.variant_pick = await pick_select(page, "variant_based_on", "Manufacturer").catch((e) => ({ error: e.message.slice(0, 80) }));
	await click_tab(page, "quality_tab");
	const q = await page.evaluateHandle(() => cur_frm.fields_dict.quality_inspection_template.$wrapper.find("input:visible")[0]);
	if (q.asElement()) { await q.asElement().click(); await page.waitForTimeout(600); }
	r.quality_focus = await page.evaluate(() => ({ focus: __focus_field(), is_input: document.activeElement === cur_frm.fields_dict.quality_inspection_template.$input[0] }));
	await page.keyboard.press("Escape");
	r.log = await page.evaluate(() => __log.filter((x, i, a) => a.indexOf(x) === i).sort());
	r.es_after = await page.evaluate(() => __lazy());
	return r;
};

// pick a Select option the way a user does: native <select> → selectOption; es-select → click trigger, click row
async function pick_select(page, f, label, fd = "cur_frm.fields_dict") {
	const h = await page.evaluateHandle(([f, fd]) => {
		const w = eval(fd)[f].$wrapper[0];
		return [...w.querySelectorAll(".control-input select, .control-input button, .control-input [role=combobox]")].filter((e) => __tw.vis(e) && !e.closest("[aria-hidden=true]") && e.getBoundingClientRect().width > 4 && getComputedStyle(e).opacity !== "0")[0];
	}, [f, fd]);
	const el = h.asElement();
	if (!el) return { error: "nothing visible" };
	const tag = await el.evaluate((e) => e.tagName);
	if (tag === "SELECT") await el.selectOption({ label });
	else {
		await el.click();
		await page.waitForTimeout(400);
		await page.locator('[role="option"]:visible', { hasText: label }).first().click();
	}
	await page.waitForTimeout(600);
	return page.evaluate(([f, fd]) => __f(eval(fd)[f]), [f, fd]);
}

// 2. frm.set_value / set_df_property (options, read_only, reqd) / toggle_enable on fields not yet shown, then show them
SCEN["item-set-hidden-then-show"] = async ({ page, base }) => {
	await new_form(page, base, "Item");
	const r = {};
	r.values = await page.evaluate(async () => {
		const F = ["weight_uom", "purchase_uom", "sales_uom", "valuation_method", "default_material_request_type", "quality_inspection_template", "country_of_origin", "brand"];
		const es0 = Object.fromEntries(F.map((f) => [f, __es(cur_frm.fields_dict[f])]));
		await cur_frm.set_value("weight_uom", "Kg");
		await cur_frm.set_value("purchase_uom", "Box");
		await cur_frm.set_value("sales_uom", "Nos");
		await cur_frm.set_value("valuation_method", "Moving Average");
		await cur_frm.set_value("country_of_origin", "India");
		// Select options changed while unmounted, then a value from the new list
		cur_frm.set_df_property("default_material_request_type", "options", "Purchase\nCustom One\nManufacture");
		await cur_frm.set_value("default_material_request_type", "Custom One");
		cur_frm.set_df_property("sales_uom", "read_only", 1);
		cur_frm.set_df_property("valuation_method", "read_only", 1);
		cur_frm.set_df_property("quality_inspection_template", "reqd", 1);
		cur_frm.set_df_property("brand", "reqd", 1);
		cur_frm.toggle_enable("purchase_uom", false);
		cur_frm.set_df_property("weight_uom", "label", "Weight Unit (renamed)");
		await __sleep(800);
		return { doc: Object.fromEntries(F.map((f) => [f, cur_frm.doc[f] ?? null])), es_before: es0, es_lazy: __lazy() };
	});
	r.tabs = {};
	for (const t of await page.evaluate(() => cur_frm.layout.tabs.filter((t) => !t.is_hidden()).map((t) => t.df.fieldname))) {
		await click_tab(page, t);
		await expand_all(page);
		r.tabs[t] = await page.evaluate(() => __all(cur_frm.fields_dict));
	}
	r.weight_label = await page.evaluate(() => __tw.text(cur_frm.fields_dict.weight_uom.$wrapper.find("label")[0]));
	// undo on now-mounted fields
	await page.evaluate(async () => {
		cur_frm.set_df_property("sales_uom", "read_only", 0);
		cur_frm.set_df_property("quality_inspection_template", "reqd", 0);
		cur_frm.set_df_property("default_material_request_type", "options", "Purchase\nManufacture");
		cur_frm.toggle_enable("purchase_uom", true);
		await __sleep(600);
	});
	r.after_undo = {};
	for (const t of ["inventory_section", "purchasing_tab", "sales_details", "quality_tab"]) {
		await click_tab(page, t);
		r.after_undo[t] = await page.evaluate(() => __all(cur_frm.fields_dict));
	}
	r.after_undo.dmrt_opts = await page.evaluate(() => [...cur_frm.fields_dict.default_material_request_type.$wrapper[0].querySelectorAll("select option")].map((o) => o.value));
	return r;
};

// 3. depends_on / toggle_display on not-yet-shown fields, in a form and in a dialog; dialog lifecycle
SCEN["dialog-lifecycle"] = async ({ page, rec, base }) => {
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(1500);
	await page.evaluate(helpers);
	const r = {};
	r.dialog_first_frame = await page.evaluate(async () => {
		// a fresh dialog: are its fields drawn as real controls in the very first frame?
		const d = new frappe.ui.Dialog({ title: "F", fields: [{ fieldname: "a", fieldtype: "Link", options: "User", label: "A" }, { fieldname: "b", fieldtype: "Select", options: "\nx\ny", label: "B" }] });
		d.set_values({ b: "y" });
		// the first frame that paints the modal: Bootstrap sets display:block in _showElement (after the backdrop
		// fades in); an rAF queued right then runs in that frame after any rAF queued by _showElement itself
		const x = await new Promise((res) => {
			const el = d.$wrapper[0];
			const mo = new MutationObserver(() => {
				if (getComputedStyle(el).display === "none") return;
				mo.disconnect();
				requestAnimationFrame(() => res({ es_a: __es(d.fields_dict.a), es_b: __es(d.fields_dict.b), b_seen: __seen(d.fields_dict.b) }));
			});
			mo.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
			d.show();
		});
		d.hide();
		await __sleep(600);
		d.$wrapper.remove();
		document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
		document.body.classList.remove("modal-open");
		return x;
	});
	r.before_show = await page.evaluate(async () => {
		window.__log = [];
		const d = (window.__jd = new frappe.ui.Dialog({ title: "Verify", fields: [
			{ fieldname: "user", fieldtype: "Link", options: "User", label: "User" },
			{ fieldname: "kind", fieldtype: "Select", label: "Kind", options: "\nAlpha\nBeta" },
			{ fieldname: "role", fieldtype: "Link", options: "Role", label: "Role", depends_on: "eval:doc.kind=='Beta'" },
			{ fieldname: "lvl", fieldtype: "Select", label: "Level", options: "x\ny", depends_on: "eval:doc.kind=='Beta'" },
			{ fieldname: "note", fieldtype: "Data", label: "Note" },
		] }));
		const es_0 = Object.fromEntries(["user", "kind", "role", "lvl"].map((f) => [f, __es(d.fields_dict[f])]));
		await d.set_values({ user: "Administrator", kind: "Alpha" });
		const role = d.fields_dict.role;
		role.$input.on("focus change awesomplete-selectcomplete", (e) => __log.push("role:" + e.type));
		const ro = { len: role.$input.length, aw: !!role.awesomplete, same: role.input === role.$input[0] };
		// options changed while not shown
		d.set_df_property("lvl", "options", "p\nq\nr");
		d.fields_dict.lvl.$input.on("change", () => __log.push("lvl:change"));
		return { es_0, ro, values: d.get_values(true) };
	});
	await page.evaluate(() => __jd.show());
	await page.waitForTimeout(800);
	r.shown = await page.evaluate(() => __all(__jd.fields_dict, false));
	await page.evaluate(() => __jd.set_value("kind", "Beta"));
	await page.waitForTimeout(800);
	r.beta = await page.evaluate(() => __all(__jd.fields_dict, false));
	// pick the revealed Select by mouse, pick a role by keyboard
	r.lvl_pick = await pick_select(page, "lvl", "q", "__jd.fields_dict");
	const h = await page.evaluateHandle(() => __jd.fields_dict.role.$input[0]);
	await h.asElement().click();
	r.role_rows = await type_and_rows(page, rec, "System Man");
	await page.keyboard.press("Enter");
	await page.waitForTimeout(1000);
	r.role_after = await page.evaluate(() => ({ v: __jd.get_value("role"), seen: __seen(__jd.fields_dict.role) }));
	r.log = await page.evaluate(() => __log.filter((x, i, a) => a.indexOf(x) === i));
	await page.evaluate(() => __jd.hide());
	await page.waitForTimeout(600);
	await page.evaluate(() => __jd.set_values({ user: "Guest", kind: "Alpha", lvl: "r" }));
	await page.waitForTimeout(300);
	await page.evaluate(() => __jd.show());
	await page.waitForTimeout(800);
	r.reshow = await page.evaluate(() => ({ all: __all(__jd.fields_dict, false), values: __jd.get_values(true) }));
	await page.evaluate(() => __jd.set_value("kind", "Beta"));
	await page.waitForTimeout(600);
	r.reshow_beta = await page.evaluate(() => ({ all: __all(__jd.fields_dict, false), values: __jd.get_values(true) }));
	// keyboard: Escape closes
	await page.keyboard.press("Escape");
	await page.waitForTimeout(600);
	r.closed = await page.evaluate(() => !__jd.$wrapper.hasClass("show"));
	// a long dialog: set_values on all, scroll its last field into view
	r.long = await page.evaluate(async () => {
		const d = new frappe.ui.Dialog({ title: "Long", fields: [
			...Array.from({ length: 50 }, (_, i) => ({ fieldname: "l" + i, fieldtype: "Link", options: "Role", label: "L" + i })),
			...Array.from({ length: 10 }, (_, i) => ({ fieldname: "s" + i, fieldtype: "Select", options: "\na\nb\nc", label: "S" + i })),
		] });
		d.show();
		await __raf2();
		const vals = {};
		for (let i = 0; i < 50; i++) vals["l" + i] = "System Manager";
		for (let i = 0; i < 10; i++) vals["s" + i] = "b";
		await d.set_values(vals);
		await __sleep(500);
		const es_pending = Object.values(d.fields_dict).filter((c) => c._es_ph || c._es_sel_pending).length;
		d.fields_dict.s9.$wrapper[0].scrollIntoView();
		await __sleep(600);
		const got = d.get_values(true);
		const wrong = Object.keys(vals).filter((k) => got[k] !== vals[k]);
		const seen_wrong = Object.keys(vals).filter((k) => { const s = __seen(d.fields_dict[k]); return !s || s.t !== vals[k]; });
		const r = { wrong, seen_wrong, es_pending_before_scroll: es_pending, es_pending_after: Object.values(d.fields_dict).filter((c) => c._es_ph || c._es_sel_pending).length, s9: __seen(d.fields_dict.s9), l49: __seen(d.fields_dict.l49) };
		d.hide();
		await __sleep(400);
		d.$wrapper.remove();
		return r;
	});
	return r;
};

// 4. grid: in-grid edit + Tab, row form + Tab (v5 Workflow)
SCEN["grid"] = async ({ page, rec, base }) => {
	await new_form(page, base, "Workflow");
	const r = {};
	await page.evaluate(() => cur_frm.fields_dict.states.grid.add_new_row());
	await page.waitForTimeout(500);
	await page.locator('[data-fieldname="states"] .grid-body .grid-row').first().locator('[data-fieldname="state"]').first().click();
	await page.waitForTimeout(700);
	r.rows = await type_and_rows(page, rec, "Appr");
	await page.keyboard.press("Tab");
	await page.waitForTimeout(900);
	r.after_tab = await page.evaluate(() => ({ state: cur_frm.doc.states[0].state ?? null, focus: __focus_field() }));
	await page.keyboard.press("Tab");
	await page.waitForTimeout(600);
	r.after_tab2 = await page.evaluate(() => ({ focus: __focus_field() }));
	await page.locator(".page-head").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
	await page.waitForTimeout(800);
	await page.evaluate(() => cur_frm.fields_dict.states.grid.grid_rows[0].toggle_view(true));
	await page.waitForTimeout(900);
	r.row_form = await page.evaluate(() => __all(cur_frm.fields_dict.states.grid.grid_rows[0].grid_form.fields_dict));
	// keyboard through the row form: focus the first field, Tab 6 times
	await page.evaluate(() => { const gf = cur_frm.fields_dict.states.grid.grid_rows[0].grid_form; gf.fields_dict.state.$wrapper.find("input:visible, button:visible, select:visible")[0].focus(); });
	await page.waitForTimeout(400);
	await page.keyboard.press("Escape");
	const seq = [];
	for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); await page.waitForTimeout(250); seq.push(await page.evaluate(() => __focus_field())); }
	r.row_form_tabs = seq.filter((x, i) => x !== seq[i - 1]);
	// a Select in the row form by keyboard: Tab landed somewhere; set doc_status via the control
	r.row_doc_status = await pick_select(page, "doc_status", "1", "cur_frm.fields_dict.states.grid.grid_rows[0].grid_form.fields_dict").catch((e) => ({ error: e.message.slice(0, 100) }));
	r.doc = await page.evaluate(() => ({ state: cur_frm.doc.states[0].state, doc_status: cur_frm.doc.states[0].doc_status }));
	return r;
};

// 5. keyboard only: Tab from the first field down into fields that were never on screen (small viewport)
SCEN["keyboard-below-fold"] = async ({ page, rec, base }) => {
	await page.setViewportSize({ width: 1400, height: 520 });
	await new_form(page, base, "Sales Order");
	const r = {};
	r.es_start = await page.evaluate(() => Object.fromEntries(Object.entries(cur_frm.fields_dict).filter(([k, c]) => ["Link", "Select"].includes(c.df.fieldtype) && __tw.vis(c.$wrapper[0])).map(([k, c]) => [k, __es(c)])));
	await page.evaluate(() => cur_frm.fields_dict.customer.$wrapper.find("input:visible")[0].focus());
	await page.waitForTimeout(500);
	await page.keyboard.press("Escape");
	const seq = [];
	for (let i = 0; i < 28; i++) {
		await page.keyboard.press("Tab");
		await page.waitForTimeout(120);
		seq.push(await page.evaluate(() => {
			const a = document.activeElement;
			const f = __focus_field();
			const c = cur_frm.fields_dict[f];
			return { f, in_viewport: a.getBoundingClientRect().top < innerHeight && a.getBoundingClientRect().bottom > 0, es_: c ? __es(c) : null };
		}));
	}
	await page.keyboard.press("Escape");
	r.seq = seq.map((x) => x.f).filter((x, i, a) => x !== a[i - 1]);
	r.es_seq = seq;
	r.all_in_viewport = seq.every((x) => x.in_viewport);
	// type into the Link reached last
	const last = [...seq].reverse().find((x) => x.f && ["set_warehouse", "taxes_and_charges", "shipping_rule", "incoterm", "tax_category"].includes(x.f));
	r.last_link = last ? last.f : null;
	if (last) {
		await page.evaluate((f) => cur_frm.scroll_to_field(f), last.f);
		await page.waitForTimeout(600);
		await page.evaluate((f) => cur_frm.fields_dict[f].$wrapper.find("input:visible")[0].focus(), last.f);
		await page.waitForTimeout(300);
		r.last_rows = (await type_and_rows(page, rec, "a")).length > 0;
		await page.keyboard.press("Escape");
	}
	// now scroll the whole tab down: everything near the viewport must mount, values/visible text as legacy
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	await page.waitForTimeout(800);
	r.bottom = await page.evaluate(() => __all(cur_frm.fields_dict));
	return r;
};

// 6. quick re-route before the rAF / visibility mount; never-shown dialogs left behind
SCEN["reroute-quick"] = async ({ page, base }) => {
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(1500);
	await page.evaluate(helpers);
	const r = {};
	// leave as soon as the form exists (its controls are built, the pre-paint check is queued), in that same task
	const name = await page.evaluate(async () => {
		const n = frappe.model.make_new_doc_and_get_name("Sales Order");
		frappe.set_route("Form", "Sales Order", n);
		await new Promise((res) => { const c = () => (window.cur_frm && cur_frm.docname === n && cur_frm.fields_dict.customer ? (frappe.set_route("List", "ToDo"), res()) : setTimeout(c, 0)); c(); });
		return n;
	});
	await page.waitForTimeout(2500);
	r.away = await page.evaluate(() => ({ route: frappe.get_route_str(), es_lazy: __lazy() }));
	await page.evaluate((n) => frappe.set_route("Form", "Sales Order", n), name);
	await page.waitForFunction((n) => cur_frm && cur_frm.docname === n && cur_frm.layout.wrapper.is(":visible"), name, { timeout: 30000 });
	await page.waitForTimeout(1200);
	r.back = await page.evaluate(() => __all(cur_frm.fields_dict));
	r.back_pending_visible = Object.entries(r.back).filter(([k, v]) => v.es_ && v.es_.pending).map(([k]) => k);
	// set a value right after a quick reroute: the Link was never mounted
	await page.evaluate(async () => {
		const n = frappe.model.make_new_doc_and_get_name("Sales Order");
		frappe.set_route("Form", "Sales Order", n);
		await new Promise((res) => { const c = () => (window.cur_frm && cur_frm.docname === n && cur_frm.fields_dict.customer ? res() : setTimeout(c, 0)); c(); });
		cur_frm.set_value("order_type", "Maintenance"); // on the never-shown form, then leave at once
		frappe.set_route("List", "ToDo");
		window.__n2 = n;
	});
	await page.waitForTimeout(1500);
	await page.evaluate(async () => { frappe.set_route("Form", "Sales Order", __n2); });
	await page.waitForFunction(() => cur_frm && cur_frm.docname === __n2 && cur_frm.layout.wrapper.is(":visible"), null, { timeout: 30000 });
	await page.waitForTimeout(400);
	await page.evaluate(async () => { await cur_frm.set_value("territory", await __first("Territory")); });
	await page.waitForTimeout(800);
	r.second = await page.evaluate(() => ({ order_type: __f(cur_frm.fields_dict.order_type), territory_doc: cur_frm.doc.territory }));
	// 200 dialogs built and never shown, then dropped: do their stand-ins stay referenced?
	const cdp = await page.context().newCDPSession(page);
	const heap = async () => { await cdp.send("HeapProfiler.collectGarbage"); await cdp.send("HeapProfiler.collectGarbage"); return (await cdp.send("Runtime.getHeapUsage")).usedSize; };
	await page.evaluate(() => frappe.set_route("List", "ToDo"));
	await page.waitForTimeout(1500);
	const p0 = await page.evaluate(() => __lazy());
	const h0 = await heap();
	await page.evaluate(async () => {
		for (let i = 0; i < 200; i++) {
			const d = new frappe.ui.Dialog({ title: "x" + i, fields: [
				{ fieldname: "a", fieldtype: "Link", options: "User" }, { fieldname: "b", fieldtype: "Link", options: "Role" }, { fieldname: "c", fieldtype: "Select", options: "\nx\ny" },
			] });
			d.$wrapper.remove();
		}
		await __raf2();
	});
	await page.waitForTimeout(800);
	const h1 = await heap();
	const p1 = await page.evaluate(() => __lazy());
	r.es_dropped_dialogs = { pending_before: p0 && p0.pending, pending_after: p1 && p1.pending };
	r.es_dropped_heap_kb = Math.round((h1 - h0) / 1024);
	return r;
};


// 7. is a stand-in (or an empty host) ever painted on screen? Checked at every frame's pre-paint point
// (a ResizeObserver callback, which runs after all rAF callbacks and layout) while forms open, tabs switch and the page scrolls
SCEN["paint-standins"] = async ({ page, base }) => {
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(1500);
	await page.evaluate(helpers);
	await page.evaluate(() => {
		window.__paint = { frames: 0, bad: {} };
		const probe = document.createElement("div");
		probe.style.cssText = "position:fixed;top:0;left:0;height:1px;pointer-events:none";
		document.body.append(probe);
		let w = 1;
		const ro = new ResizeObserver(() => {
			__paint.frames++;
			for (const el of document.querySelectorAll(".es-link-pending input, select.form-control, es-combobox, es-select")) {
				const r = el.getBoundingClientRect();
				if (!r.width || r.bottom < 0 || r.top > innerHeight || !__tw.vis(el)) continue;
				const c = $(el).closest(".frappe-control")[0];
				const ctl = c && c.fieldobj;
				let why = null;
				if (el.matches(".es-link-pending input")) why = "link stand-in";
				else if (el.tagName === "SELECT" && ctl && ctl._es_sel_pending) why = "select stand-in";
				else if (/^ES-/.test(el.tagName) && !el.firstElementChild && !el.shadowRoot) why = "empty host";
				if (why) { const k = why + ":" + (ctl ? ctl.df.fieldname : "?"); __paint.bad[k] = (__paint.bad[k] || 0) + 1; }
			}
		});
		const tick = () => { probe.style.width = (w = w === 1 ? 2 : 1) + "px"; requestAnimationFrame(tick); };
		ro.observe(probe);
		requestAnimationFrame(tick);
	});
	const r = {};
	for (const dt of ["Sales Order", "Delivery Note", "Stock Entry", "Item"]) {
		await page.evaluate((dt) => { __paint.bad = {}; frappe.set_route("Form", dt, frappe.model.make_new_doc_and_get_name(dt)); }, dt);
		await page.waitForFunction((dt) => window.cur_frm && cur_frm.doctype === dt && cur_frm.layout.wrapper.is(":visible"), dt, { timeout: 30000 });
		await page.waitForTimeout(800);
		const tabs = await page.evaluate(() => cur_frm.layout.tabs.filter((t) => !t.is_hidden()).map((t) => t.df.fieldname));
		for (const t of tabs) { await click_tab(page, t); await expand_all(page); await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300); await page.evaluate(() => window.scrollTo(0, 0)); }
		r[dt] = await page.evaluate(() => ({ es_frames: __paint.frames, bad: __paint.bad }));
		await page.evaluate(() => frappe.set_route("List", "ToDo"));
		await page.waitForTimeout(600);
	}
	return r;
};


// 8. how different does a painted stand-in look from the mounted control? (es only: same field, before / after mount)
SCEN["standin-look"] = async ({ page, base }) => {
	await new_form(page, base, "Item");
	const r = await page.evaluate(() => {
		const out = {};
		const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(), cs = getComputedStyle(el); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), bg: cs.backgroundColor, border: cs.borderTopWidth + " " + cs.borderTopColor, radius: cs.borderTopLeftRadius, font: cs.fontSize + " " + cs.fontWeight, color: cs.color, pad: cs.paddingLeft }; };
		const vis_el = (c) => [...c.$wrapper[0].querySelectorAll(".control-input input, .control-input select, .control-input button")].filter((e) => __tw.vis(e) && !e.closest("[aria-hidden=true]") && e.getBoundingClientRect().width > 4 && getComputedStyle(e).opacity !== "0")[0];
		for (const [tab, f] of [["quality_tab", "quality_inspection_template"], ["inventory_section", "valuation_method"], ["inventory_section", "weight_uom"]]) {
			cur_frm.layout.tabs.find((t) => t.df.fieldname === tab).set_active();
			const c = cur_frm.fields_dict[f];
			const pending = !!(c._es_ph || c._es_sel_pending);
			const before = box(vis_el(c));
			const wrap_h0 = Math.round(c.$wrapper[0].getBoundingClientRect().height);
			if (c.df.fieldtype === "Link") void c.$input; else void c._es_host;
			const after = box(vis_el(c));
			out[f] = { pending, before, after, wrap_h: [wrap_h0, Math.round(c.$wrapper[0].getBoundingClientRect().height)] };
		}
		return out;
	});
	return { es_look: r };
};


// 9. keyboard only through a long dialog: Tab from the first field down into fields that were never near the
// viewport (pending stand-ins in B), then type into one and pick with Enter
SCEN["keyboard-long-dialog"] = async ({ page, rec, base }) => {
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(1500);
	await page.evaluate(helpers);
	await page.evaluate(async () => {
		window.__kd = new frappe.ui.Dialog({ title: "Keys", fields: [
			...Array.from({ length: 30 }, (_, i) => ({ fieldname: "l" + i, fieldtype: "Link", options: "Role", label: "L" + i })),
			...Array.from({ length: 6 }, (_, i) => ({ fieldname: "s" + i, fieldtype: "Select", options: "\na\nb\nc", label: "S" + i })),
			{ fieldname: "last", fieldtype: "Link", options: "Role", label: "Last" },
		] });
		__kd.show();
		await __sleep(800);
	});
	const r = {};
	r.es_pending_start = await page.evaluate(() => Object.values(__kd.fields_dict).filter((c) => c._es_ph || c._es_sel_pending).length);
	await page.evaluate(() => __kd.fields_dict.l0.$wrapper.find("input:visible")[0].focus());
	await page.keyboard.press("Escape").catch(() => {});
	await page.waitForTimeout(200);
	const open = await page.evaluate(() => __kd.$wrapper.hasClass("show"));
	if (!open) { await page.evaluate(() => __kd.show()); await page.waitForTimeout(600); await page.evaluate(() => __kd.fields_dict.l0.$wrapper.find("input:visible")[0].focus()); }
	const seq = [];
	for (let i = 0; i < 36; i++) {
		await page.keyboard.press("Tab");
		await page.waitForTimeout(80);
		seq.push(await page.evaluate(() => {
			const a = document.activeElement, f = __focus_field(), c = __kd.fields_dict[f];
			const b = a.getBoundingClientRect();
			return { f, vis: b.bottom > 0 && b.top < innerHeight && b.width > 4, es_: c ? __es(c) : null };
		}));
	}
	r.seq = seq.map((x) => x.f).filter((x, i, a) => x !== a[i - 1]);
	r.all_visible = seq.every((x) => x.vis);
	r.es_seq = seq;
	// we are on (or near) the last fields: go to "last" with Tab and type into it
	for (let i = 0; i < 4 && (await page.evaluate(() => __focus_field())) !== "last"; i++) { await page.keyboard.press("Tab"); await page.waitForTimeout(80); }
	r.on_last = await page.evaluate(() => __focus_field());
	r.rows = (await type_and_rows(page, rec, "System Ma")).slice(0, 1);
	await page.keyboard.press("Enter");
	await page.waitForTimeout(900);
	r.last = await page.evaluate(() => ({ v: __kd.get_value("last"), seen: __seen(__kd.fields_dict.last) }));
	// Shift+Tab back into a Select and change it by keyboard: Enter/Space open the es list, ArrowDown+Enter picks;
	// the native <select> takes ArrowDown directly. Record the value either way
	await page.keyboard.press("Shift+Tab");
	await page.waitForTimeout(150);
	r.back_on = await page.evaluate(() => __focus_field());
	r.es_back_active_tag = await page.evaluate(() => document.activeElement.tagName);
	r.es_pending_end = await page.evaluate(() => Object.values(__kd.fields_dict).filter((c) => c._es_ph || c._es_sel_pending).length);
	await page.evaluate(() => __kd.hide());
	return r;
};

function diff(a, b, p = "", out = []) {
	if (a === b) return out;
	if (a && b && typeof a === "object" && typeof b === "object") {
		for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
			if (k.startsWith("es_")) continue;
			diff(a[k], b[k], p + "." + k, out);
		}
		return out;
	}
	out.push(`${p}: legacy=${JSON.stringify(a)} es=${JSON.stringify(b)}`);
	return out;
}

(async () => {
	const label = process.argv[2] || "run";
	const browser = await chromium.launch();
	const res = {};
	for (const [name, fn] of Object.entries(SCEN)) {
		if (ONLY && !ONLY.includes(name)) continue;
		for (const mode of MODES) {
			const site = ["dialog-lifecycle", "grid"].includes(name) ? "v5" : "erp";
			const s = await open(site, { browser });
			if (mode === "legacy") await s.ctx.addInitScript(() => { window.__es_link_off = true; });
			if (mode.includes("+eager")) await s.ctx.addInitScript(() => { window.__es_lazy_off = true; });
			let out;
			try { out = await fn({ page: s.page, rec: s.rec, base: s.base }); } catch (e) { out = { fatal: (e.message || String(e)).slice(0, 900), at: (e.stack || "").split("\n").filter((l) => l.includes("break.cjs")).slice(0, 3).map((l) => l.trim()) }; }
			out.errors = s.rec.errors.slice(0, 10);
			(res[name] ||= {})[mode] = out;
			console.log(`== ${name} [${mode}]`, JSON.stringify(out).slice(0, 400));
			await s.ctx.close();
		}
	}
	await browser.close();
	fs.writeFileSync(path.join(OUT, `break-${label}.json`), JSON.stringify(res, null, 1));
	console.log("\n==== DIFF legacy vs es (es_* keys ignored)");
	for (const [name, m] of Object.entries(res)) {
		for (const mode of Object.keys(m).filter((k) => k !== "legacy")) {
			if (!m.legacy) continue;
			const d = diff(m.legacy, m[mode]);
			console.log(`-- ${name} [legacy vs ${mode}]: ${d.length} differences`);
			for (const x of d) console.log("   " + x.slice(0, 300));
		}
	}
})();
