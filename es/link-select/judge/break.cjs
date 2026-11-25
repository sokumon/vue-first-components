// judge/break.cjs <label> : adversarial checks not in the shared harness, variant-agnostic (public API +
// what the user sees). Writes ../results/judge/break-<label>.json. Run under the bench lock.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open, settle, wait_form } = require("../harness/lib.cjs");

// in-page helpers, installed after load
function helpers() {
	const vis = __tw.vis, text = __tw.text;
	// what the user sees for a control: the visible input/select/trigger value, or the read-only display
	window.__seen = (c) => {
		if (!c || !c.$wrapper) return null;
		const w = c.$wrapper[0];
		const ci = w.querySelector(".control-input") || w;
		// really visible: not a 1px clipped / transparent / aria-hidden stand-in (both variants keep the native <select> that way)
		const shown = (e) => { if (!vis(e) || e.closest("[aria-hidden=true]")) return false; const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(e).opacity !== "0"; };
		const els = [...ci.querySelectorAll("input, select, button, [role=combobox]")].filter(shown);
		const el = els[0];
		if (el && vis(ci)) {
			if (el.tagName === "SELECT") return { m: "in", t: el.selectedOptions[0] ? text(el.selectedOptions[0]) : "" };
			if (el.tagName === "INPUT") return { m: "in", t: el.value };
			return { m: "in", t: text(el) };
		}
		const d = c.disp_area;
		return { m: vis(d) ? "disp" : "none", t: vis(d) ? text(d) : null, href: d ? $(d).find("a").attr("href") || null : null };
	};
	window.__seen_all = (fd) => {
		const out = {};
		for (const [k, c] of Object.entries(fd)) {
			const ft = c.df && c.df.fieldtype;
			if (!["Link", "Dynamic Link", "Select"].includes(ft)) continue;
			if (!c.$wrapper || !vis(c.$wrapper[0])) continue;
			out[k] = { v: c.get_value ? __tw.safe(() => c.get_value()) : null, seen: __seen(c) };
		}
		return out;
	};
	window.__raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

const F = (f) => `cur_frm.fields_dict.${f}`;
const seen = (page, p) => page.evaluate((p) => __seen(eval(p)), p);
const val = (page, p) => page.evaluate((p) => ({ v: __tw.safe(() => eval(p).get_value()), input: eval(p).$input && eval(p).$input.val() }), p);
const nreq = (rec) => rec.requests.filter((r) => /search_link|search_widget/.test(r.method)).length;

async function ensure_todos(page) {
	return page.evaluate(async () => {
		const mk = async (description, allocated_to, priority, status, reference_type, reference_name) => {
			const ex = await frappe.db.get_list("ToDo", { filters: { description }, fields: ["name"] });
			if (ex.length) return ex[0].name;
			const d = await frappe.db.insert({ doctype: "ToDo", description, allocated_to, priority, status, reference_type, reference_name });
			return d.name;
		};
		return [await mk("JUDGE one", "Administrator", "High", "Open", "User", "Administrator"), await mk("JUDGE two", "Guest", "Low", "Cancelled", "Role", "System Manager")];
	});
}

async function goto_form(page, dt, name) {
	await page.evaluate(([dt, name]) => frappe.set_route("Form", dt, name), [dt, name]);
	await page.waitForFunction(([dt, name]) => window.cur_frm && cur_frm.doctype === dt && cur_frm.docname === name && cur_frm.layout.wrapper.is(":visible"), [dt, name], { timeout: 30000 });
	await page.waitForTimeout(900);
}
const todo_seen = (page) => page.evaluate(() => Object.fromEntries(["allocated_to", "status", "priority", "reference_type", "reference_name"].map((f) => [f, { v: cur_frm.doc[f] ?? null, seen: __seen(cur_frm.fields_dict[f]) }])));

async function v5(browser, out) {
	const s = await open("v5", { browser });
	const { page, rec } = s;
	const step = async (name, fn) => {
		if (process.env.STEPS && !process.env.STEPS.split(",").includes(name)) return;
		const e0 = rec.errors.length;
		try { out[name] = await fn(); } catch (e) { out[name] = { error: (e.message || String(e)).split("\n")[0].slice(0, 200) }; }
		if (rec.errors.length > e0) (out[name] = out[name] || {}).console_errors = rec.errors.slice(e0).map((x) => x.slice(0, 160));
		console.log(name, JSON.stringify(out[name]).slice(0, 220));
	};
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(1500);
	await page.reload();
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(2500);
	await page.evaluate(helpers);
	const [J1, J2] = await ensure_todos(page);

	await step("form-switch-docs", async () => {
		await goto_form(page, "ToDo", J1);
		const a = await todo_seen(page);
		await goto_form(page, "ToDo", J2);
		const b = await todo_seen(page);
		await goto_form(page, "ToDo", J1);
		const c = await todo_seen(page);
		await page.evaluate(() => cur_frm.reload_doc());
		await page.waitForTimeout(1200);
		const d = await todo_seen(page);
		return { J1: a, J2: b, J1_again: c, after_reload_doc: d };
	});
	await step("switch-doc-with-list-open", async () => {
		await goto_form(page, "ToDo", J1);
		await page.evaluate(() => cur_frm.fields_dict.allocated_to.$input[0].focus());
		await page.keyboard.press("Control+A");
		await page.keyboard.type("Gu", { delay: 40 });
		await page.waitForTimeout(900);
		await settle(page, rec);
		const open_before = await page.evaluate(() => __tw.options().length);
		await page.evaluate((n) => frappe.set_route("Form", "ToDo", n), J2);
		await page.waitForFunction((n) => cur_frm.docname === n && cur_frm.layout.wrapper.is(":visible"), J2);
		await page.waitForTimeout(1200);
		const r = { open_before, listbox_after: await page.evaluate(() => __tw.options()), J2: await todo_seen(page) };
		await goto_form(page, "ToDo", J1);
		r.J1_doc = await page.evaluate(() => ({ allocated_to: cur_frm.doc.allocated_to, dirty: cur_frm.is_dirty() }));
		r.J1 = await todo_seen(page);
		return r;
	});
	await step("read-only-toggle", async () => {
		await goto_form(page, "ToDo", J1);
		await page.evaluate(() => ["allocated_to", "status", "reference_name"].forEach((f) => cur_frm.set_df_property(f, "read_only", 1)));
		await page.waitForTimeout(400);
		const ro = await todo_seen(page);
		await page.evaluate(() => ["allocated_to", "status", "reference_name"].forEach((f) => cur_frm.set_df_property(f, "read_only", 0)));
		await page.waitForTimeout(400);
		const rw = await todo_seen(page);
		await page.evaluate(() => { cur_frm.toggle_enable("priority", false); });
		await page.waitForTimeout(300);
		const dis = await seen(page, F("priority"));
		await page.evaluate(() => { cur_frm.toggle_enable("priority", true); });
		await page.evaluate(() => { cur_frm.set_read_only(); cur_frm.refresh_fields(); });
		await page.waitForTimeout(500);
		const whole = await todo_seen(page);
		await page.evaluate(() => cur_frm.reload_doc());
		await page.waitForTimeout(1200);
		return { ro, rw, toggle_enable_false: dis, frm_set_read_only: whole, after_reload: await todo_seen(page) };
	});
	await step("fast-typing", async () => {
		await page.goto(s.base + "/desk/todo/new");
		await wait_form(page, "ToDo");
		await page.evaluate(helpers);
		const r = {};
		const go = async (txt, key, pause, label) => {
			await page.evaluate(() => { const c = cur_frm.fields_dict.allocated_to; c.$input[0].focus(); });
			await page.keyboard.press("Control+A");
			await page.keyboard.press("Backspace");
			const n0 = nreq(rec);
			await page.keyboard.type(txt, { delay: 8 });
			if (pause) await page.waitForTimeout(pause);
			await page.keyboard.press(key);
			await page.waitForTimeout(1600);
			await settle(page, rec);
			r[label] = { ...(await val(page, F("allocated_to"))), model: await page.evaluate(() => cur_frm.doc.allocated_to ?? null), searches: nreq(rec) - n0, list_open: await page.evaluate(() => __tw.options().length > 0) };
			await page.evaluate(() => document.activeElement && document.activeElement.blur());
			await page.waitForTimeout(500);
		};
		await go("Administrator", "Tab", 0, "full-name-then-Tab-at-once");
		await go("zzqq", "Tab", 0, "garbage-then-Tab-at-once");
		await go("Admi", "Enter", 80, "prefix-Enter-before-debounce");
		await go("Admi", "Enter", 1000, "prefix-Enter-after-results");
		await go("Gu", "Enter", 30, "short-Enter-before-debounce");
		// type, delete, retype quickly
		await page.evaluate(() => cur_frm.fields_dict.allocated_to.$input[0].focus());
		await page.keyboard.press("Control+A");
		const n0 = nreq(rec);
		await page.keyboard.type("Gue", { delay: 5 });
		await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace");
		await page.keyboard.type("Adm", { delay: 5 });
		await page.waitForTimeout(1000);
		await settle(page, rec);
		r["retype-list"] = { rows: await page.evaluate(() => __tw.options().slice(0, 4)), active: await page.evaluate(() => __tw.active_option()), searches: nreq(rec) - n0, last_txt: rec.requests.filter((x) => /search_link/.test(x.method)).slice(-1)[0]?.txt };
		await page.keyboard.press("Enter");
		await page.waitForTimeout(1200);
		r["retype-pick"] = await val(page, F("allocated_to"));
		return r;
	});
	await step("app-patterns", async () => {
		await page.goto(s.base + "/desk/todo/new");
		await wait_form(page, "ToDo");
		await page.evaluate(helpers);
		const r = {};
		// Select: app code sets the native value and triggers change
		r.select_val_trigger = await page.evaluate(async () => {
			cur_frm.fields_dict.status.$input.val("Closed").trigger("change");
			await new Promise((r) => setTimeout(r, 400));
			return { doc: cur_frm.doc.status, seen: __seen(cur_frm.fields_dict.status) };
		});
		// Select: rebuild options on $input directly, then set_value
		r.select_add_options = await page.evaluate(async () => {
			const c = cur_frm.fields_dict.priority;
			c.$input.empty().add_options(["Low", "Medium"]);
			await c.set_value("Medium");
			await new Promise((r) => setTimeout(r, 400));
			return { doc: cur_frm.doc.priority, opts: c.$input.find("option").toArray().map((o) => o.value), seen: __seen(c) };
		});
		// Select: user picks through what is visible; then read $input
		r.select_user_pick = await (async (r) => {
			const before = await page.evaluate(() => { const c = cur_frm.fields_dict.status; c.df.options = "Open\nClosed\nCancelled"; c.refresh(); return __seen(c); });
			const h = await page.evaluateHandle(() => { const w = cur_frm.fields_dict.status.$wrapper[0]; return [...w.querySelectorAll(".control-input select, .control-input button, .control-input [role=combobox]")].filter((e) => __tw.vis(e) && !e.closest("[aria-hidden=true]") && e.getBoundingClientRect().width > 4 && getComputedStyle(e).opacity !== "0")[0]; });
			r.select_pick_via = await h.evaluate((e) => e.tagName);
			const el = h.asElement();
			const tag = await el.evaluate((e) => e.tagName);
			if (tag === "SELECT") await el.selectOption({ label: "Cancelled" });
			else { await el.click(); await page.waitForTimeout(300); await page.locator('[role="option"]:visible', { hasText: "Cancelled" }).first().click(); }
			await page.waitForTimeout(500);
			return { before, after: await page.evaluate(() => ({ doc: cur_frm.doc.status, input: cur_frm.fields_dict.status.$input.val(), seen: __seen(cur_frm.fields_dict.status) })) };
		})(r);
		// Link: focus from code opens the list
		r.link_focus_from_code = await (async () => {
			await page.evaluate(() => cur_frm.fields_dict.allocated_to.$input.focus());
			await page.waitForTimeout(1200);
			await settle(page, rec);
			const o = await page.evaluate(() => __tw.options().length);
			await page.keyboard.press("Escape");
			return { rows: o, active_is_input: await page.evaluate(() => document.activeElement === cur_frm.fields_dict.allocated_to.$input[0]) };
		})();
		// Link: barcode-style: write $input value + trigger input, then blur
		r.link_val_trigger_input = await (async () => {
			await page.evaluate(() => { const c = cur_frm.fields_dict.assigned_by; c.$input.focus(); c.$input.val("Guest").trigger("input"); });
			await page.waitForTimeout(1100);
			await settle(page, rec);
			const rows = await page.evaluate(() => __tw.options().slice(0, 3));
			await page.evaluate(() => cur_frm.fields_dict.assigned_by.$input.trigger("blur"));
			await page.evaluate(() => document.activeElement && document.activeElement.blur());
			await page.waitForTimeout(1500);
			return { rows, ...(await val(page, F("assigned_by"))), doc: await page.evaluate(() => cur_frm.doc.assigned_by ?? null), list_open: await page.evaluate(() => __tw.options().length > 0) };
		})();
		// Link: placeholder and set_focus
		r.link_placeholder_focus = await page.evaluate(async () => {
			const c = cur_frm.fields_dict.allocated_to;
			c.$input.attr("placeholder", "Pick someone");
			c.set_focus();
			await new Promise((r) => setTimeout(r, 300));
			const vis_input = [...c.$wrapper[0].querySelectorAll("input")].filter(__tw.vis)[0];
			return { placeholder: vis_input && vis_input.placeholder, focus_on_input: document.activeElement === c.$input[0] };
		});
		await page.keyboard.press("Escape");
		// reqd + empty: the error state
		r.toggle_reqd = await page.evaluate(async () => {
			cur_frm.toggle_reqd("allocated_to", 1);
			await cur_frm.set_value("allocated_to", "");
			cur_frm.refresh_field("allocated_to");
			await new Promise((r) => setTimeout(r, 300));
			const w = cur_frm.fields_dict.allocated_to.$wrapper;
			return { has_error: w.hasClass("has-error"), reqd_label: w.find(".control-label.reqd").length };
		});
		// awesomplete.list set by app code (setup wizard / POS pattern)
		r.awesomplete_list_from_code = await (async () => {
			await page.evaluate(() => {
				$("<div id=judge-aw>").appendTo(".page-body:visible");
				window.__ja = frappe.ui.form.make_control({ parent: $("#judge-aw"), df: { fieldtype: "Link", options: "User", fieldname: "ja", label: "JA" }, only_input: true, render_input: true });
				__ja.$input.on("input", () => { __ja.awesomplete.list = ["Kilo One", "Kilo Two", "Lima"]; });
			});
			await (await page.evaluateHandle(() => __ja.$input[0])).asElement().click();
			await page.keyboard.type("Kil", { delay: 30 });
			await page.waitForTimeout(1200);
			await settle(page, rec);
			const rows = await page.evaluate(() => __tw.options());
			const st = await page.evaluate(() => ({ isOpened: !!__ja.awesomplete.isOpened, list_len: (__ja.awesomplete._list || __ja.awesomplete.list || []).length }));
			await page.keyboard.press("Escape");
			return { rows, ...st };
		})();
		// subclass by app code: override make_input (super + touch $input) and get_query
		r.subclass = await (async () => {
			await page.evaluate(() => {
				frappe.ui.form.ControlJudgeLink = class extends frappe.ui.form.ControlLink {
					make_input() { super.make_input(); this.$input.addClass("judge-sub"); this.judge_made = true; }
					get_query() { return { filters: { name: "Guest" } }; }
				};
				$("<div id=judge-sub>").appendTo(".page-body:visible");
				window.__js = frappe.ui.form.make_control({ parent: $("#judge-sub"), df: { fieldtype: "Judge Link", options: "User", fieldname: "js", label: "JS" }, render_input: true });
			});
			await page.waitForTimeout(300);
			await (await page.evaluateHandle(() => __js.$input[0])).asElement().click();
			await page.waitForTimeout(1200);
			await settle(page, rec);
			const rows = await page.evaluate(() => __tw.options());
			await page.keyboard.press("Enter");
			await page.waitForTimeout(1000);
			return { made: await page.evaluate(() => !!__js.judge_made && __js.$input.hasClass("judge-sub") && __js instanceof frappe.ui.form.ControlLink), rows, value: await page.evaluate(() => __js.get_value()) };
		})();
		// Dynamic Link follows a changed doctype field
		r.dynamic_link_switch = await (async () => {
			await page.evaluate(async () => { await cur_frm.set_value("reference_type", "Role"); });
			await page.waitForTimeout(500);
			await (await page.evaluateHandle(() => cur_frm.fields_dict.reference_name.$input[0])).asElement().click();
			await page.keyboard.type("System", { delay: 30 });
			await page.waitForTimeout(1000);
			await settle(page, rec);
			const rows = await page.evaluate(() => __tw.options().slice(0, 3));
			const last = rec.requests.filter((x) => /search_link/.test(x.method)).slice(-1)[0];
			await page.keyboard.press("Escape");
			return { rows, doctype: last && last.doctype };
		})();
		return r;
	});
	await step("grid-fast-and-tab", async () => {
		await page.goto(s.base + "/desk/workflow/new");
		await wait_form(page, "Workflow");
		await page.evaluate(helpers);
		await page.evaluate(() => cur_frm.fields_dict.states.grid.add_new_row());
		await page.waitForTimeout(500);
		await page.locator('[data-fieldname="states"] .grid-body .grid-row').first().locator('[data-fieldname="state"]').first().click();
		await page.waitForTimeout(700);
		await page.keyboard.type("Appr", { delay: 8 });
		await page.waitForTimeout(1000);
		await settle(page, rec);
		const rows = await page.evaluate(() => __tw.options().slice(0, 4));
		await page.keyboard.press("Tab");
		await page.waitForTimeout(900);
		const after_tab = await page.evaluate(() => ({ state: cur_frm.doc.states[0].state ?? null, focus_field: $(document.activeElement).closest("[data-fieldname]").attr("data-fieldname") || null }));
		await page.locator(".page-head").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
		await page.waitForTimeout(800);
		const static_after_close = await page.evaluate(() => { const row = cur_frm.fields_dict.states.grid.grid_rows[0]; return __tw.text((row.columns.state.static_area || row.columns.state)[0]); });
		// open the full row form (grid row "edit"), check Link/Select display in it
		await page.evaluate(() => cur_frm.fields_dict.states.grid.grid_rows[0].toggle_view(true));
		await page.waitForTimeout(900);
		const row_form = await page.evaluate(() => __seen_all(cur_frm.fields_dict.states.grid.grid_rows[0].grid_form.fields_dict));
		await page.evaluate(() => cur_frm.fields_dict.states.grid.grid_rows[0].toggle_view(false));
		return { rows, after_tab, static_after_close, row_form };
	});
	await step("dialog-reshow-and-set_values", async () => {
		await page.evaluate(() => {
			window.__jd = new frappe.ui.Dialog({ title: "Judge", fields: [
				{ fieldname: "user", fieldtype: "Link", options: "User", label: "User" },
				{ fieldname: "kind", fieldtype: "Select", label: "Kind", options: "\nAlpha\nBeta" },
			] });
			__jd.show();
		});
		await page.waitForTimeout(700);
		await (await page.evaluateHandle(() => __jd.fields_dict.user.$input[0])).asElement().click();
		await page.keyboard.type("Gue", { delay: 30 });
		await page.waitForTimeout(1000);
		await settle(page, rec);
		await page.keyboard.press("Enter");
		await page.waitForTimeout(900);
		const first = await page.evaluate(() => ({ values: __jd.get_values(true), user: __seen(__jd.fields_dict.user) }));
		await page.evaluate(() => __jd.hide());
		await page.waitForTimeout(600);
		await page.evaluate(() => __jd.show());
		await page.waitForTimeout(600);
		const reshow = await page.evaluate(() => ({ values: __jd.get_values(true), user: __seen(__jd.fields_dict.user), kind: __seen(__jd.fields_dict.kind) }));
		await page.evaluate(() => __jd.set_values({ user: "Administrator", kind: "Beta" }));
		await page.waitForTimeout(800);
		const set = await page.evaluate(() => ({ values: __jd.get_values(true), user: __seen(__jd.fields_dict.user), kind: __seen(__jd.fields_dict.kind) }));
		await (await page.evaluateHandle(() => __jd.fields_dict.user.$input[0])).asElement().click();
		await page.waitForTimeout(1000);
		await settle(page, rec);
		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);
		const esc1 = await page.evaluate(() => ({ dialog_open: __jd.is_visible || __jd.$wrapper.hasClass("show"), list: __tw.options().length }));
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);
		const esc2 = await page.evaluate(() => ({ dialog_open: __jd.$wrapper.hasClass("show") }));
		return { first, reshow, set, esc1, esc2 };
	});
	await step("many-fields-dialog", async () => {
		const r = await page.evaluate(async () => {
			const t0 = performance.now();
			const d = new frappe.ui.Dialog({ title: "Many", fields: [
				...Array.from({ length: 120 }, (_, i) => ({ fieldname: "l" + i, fieldtype: "Link", options: i % 2 ? "User" : "Role", label: "L" + i })),
				...Array.from({ length: 30 }, (_, i) => ({ fieldname: "s" + i, fieldtype: "Select", options: "\na\nb\nc", label: "S" + i })),
			] });
			d.show();
			const t1 = performance.now();
			await __raf2();
			const t2 = performance.now();
			const vals = {};
			for (let i = 0; i < 120; i++) vals["l" + i] = i % 2 ? "Administrator" : "System Manager";
			for (let i = 0; i < 30; i++) vals["s" + i] = "b";
			await d.set_values(vals);
			await __raf2();
			const t3 = performance.now();
			const got = d.get_values(true);
			const wrong = Object.keys(vals).filter((k) => got[k] !== vals[k]);
			const seen_wrong = Object.keys(vals).filter((k) => { const s = __seen(d.fields_dict[k]); return !s || s.t !== vals[k]; });
			d.hide();
			return { new_show_ms: +(t1 - t0).toFixed(0), incl_paint_ms: +(t2 - t0).toFixed(0), set_values_ms: +(t3 - t2).toFixed(0), wrong: wrong.length, seen_wrong: seen_wrong.length, seen_sample: __seen(d.fields_dict.l1) };
		});
		return r;
	});
	await step("many-fields-user-form", async () => {
		await goto_form(page, "User", "Administrator");
		return page.evaluate(() => __seen_all(cur_frm.fields_dict));
	});
	await s.ctx.close();
}

async function erp(browser, out) {
	const s = await open("erp", { browser });
	const { page, rec } = s;
	const step = async (name, fn) => {
		if (process.env.STEPS && !process.env.STEPS.split(",").includes(name)) return;
		const e0 = rec.errors.length;
		try { out[name] = await fn(); } catch (e) { out[name] = { error: (e.message || String(e)).split("\n")[0].slice(0, 200) }; }
		if (rec.errors.length > e0) (out[name] = out[name] || {}).console_errors = rec.errors.slice(e0).map((x) => x.slice(0, 160));
		console.log(name, JSON.stringify(out[name]).slice(0, 220));
	};
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(1500);
	await page.evaluate(helpers);
	await step("erp-si-consistency", async () => {
		await page.goto(s.base + "/desk/sales-invoice/new");
		await wait_form(page, "Sales Invoice");
		await page.evaluate(helpers);
		await page.waitForTimeout(1500);
		const fresh = await page.evaluate(() => __seen_all(cur_frm.fields_dict));
		await page.evaluate(async () => { await cur_frm.set_value("posting_date", frappe.datetime.get_today()); try { await cur_frm.set_value("customer", "TW Cust Beta"); } catch (e) { window.__jerr = e.message; } });
		await page.waitForTimeout(2500);
		const after_customer = await page.evaluate(() => __seen_all(cur_frm.fields_dict));
		const row = await page.evaluate(async () => {
			const d = (cur_frm.doc.items || [])[0] || cur_frm.add_child("items");
			cur_frm.refresh_field("items");
			await frappe.model.set_value(d.doctype, d.name, "item_code", "TW-ITEM-002");
			await new Promise((r) => setTimeout(r, 2500));
			cur_frm.refresh_field("items");
			const gr = cur_frm.fields_dict.items.grid.grid_rows.find((r) => r.doc.name === d.name);
			if (!gr) return { item_code: d.item_code, no_row: cur_frm.fields_dict.items.grid.grid_rows.length };
			return { item_code: d.item_code, static: __tw.text((gr.columns.item_code.static_area || gr.columns.item_code)[0]), uom: d.uom };
		});
		await page.evaluate(() => cur_frm.fields_dict.items.grid.grid_rows[0].toggle_view(true));
		await page.waitForTimeout(1200);
		const row_form = await page.evaluate(() => { const f = cur_frm.fields_dict.items.grid.grid_rows[0].grid_form.fields_dict; const s = __seen_all(f); return Object.fromEntries(["item_code", "uom", "warehouse", "income_account", "cost_center"].map((k) => [k, s[k] || null])); });
		await page.evaluate(() => cur_frm.fields_dict.items.grid.grid_rows[0].toggle_view(false));
		return { fresh, after_customer, row, row_form };
	});
	await s.ctx.close();
}

(async () => {
	const label = process.argv[2] || "run";
	const browser = await chromium.launch();
	const out = { label };
	if (process.env.ONLY !== "erp") await v5(browser, out);
	if (process.env.ONLY !== "v5") await erp(browser, out);
	await browser.close();
	const dir = path.join(__dirname, "..", "results", "judge");
	fs.mkdirSync(dir, { recursive: true });
	const f = path.join(dir, `break-${label}.json`);
	const prev = fs.existsSync(f) && process.env.ONLY ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
	fs.writeFileSync(f, JSON.stringify({ ...prev, ...out }, null, 1));
	console.log("wrote", label);
})().catch((e) => { console.error(e); process.exit(1); });
