// Differential flows for Link / Dynamic Link / Select. Each flow: async ({page, rec, r, base}) => void,
// recording steps with r.step(name, fn). Observations are plain JSON so two modes can be diffed.
// Selectors used: only the public control API (cur_frm.fields_dict.x, dialog.fields_dict.x, grid rows)
// and visible semantics. Keep flows variant-agnostic.
const { settle, wait_form } = require("./lib.cjs");
// legacy Link searches 500 ms after the last keystroke; wait past it before reading the list
const DEBOUNCE = 700;

// ---------- helpers ----------
const state = (page, p) => page.evaluate((p) => __tw.state(eval(p)), p);
const api = (page, p) => page.evaluate((p) => ({ api: __tw.api(eval(p)), structure: __tw.structure(eval(p)) }), p);
async function input_el(page, p) {
	const h = await page.evaluateHandle((p) => {
		const c = eval(p);
		return c && (c.input || (c.$input && c.$input[0]));
	}, p);
	const el = h.asElement();
	if (!el) throw new Error("no input for " + p);
	return el;
}
async function click_input(page, p) {
	// a list left open by the previous step can cover this input: blur first (closes it), like a user clicking away
	if (await page.evaluate(() => __tw.listbox_open())) {
		await page.evaluate(() => document.activeElement && document.activeElement.blur());
		await page.waitForTimeout(400);
	}
	const el = await input_el(page, p);
	await el.scrollIntoViewIfNeeded().catch(() => {});
	try {
		await el.click({ timeout: 4000 });
	} catch (e) {
		// something covers the input (a list or popover the control left open): focus it like a Tab would,
		// and record that the mouse could not reach it (listed per step under `fallbacks`)
		await page.evaluate((p) => (window.__tw.fallbacks = window.__tw.fallbacks || []).push("click->focus " + p), p);
		await el.focus();
	}
}
async function options(page, rec) {
	await settle(page, rec);
	return page.evaluate(() => {
		const o = __tw.options();
		return {
			count: o.length,
			rows: o.slice(0, 15),
			create_new: o.some((t) => /^Create a new/.test(t)),
			advanced_search: o.some((t) => /Advanced Search/.test(t)),
			filtered_by: o.find((t) => /Filtered by/.test(t)) || null,
			active: __tw.active_option(),
		};
	});
}
async function search(page, rec, p, text) {
	await click_input(page, p);
	await page.keyboard.press("Control+A");
	await page.keyboard.press("Backspace");
	if (text) await page.keyboard.type(text, { delay: 40 });
	await page.waitForTimeout(DEBOUNCE);
	return options(page, rec);
}
async function enter_pick(page, rec, p, wait = 800) {
	await page.keyboard.press("Enter");
	await page.waitForTimeout(wait);
	await settle(page, rec, { quiet: 300 });
	return { state: await state(page, p), listbox_open: await page.evaluate(() => __tw.listbox_open()) };
}
async function choose(page, p, label) {
	const el = await input_el(page, p);
	const tag = await el.evaluate((e) => e.tagName);
	if (tag === "SELECT") await el.selectOption({ label });
	else {
		await el.click();
		await page.locator('[role="option"]:visible', { hasText: label }).first().click();
	}
	await page.waitForTimeout(400);
	return state(page, p);
}
// move the active row with ArrowDown until it matches, then Enter (keyboard-only, variant-agnostic)
async function pick_row(page, rx, max = 20) {
	for (let i = 0; i < max; i++) {
		const a = await page.evaluate(() => __tw.active_option());
		if (a && new RegExp(rx).test(a)) { await page.keyboard.press("Enter"); return a; }
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(60);
	}
	throw new Error("no row matching " + rx);
}
const dialogs = (page) =>
	page.evaluate(() =>
		[...document.querySelectorAll('.modal.show, [role="dialog"]')]
			.filter(__tw.vis)
			.map((d) => __tw.text(d.querySelector(".modal-title, h1, h2, h3")))
	);
const alerts = (page) =>
	page.evaluate(() =>
		[...document.querySelectorAll("#alert-container .alert, .desk-alert, [data-sonner-toast], .toast")]
			.filter(__tw.vis)
			.map((a) => __tw.text(a))
	);
const watch = (page, map) => page.evaluate((map) => Object.entries(map).forEach(([l, p]) => __tw.watch(eval(p), l)), map);
const doc = (page, fields) => page.evaluate((f) => Object.fromEntries(f.map((k) => [k, cur_frm.doc[k] ?? null])), fields);
const clear_value = (page, p) => page.evaluate(async (p) => { await eval(p).set_value(""); }, p);

// ---------- v5 site ----------
async function form_todo({ page, rec, r, base }) {
	await page.goto(base + "/desk/todo/new");
	await wait_form(page, "ToDo");
	const F = (f) => `cur_frm.fields_dict.${f}`;
	await watch(page, Object.fromEntries(["allocated_to", "assigned_by", "status", "priority", "reference_type", "reference_name"].map((f) => [f, F(f)])));
	await page.evaluate(() => {
		const h = {};
		for (const f of ["allocated_to", "assigned_by", "status", "priority", "reference_name"]) h[f] = () => __tw.events.push("frm:" + f);
		frappe.ui.form.on("ToDo", h);
	});
	await r.step("api", async () => {
		const out = {};
		for (const f of ["allocated_to", "status", "reference_name"]) out[f] = await api(page, F(f));
		out.df_live = await page.evaluate(() => cur_frm.fields_dict.allocated_to.df === cur_frm.get_docfield("allocated_to"));
		return out;
	});
	await r.step("initial-state", async () => ({ allocated_to: await state(page, F("allocated_to")), status: await state(page, F("status")), priority: await state(page, F("priority")) }));
	await r.step("link-focus-opens-list", () => search(page, rec, F("allocated_to"), ""));
	await r.shot("link-focus-opens-list");
	await r.step("link-type-filters-list", async () => {
		await page.keyboard.type("frappe@", { delay: 40 });
		await page.waitForTimeout(DEBOUNCE);
		return options(page, rec);
	});
	await r.step("link-enter-picks-first", () => enter_pick(page, rec, F("allocated_to")));
	await r.step("link-blur-keeps-value", async () => {
		await page.keyboard.press("Tab");
		await page.waitForTimeout(900);
		return { state: await state(page, F("allocated_to")), doc: await doc(page, ["allocated_to"]) };
	});
	await r.step("set_query-filters", async () => {
		await clear_value(page, F("allocated_to"));
		await page.evaluate(() => cur_frm.set_query("allocated_to", () => ({ filters: { name: ["like", "%test_report%"] } })));
		const o = await search(page, rec, F("allocated_to"), "test");
		await page.keyboard.press("Escape");
		return o;
	});
	await r.step("get_query-assign", async () => {
		await page.evaluate(() => {
			cur_frm.fields_dict.allocated_to.get_query = () => ({ filters: { name: "Administrator" } });
		});
		const o = await search(page, rec, F("allocated_to"), "");
		await page.keyboard.press("Escape");
		await page.evaluate(() => {
			delete cur_frm.fields_dict.allocated_to.get_query;
			cur_frm.set_query("allocated_to", null);
		});
		return o;
	});
	await r.step("fetch_from", async () => {
		await search(page, rec, F("assigned_by"), "Administrator");
		await enter_pick(page, rec, F("assigned_by"), 1500);
		return { doc: await doc(page, ["assigned_by", "assigned_by_full_name"]), fetched: await state(page, F("assigned_by_full_name")) };
	});
	await r.step("set_value-from-code", async () => {
		const resolved = await page.evaluate(async () => {
			const p = cur_frm.set_value("allocated_to", "Administrator");
			const ok = p && typeof p.then === "function";
			await p;
			return ok;
		});
		await page.waitForTimeout(400);
		return { returns_promise: resolved, state: await state(page, F("allocated_to")) };
	});
	await r.step("control-set_value-get_value", async () => {
		const out = await page.evaluate(async () => {
			const c = cur_frm.fields_dict.allocated_to;
			const p = c.set_value("frappe@example.com");
			const promise = !!p && typeof p.then === "function";
			await p;
			return { promise, get_value: c.get_value(), doc: cur_frm.doc.allocated_to };
		});
		return { ...out, state: await state(page, F("allocated_to")) };
	});
	await r.step("invalid-value-on-blur", async () => {
		await clear_value(page, F("allocated_to"));
		await search(page, rec, F("allocated_to"), "no-such-user-xyz");
		await page.keyboard.press("Escape");
		await page.evaluate(() => document.activeElement.blur());
		await page.waitForTimeout(1500);
		return { state: await state(page, F("allocated_to")), alerts: await alerts(page) };
	});
	await r.step("clear-by-typing", async () => {
		await page.evaluate(() => cur_frm.set_value("allocated_to", "Administrator"));
		await page.waitForTimeout(400);
		await click_input(page, F("allocated_to"));
		await page.keyboard.press("Control+A");
		await page.keyboard.press("Backspace");
		await page.waitForTimeout(DEBOUNCE);
		await page.keyboard.press("Escape");
		await page.evaluate(() => document.activeElement.blur());
		await page.waitForTimeout(1000);
		return state(page, F("allocated_to"));
	});
	await r.step("read-only-display", async () => {
		await page.evaluate(async () => {
			await cur_frm.set_value("allocated_to", "Administrator");
			cur_frm.set_df_property("allocated_to", "read_only", 1);
		});
		await page.waitForTimeout(500);
		const ro = await state(page, F("allocated_to"));
		await page.evaluate(() => cur_frm.set_df_property("allocated_to", "read_only", 0));
		await page.waitForTimeout(300);
		return { read_only: ro, editable_again: await state(page, F("allocated_to")) };
	});
	await r.step("keyboard-arrows-escape", async () => {
		await clear_value(page, F("allocated_to"));
		await search(page, rec, F("allocated_to"), "");
		const first = await page.evaluate(() => __tw.active_option());
		await page.keyboard.press("ArrowDown");
		const second = await page.evaluate(() => __tw.active_option());
		await page.keyboard.press("ArrowUp");
		const back = await page.evaluate(() => __tw.active_option());
		await page.keyboard.press("Escape");
		await page.waitForTimeout(200);
		return { first, second, back, open_after_escape: await page.evaluate(() => __tw.listbox_open()), state: await state(page, F("allocated_to")) };
	});
	await r.step("keyboard-arrow-enter-picks-second", async () => {
		await search(page, rec, F("allocated_to"), "");
		await page.keyboard.press("ArrowDown");
		return enter_pick(page, rec, F("allocated_to"));
	});
	await r.step("select-options", async () => ({ status: await state(page, F("status")), priority: await state(page, F("priority")) }));
	await r.step("select-pick", async () => {
		const s = await choose(page, F("status"), "Closed");
		return { state: s, doc: await doc(page, ["status"]) };
	});
	await r.step("select-set_value", async () => {
		await page.evaluate(() => cur_frm.set_value("status", "Cancelled"));
		await page.waitForTimeout(300);
		return { state: await state(page, F("status")), doc: await doc(page, ["status"]) };
	});
	await r.step("select-set_df_property-options", async () => {
		await page.evaluate(() => {
			cur_frm.set_df_property("priority", "options", ["Low", "High"]);
		});
		await page.waitForTimeout(300);
		const after = await state(page, F("priority"));
		await page.evaluate(() => cur_frm.set_value("priority", "Medium"));
		await page.waitForTimeout(400);
		return { after, set_missing_option: await state(page, F("priority")), doc: await doc(page, ["priority"]) };
	});
	await r.step("dynamic-link", async () => {
		await page.evaluate(() => cur_frm.set_value("reference_type", "User"));
		await page.waitForTimeout(500);
		const o = await search(page, rec, F("reference_name"), "Admin");
		const picked = await enter_pick(page, rec, F("reference_name"));
		return { options: o, picked, doc: await doc(page, ["reference_type", "reference_name"]) };
	});
	await r.step("enter-on-action-row-with-unmatched-text", async () => {
		// legacy refuses Enter/Tab on a row the typed text does not match ("adm" vs "Advanced Search")
		await clear_value(page, F("allocated_to"));
		await search(page, rec, F("allocated_to"), "adm");
		const row = await pick_row(page, "Advanced Search");
		await page.waitForTimeout(1200);
		const out = { row, dialogs: await dialogs(page), list_open: await page.evaluate(() => __tw.listbox_open()), state: await state(page, F("allocated_to")) };
		await page.keyboard.press("Escape");
		await page.evaluate(() => window.cur_dialog && cur_dialog.hide());
		return out;
	});
	await r.step("advanced-search", async () => {
		await clear_value(page, F("allocated_to"));
		await search(page, rec, F("allocated_to"), "adm");
		await page.locator('[role="option"]:visible', { hasText: "Advanced Search" }).first().click({ timeout: 8000 });
		await page.waitForTimeout(1500);
		const d = await dialogs(page);
		await page.evaluate(() => cur_dialog && cur_dialog.hide());
		await page.waitForTimeout(400);
		return { dialogs: d };
	});
	await r.step("create-new", async () => {
		await search(page, rec, F("allocated_to"), "tw-new-user");
		await page.locator('[role="option"]:visible', { hasText: "Create a new" }).first().click({ timeout: 8000 });
		await page.waitForTimeout(2500);
		return {
			route: await page.evaluate(() => frappe.get_route().slice(0, 2)),
			dialogs: await dialogs(page),
			from_link: await page.evaluate(() => !!frappe._from_link && frappe._from_link.field_obj?.df?.fieldname),
			route_options: await page.evaluate(() => frappe.route_options || null),
		};
	});
}

async function form_user_titles({ page, rec, r, base }) {
	await page.goto(base + "/desk/user/Administrator");
	await wait_form(page, "User");
	const F = (f) => `cur_frm.fields_dict.${f}`;
	await page.evaluate(() => cur_frm.scroll_to_field && cur_frm.scroll_to_field("language"));
	await page.waitForTimeout(500);
	await watch(page, { language: F("language"), gender: F("gender") });
	await r.step("api", async () => ({ language: await api(page, F("language")), desk_theme: await api(page, F("desk_theme")) }));
	await r.step("title-link-initial", async () => ({ language: await state(page, F("language")), is_title_link: await page.evaluate(() => cur_frm.fields_dict.language.is_title_link?.() ?? null) }));
	await r.step("title-link-search", () => search(page, rec, F("language"), "Deutsch"));
	await r.step("title-link-pick", async () => ({ ...(await enter_pick(page, rec, F("language"), 1200)), doc: await doc(page, ["language"]) }));
	await r.step("title-link-set_value", async () => {
		await page.evaluate(() => cur_frm.set_value("language", "fr"));
		await page.waitForTimeout(1200);
		return { state: await state(page, F("language")), doc: await doc(page, ["language"]) };
	});
	await r.step("translated-doctype-link", async () => {
		await page.evaluate(() => cur_frm.set_value("gender", "Female"));
		await page.waitForTimeout(800);
		return { state: await state(page, F("gender")), translatable: await page.evaluate(() => cur_frm.fields_dict.gender.is_translatable?.() ?? null) };
	});
	await r.step("select-in-form", async () => ({ desk_theme: await state(page, F("desk_theme")) }));
}

async function dialog_flow({ page, rec, r, base }) {
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => window.frappe && frappe.ui && frappe.ui.Dialog && frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	const D = (f) => `__twd.fields_dict.${f}`;
	await r.step("make-dialog", async () => {
		await page.evaluate(() => {
			window.__twd = new frappe.ui.Dialog({
				title: "TW Dialog",
				fields: [
					{ fieldname: "user", fieldtype: "Link", options: "User", label: "User", get_query: () => ({ filters: { name: ["like", "%example.com"] } }), onchange() { __tw.events.push("df:user.onchange"); } },
					{ fieldname: "note", fieldtype: "Link", options: "Note", label: "Note" },
					{ fieldname: "role", fieldtype: "Link", options: "Role", label: "Role", only_select: 1, filters: { disabled: 0 } },
					{ fieldname: "dt", fieldtype: "Link", options: "DocType", label: "Doc Type" },
					{ fieldname: "dn", fieldtype: "Dynamic Link", options: "dt", label: "Doc Name" },
					{ fieldname: "kind", fieldtype: "Select", label: "Kind", options: [{ label: "Alpha", value: "a" }, { label: "Beta", value: "b" }], default: "b", onchange() { __tw.events.push("df:kind.onchange"); } },
					{ fieldname: "plain", fieldtype: "Select", label: "Plain", options: "\nOne\nTwo" },
				],
			});
			__twd.show();
		});
		await page.waitForTimeout(800);
		await watch(page, { user: D("user"), role: D("role"), kind: D("kind"), dn: D("dn") });
		return { dialogs: await dialogs(page), values: await page.evaluate(() => __twd.get_values(true)) };
	});
	await r.step("api", async () => ({ user: await api(page, D("user")), dn: await api(page, D("dn")), kind: await api(page, D("kind")) }));
	await r.step("link-get_query-in-df", () => search(page, rec, D("user"), ""));
	await r.step("link-pick", async () => ({ ...(await enter_pick(page, rec, D("user"))), value: await page.evaluate(() => __twd.get_value("user")) }));
	await r.step("only_select-and-df.filters", async () => {
		const o = await search(page, rec, D("role"), "Sys");
		await page.keyboard.press("Escape");
		return o;
	});
	await r.step("escape-closes-list-not-dialog", async () => {
		await search(page, rec, D("role"), "");
		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);
		return { list_open: await page.evaluate(() => __tw.listbox_open()), dialogs: await dialogs(page) };
	});
	await r.step("dynamic-link-in-dialog", async () => {
		await page.evaluate(() => __twd.set_value("dt", "Role"));
		await page.waitForTimeout(500);
		const o = await search(page, rec, D("dn"), "Guest");
		const p = await enter_pick(page, rec, D("dn"));
		return { options: o, picked: p, value: await page.evaluate(() => __twd.get_value("dn")) };
	});
	await r.step("select-label-value", async () => {
		const before = await state(page, D("kind"));
		const after = await choose(page, D("kind"), "Alpha");
		return { before, after, value: await page.evaluate(() => __twd.get_value("kind")) };
	});
	await r.step("select-set_value-and-options", async () => {
		await page.evaluate(() => __twd.set_value("plain", "Two"));
		await page.waitForTimeout(300);
		const a = await state(page, D("plain"));
		await page.evaluate(() => __twd.set_df_property("plain", "options", "X\nY"));
		await page.waitForTimeout(300);
		return { after_set_value: a, after_options: await state(page, D("plain")), value: await page.evaluate(() => __twd.get_value("plain")) };
	});
	await r.step("create-new-quick-entry", async () => {
		await search(page, rec, D("note"), "TW quick note");
		await page.locator('[role="option"]:visible', { hasText: "Create a new" }).first().click({ timeout: 8000 });
		await page.waitForTimeout(2500);
		const out = {
			dialogs: await dialogs(page),
			quick_entry_values: await page.evaluate(() => (window.cur_dialog && cur_dialog !== __twd ? cur_dialog.get_values(true) : null)),
		};
		await page.evaluate(() => window.cur_dialog && cur_dialog !== __twd && cur_dialog.hide());
		await page.waitForTimeout(500);
		return out;
	});
	await r.step("dialog-values", async () => {
		const v = await page.evaluate(() => __twd.get_values(true));
		await page.evaluate(() => __twd.hide());
		return v;
	});
}

async function grid_workflow({ page, rec, r, base }) {
	await page.goto(base + "/desk/workflow/new");
	await wait_form(page, "Workflow");
	const G = "cur_frm.fields_dict.states.grid";
	await r.step("add-row-and-open-cell", async () => {
		await page.evaluate(() => {
			cur_frm.fields_dict.states.grid.add_new_row();
		});
		await page.waitForTimeout(500);
		// click the static cell of the first column to make the row editable
		const cell = page.locator('[data-fieldname="states"] .grid-body .grid-row').first().locator('[data-fieldname="state"]').first();
		await cell.click();
		await page.waitForTimeout(700);
		return page.evaluate(() => {
			const row = cur_frm.fields_dict.states.grid.grid_rows[0];
			const c = row.on_grid_fields_dict && row.on_grid_fields_dict.state;
			return { has_control: !!c, api: __tw.api(c), focused: document.activeElement === (c && c.input) };
		});
	});
	const RC = (f) => `cur_frm.fields_dict.states.grid.grid_rows[0].on_grid_fields_dict.${f}`;
	await watch(page, { state: RC("state"), allow_edit: RC("allow_edit"), doc_status: RC("doc_status") });
	await r.step("grid-link-search", () => search(page, rec, RC("state"), "Appr"));
	await r.step("grid-link-pick", async () => ({
		...(await enter_pick(page, rec, RC("state"))),
		row: await page.evaluate(() => ({ state: cur_frm.doc.states[0].state })),
	}));
	await r.step("grid-get_field-get_query", async () => {
		await page.evaluate(() => {
			cur_frm.fields_dict.states.grid.get_field("allow_edit").get_query = () => ({ filters: { name: ["in", ["System Manager", "Guest"]] } });
		});
		const o = await search(page, rec, RC("allow_edit"), "");
		const p = await enter_pick(page, rec, RC("allow_edit"));
		return { options: o, picked: p, row: await page.evaluate(() => cur_frm.doc.states[0].allow_edit) };
	});
	await r.step("grid-select", async () => {
		const s0 = await state(page, RC("doc_status"));
		const s1 = await choose(page, RC("doc_status"), "1");
		return { before: s0, after: s1, row: await page.evaluate(() => cur_frm.doc.states[0].doc_status) };
	});
	await r.step("grid-arrow-keys-while-list-open", async () => {
		await page.evaluate(() => cur_frm.fields_dict.states.grid.add_new_row());
		await page.waitForTimeout(400);
		await search(page, rec, RC("state"), "");
		const before = await page.evaluate(() => __tw.active_option());
		await page.keyboard.press("ArrowDown");
		const after = await page.evaluate(() => __tw.active_option());
		await page.keyboard.press("Escape");
		return { before, after, focused_row_is_first: await page.evaluate(() => document.activeElement === cur_frm.fields_dict.states.grid.grid_rows[0].on_grid_fields_dict.state.input) };
	});
	await r.step("grid-update_docfield_property-read_only", async () => {
		await page.evaluate(() => {
			cur_frm.fields_dict.states.grid.update_docfield_property("allow_edit", "read_only", 1);
			cur_frm.refresh_field("states");
		});
		await page.waitForTimeout(500);
		return page.evaluate(() => {
			const row = cur_frm.fields_dict.states.grid.grid_rows[0];
			const col = row.columns && row.columns.allow_edit;
			return { static_text: col ? __tw.text((col.static_area || col)[0]) : null };
		});
	});
	await r.step("grid-set_value-from-code", async () => {
		await page.evaluate(() => {
			const d = cur_frm.doc.states[0];
			return frappe.model.set_value(d.doctype, d.name, "state", "Rejected");
		});
		await page.waitForTimeout(600);
		return page.evaluate(() => {
			const row = cur_frm.fields_dict.states.grid.grid_rows[0];
			return { row: cur_frm.doc.states[0].state, static_text: __tw.text((row.columns.state.static_area || row.columns.state)[0]) };
		});
	});
}

async function quick_entry({ page, rec, r, base }) {
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => window.frappe && frappe.ui && frappe.ui.form && frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	await r.step("open", async () => {
		await page.evaluate(() => frappe.ui.form.make_quick_entry("Address"));
		await page.waitForFunction(() => window.cur_dialog && cur_dialog.fields_dict && cur_dialog.fields_dict.country, null, { timeout: 20000 });
		await page.waitForTimeout(600);
		return { dialogs: await dialogs(page), fields: await page.evaluate(() => Object.keys(cur_dialog.fields_dict).filter((f) => ["Link", "Select", "Dynamic Link"].includes(cur_dialog.fields_dict[f].df.fieldtype))) };
	});
	const Q = (f) => `cur_dialog.fields_dict.${f}`;
	await watch(page, { country: Q("country"), address_type: Q("address_type") });
	await r.step("api", async () => ({ country: await api(page, Q("country")), address_type: await api(page, Q("address_type")) }));
	await r.step("select", async () => ({ before: await state(page, Q("address_type")), after: await choose(page, Q("address_type"), "Office") }));
	await r.step("link-search", () => search(page, rec, Q("country"), "Germ"));
	await r.step("link-pick", async () => ({ ...(await enter_pick(page, rec, Q("country"))), values: await page.evaluate(() => ({ country: cur_dialog.get_value("country"), address_type: cur_dialog.get_value("address_type") })) }));
	await page.evaluate(() => cur_dialog && cur_dialog.hide());
}

async function standalone({ page, rec, r, base }) {
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => window.frappe && frappe.ui && frappe.ui.form && frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	await r.step("make_control-only_input", async () => {
		return page.evaluate(() => {
			const $p = $('<div id="tw-standalone" style="position:fixed;top:120px;left:300px;width:320px;z-index:2000;background:var(--bg-color)">').appendTo(document.body);
			window.__tws = frappe.ui.form.make_control({
				parent: $p,
				df: {
					fieldtype: "Link", options: "User", fieldname: "user", placeholder: "Pick user",
					get_route_options_for_new_doc: () => ({ first_name: "TW" }),
					onchange: () => __tw.events.push("df:onchange:" + window.__tws.get_value()),
				},
				render_input: true,
				only_input: true,
			});
			__tws.set_input("Administrator");
			let style_ok = true;
			try { Object.assign(__tws.awesomplete.ul.style, { position: "fixed", zIndex: 1050 }); } catch (e) { style_ok = e.message; }
			__tw.watch(__tws, "standalone");
			return { state: __tw.state(__tws), api: __tw.api(__tws), structure: __tw.structure(__tws), style_ok };
		});
	});
	await r.step("only_input-search-pick", async () => {
		const o = await search(page, rec, "__tws", "frappe");
		const p = await enter_pick(page, rec, "__tws");
		return { options: o, picked: p };
	});
	await r.step("make_control-only_select", async () => {
		await page.evaluate(() => {
			window.__tws2 = frappe.ui.form.make_control({
				parent: $("#tw-standalone"),
				df: { fieldtype: "Link", options: "Role", fieldname: "role", only_select: true, label: "Role" },
				render_input: true,
			});
			__tws2.toggle_label(false);
			__tws2.refresh();
		});
		const o = await search(page, rec, "__tws2", "");
		await page.keyboard.press("Escape");
		return o;
	});
	await r.step("make_control-select", async () => {
		return page.evaluate(() => {
			window.__tws3 = frappe.ui.form.make_control({
				parent: $("#tw-standalone"),
				df: { fieldtype: "Select", options: ["", "Open", "Closed"], fieldname: "st", label: "Status" },
				render_input: true,
			});
			__tws3.set_value("Closed");
			return { state: __tw.state(__tws3), api: __tw.api(__tws3), structure: __tw.structure(__tws3) };
		});
	});
	await page.evaluate(() => $("#tw-standalone").remove());
}

async function translation({ page, rec, r, base }) {
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => window.frappe && frappe.ui && frappe.ui.form && frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	await page.evaluate(() => {
		Object.assign(frappe._messages, { Open: "Offen-tw", Closed: "Geschlossen-tw", Guest: "Gast-tw", "System Manager": "Systemverwalter-tw" });
		$('<div id="tw-tr" style="position:fixed;top:120px;left:300px;width:320px;z-index:2000;background:var(--bg-color)">').appendTo(document.body);
	});
	await r.step("select-option-labels-translated", () =>
		page.evaluate(() => {
			window.__twt = frappe.ui.form.make_control({ parent: $("#tw-tr"), df: { fieldtype: "Select", options: "Open\nClosed", fieldname: "st", label: "Status" }, render_input: true });
			__twt.refresh();
			const a = __tw.state(__twt);
			__twt.set_value("Closed");
			return { initial: a, after_set: __tw.state(__twt) };
		})
	);
	await r.step("translated-link-value", async () => {
		await page.evaluate(() => {
			window.__twg = frappe.ui.form.make_control({ parent: $("#tw-tr"), df: { fieldtype: "Link", options: "Role", fieldname: "role", label: "Role" }, render_input: true });
			__twg.refresh();
			return __twg.set_value("Guest");
		});
		await page.waitForTimeout(500);
		return state(page, "__twg");
	});
	await r.step("translated-link-options", async () => {
		const o = await search(page, rec, "__twg", "System Man");
		const p = await enter_pick(page, rec, "__twg");
		return { options: o, picked: p };
	});
	await page.evaluate(() => {
		for (const k of ["Open", "Closed", "Guest", "System Manager"]) delete frappe._messages[k];
		$("#tw-tr").remove();
	});
}

async function web_form({ page, rec, r, base }) {
	await page.goto(base + "/update-profile/Administrator/edit");
	await page.waitForFunction(() => window.frappe && frappe.web_form && frappe.web_form.fields_dict && frappe.web_form.fields_dict.language, null, { timeout: 30000 });
	await page.waitForTimeout(1000);
	const W = (f) => `frappe.web_form.fields_dict.${f}`;
	await watch(page, { language: W("language"), time_zone: W("time_zone") });
	await r.step("api", async () => ({ language: await api(page, W("language")), time_zone: await api(page, W("time_zone")) }));
	await r.step("initial", async () => ({ language: await state(page, W("language")), tz: await page.evaluate(() => frappe.web_form.get_value("time_zone")) }));
	await r.step("link-search", () => search(page, rec, W("language"), "Deut"));
	await r.step("link-pick", async () => ({ ...(await enter_pick(page, rec, W("language"))), value: await page.evaluate(() => frappe.web_form.get_value("language")) }));
	await r.step("select-pick", async () => {
		const s = await choose(page, W("time_zone"), "Europe/Berlin");
		return { input_value: s.input_value, value: await page.evaluate(() => frappe.web_form.get_value("time_zone")) };
	});
}

// ---------- erp site ----------
async function sales_invoice({ page, rec, r, base }) {
	await page.goto(base + "/desk/sales-invoice/new");
	await wait_form(page, "Sales Invoice");
	const F = (f) => `cur_frm.fields_dict.${f}`;
	await watch(page, { customer: F("customer"), naming_series: F("naming_series") });
	await r.step("api", async () => ({ customer: await api(page, F("customer")), naming_series: await api(page, F("naming_series")) }));
	await r.step("customer-search", () => search(page, rec, F("customer"), ""));
	await r.step("customer-type-pick", async () => {
		await page.keyboard.type("Beta", { delay: 40 });
		await page.waitForTimeout(DEBOUNCE);
		await options(page, rec);
		const p = await enter_pick(page, rec, F("customer"), 3000);
		return { ...p, doc: await doc(page, ["customer", "customer_name", "company", "currency", "selling_price_list"]) };
	});
	await r.step("naming-series-select", async () => ({ state: await state(page, F("naming_series")) }));
	const IC = "cur_frm.fields_dict.items.grid.grid_rows[0].on_grid_fields_dict.item_code";
	await r.step("items-grid-open", async () => {
		const cell = page.locator('[data-fieldname="items"] .grid-body .grid-row').first().locator('[data-fieldname="item_code"]').first();
		await cell.scrollIntoViewIfNeeded();
		await cell.click();
		await page.waitForTimeout(800);
		return page.evaluate(() => {
			const row = cur_frm.fields_dict.items.grid.grid_rows[0];
			return { has_control: !!(row.on_grid_fields_dict && row.on_grid_fields_dict.item_code), api: __tw.api(row.on_grid_fields_dict.item_code) };
		});
	});
	await r.step("items-grid-search", () => search(page, rec, IC, "Widget 2"));
	await r.step("items-grid-pick", async () => {
		await enter_pick(page, rec, IC, 3500);
		return page.evaluate(() => {
			const d = cur_frm.doc.items[0];
			return { item_code: d.item_code, item_name: d.item_name, uom: d.uom, qty: d.qty };
		});
	});
	await r.step("read-only-display", async () => {
		await page.evaluate(() => cur_frm.set_df_property("customer", "read_only", 1));
		await page.waitForTimeout(400);
		const s = await state(page, F("customer"));
		await page.evaluate(() => cur_frm.set_df_property("customer", "read_only", 0));
		return s;
	});
	await r.step("set_value-from-code", async () => {
		await page.evaluate(() => cur_frm.set_value("customer", "TW Cust Gamma"));
		await page.waitForTimeout(3000);
		return { state: await state(page, F("customer")), doc: await doc(page, ["customer", "customer_name"]) };
	});
}

async function stock_entry({ page, rec, r, base }) {
	await page.goto(base + "/desk/stock-entry/new");
	await wait_form(page, "Stock Entry");
	const F = (f) => `cur_frm.fields_dict.${f}`;
	await watch(page, { stock_entry_type: F("stock_entry_type"), from_warehouse: F("from_warehouse"), purpose: F("purpose") });
	await r.step("api", async () => ({ stock_entry_type: await api(page, F("stock_entry_type")), purpose: await api(page, F("purpose")) }));
	await r.step("type-search", () => search(page, rec, F("stock_entry_type"), "Transfer"));
	await r.step("type-pick-fetches-purpose", async () => ({
		...(await enter_pick(page, rec, F("stock_entry_type"), 2500)),
		doc: await doc(page, ["stock_entry_type", "purpose"]),
		purpose: await state(page, F("purpose")),
	}));
	await r.step("warehouse-get_query", async () => {
		// "Default Warehouse" is a collapsed section: open it the way apps do
		await page.evaluate(() => cur_frm.scroll_to_field("from_warehouse"));
		await page.waitForTimeout(600);
		return search(page, rec, F("from_warehouse"), "");
	});
	await r.step("warehouse-pick", async () => ({ ...(await enter_pick(page, rec, F("from_warehouse"), 2000)), doc: await doc(page, ["from_warehouse"]), row_s_wh: await page.evaluate(() => cur_frm.doc.items?.[0]?.s_warehouse ?? null) }));
	const IC = (f) => `cur_frm.fields_dict.items.grid.grid_rows[0].on_grid_fields_dict.${f}`;
	await r.step("items-grid-item", async () => {
		const cell = page.locator('[data-fieldname="items"] .grid-body .grid-row').first().locator('[data-fieldname="item_code"]').first();
		await cell.scrollIntoViewIfNeeded();
		await cell.click();
		await page.waitForTimeout(800);
		const o = await search(page, rec, IC("item_code"), "Widget 1");
		await enter_pick(page, rec, IC("item_code"), 3000);
		return { options: o, row: await page.evaluate(() => { const d = cur_frm.doc.items[0]; return { item_code: d.item_code, s_warehouse: d.s_warehouse, uom: d.uom }; }) };
	});
}

module.exports = {
	v5: { form_todo, form_user_titles, dialog: dialog_flow, grid_workflow, quick_entry, standalone, translation, web_form },
	erp: { sales_invoice, stock_entry },
};
