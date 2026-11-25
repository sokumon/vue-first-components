// B-only checks the shared harness cannot see (it drives Select through the hidden <select>):
// the visible es-select and es-combobox UI with mouse and keyboard, in a form and in a Bootstrap dialog,
// $input.val() writes surviving re-renders, detached make_control, Tab pick, subclasses that stay legacy.
const { open } = require("../../harness/lib.cjs");
const res = [];
const ok = (name, pass, info) => { res.push({ name, pass: !!pass, info }); console.log((pass ? "PASS " : "FAIL ") + name + " :: " + JSON.stringify(info)); };
(async () => {
	const s = await open("v5");
	const { page, rec } = s;
	await page.goto(s.base + "/desk/todo/new");
	await page.waitForFunction(() => window.cur_frm && cur_frm.doctype === "ToDo" && cur_frm.layout, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	// 1. es-select by mouse
	const trig = page.locator('[data-fieldname="priority"] es-select button[data-slot=trigger]').first();
	await trig.click(); await page.waitForTimeout(400);
	await page.locator('[role=option]:visible', { hasText: "High" }).first().click(); await page.waitForTimeout(500);
	const m1 = await page.evaluate(() => ({ doc: cur_frm.doc.priority, sel: cur_frm.fields_dict.priority.$input.val(), shown: cur_frm.fields_dict.priority._es_host.innerText.trim() }));
	ok("es-select mouse pick sets the model and the <select>", m1.doc === "High" && m1.sel === "High" && m1.shown === "High", m1);
	// 2. es-select by keyboard
	await trig.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
	await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
	const k = await page.evaluate(() => ({ doc: cur_frm.doc.priority, active: document.activeElement.closest("es-select") ? "trigger" : document.activeElement.tagName }));
	ok("es-select keyboard pick (Enter, ArrowDown, Enter)", k.doc === "Medium", k);
	// 3. options rebuilt with jQuery reach the es-select
	const o = await page.evaluate(async () => {
		const f = cur_frm.fields_dict.priority;
		f.$input.empty().add_options(["X1", "X2"]); await new Promise((r) => setTimeout(r, 50));
		const a = f._es_host.options.map((x) => x.value);
		cur_frm.set_df_property("priority", "options", ["Low", "Medium", "High"]); cur_frm.refresh_field("priority"); await new Promise((r) => setTimeout(r, 50));
		return { after_add_options: a, after_set_df: f._es_host.options.map((x) => x.value), shown: f._es_host.innerText.trim() };
	});
	ok("jQuery add_options / set_df_property options mirror into es-select", o.after_add_options.join() === "X1,X2" && o.after_set_df.join() === "Low,Medium,High", o);
	// 4. $input.val() on the Link survives a component re-render
	const v = await page.evaluate(async () => {
		const f = cur_frm.fields_dict.allocated_to;
		f.$input.val("typed by jquery"); f._es_host.placeholder = "p2"; frappe.ui.form.es_link.ES.flush(); await new Promise((r) => setTimeout(r, 50));
		const a = f.$input.val(); f.$input.val(""); return a;
	});
	ok("Link $input.val(x) survives a re-render of the Combobox", v === "typed by jquery", v);
	// 5. Link mouse pick
	await page.locator('[data-fieldname="allocated_to"] input').first().click(); await page.waitForTimeout(1200);
	await page.locator('[role=option]:visible', { hasText: "Guest" }).first().click(); await page.waitForTimeout(1200);
	const lp = await page.evaluate(() => ({ doc: cur_frm.doc.allocated_to, input: cur_frm.fields_dict.allocated_to.$input.val() }));
	ok("Link mouse pick", lp.doc === "Guest" && lp.input === "Guest", lp);
	// 6. Tab picks the active row when the text matches
	await page.evaluate(() => cur_frm.set_value("allocated_to", "")); await page.waitForTimeout(300);
	await page.locator('[data-fieldname="allocated_to"] input').first().click(); await page.keyboard.type("Admin", { delay: 30 }); await page.waitForTimeout(1300);
	await page.keyboard.press("Tab"); await page.waitForTimeout(1200);
	const t = await page.evaluate(() => cur_frm.doc.allocated_to);
	ok("Tab picks the active row (tabSelect)", t === "Administrator", t);
	await page.keyboard.press("Escape"); await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.waitForTimeout(500);
	// 7. dialog: es-select + Link with mouse inside a Bootstrap modal; Escape closes list not dialog
	await page.evaluate(() => { window.__d = new frappe.ui.Dialog({ title: "B dlg", fields: [{ fieldname: "k", fieldtype: "Select", options: "one\ntwo\nthree", label: "K" }, { fieldname: "u", fieldtype: "Link", options: "User", label: "U" }] }); __d.show(); });
	await page.waitForTimeout(800);
	await page.locator('.modal.show [data-fieldname="k"] es-select button').first().click(); await page.waitForTimeout(400);
	await page.locator('[role=option]:visible', { hasText: "three" }).first().click(); await page.waitForTimeout(400);
	await page.locator('.modal.show [data-fieldname="u"] input').first().click(); await page.waitForTimeout(1200);
	await page.keyboard.press("ArrowDown"); await page.waitForTimeout(100);
	const act = await page.evaluate(() => __tw.active_option());
	await page.keyboard.press("Escape"); await page.waitForTimeout(400);
	const after_esc = await page.evaluate(() => ({ list: __tw.listbox_open(), dialog: __d.display }));
	await page.locator('.modal.show [data-fieldname="u"] input').first().click(); await page.keyboard.type("Adm", { delay: 30 }); await page.waitForTimeout(1300);
	const row = page.locator('[role=option]:visible', { hasText: "Administrator" }).first();
	await row.click(); await page.waitForTimeout(1000);
	const dv = await page.evaluate(() => ({ k: __d.get_value("k"), u: __d.get_value("u"), dialog: __d.display }));
	ok("dialog: es-select mouse pick, Link list over the modal, Escape closes list only, Link mouse pick", dv.k === "three" && dv.u === "Administrator" && !after_esc.list && after_esc.dialog && dv.dialog, { ...dv, after_esc, act });
	await page.evaluate(() => __d.hide());
	// 8. detached make_control renders at once; .remove() unmounts it
	const det = await page.evaluate(async () => {
		const ES = frappe.ui.form.es_link.ES; const before = ES.stats().top;
		const $p = $("<div>");
		const c = frappe.ui.form.make_control({ df: { fieldtype: "Link", fieldname: "x", options: "User" }, parent: $p, render_input: true });
		const r = { input: !!c.input, tag: c.input && c.input.tagName, during: ES.stats().top - before };
		$p.remove(); await new Promise((x) => setTimeout(x, 30));
		r.after = ES.stats().top - before;
		return r;
	});
	ok("detached make_control has its <input> at once and releases it on .remove()", det.tag === "INPUT" && det.during === 1 && det.after === 0, det);
	// 9. subclasses on Awesomplete internals stay legacy
	const sub = await page.evaluate(() => {
		const $p = $("<div>").appendTo(document.body);
		const c = frappe.ui.form.make_control({ df: { fieldtype: "Table MultiSelect", fieldname: "tm", options: "Has Role" }, parent: $p, render_input: true });
		const r = { es: !!c._es_host, awesomplete_ul_in_dom: !!(c.awesomplete && c.awesomplete.ul && c.awesomplete.ul.isConnected) };
		$p.remove(); return r;
	});
	ok("Table MultiSelect keeps the legacy Awesomplete input", !sub.es && sub.awesomplete_ul_in_dom, sub);
	await page.screenshot({ path: __dirname + "/b-ui.png" });
	ok("no console errors", rec.errors.length === 0, rec.errors.slice(0, 5));
	require("fs").writeFileSync(__dirname + "/b-ui.json", JSON.stringify(res, null, 1));
	console.log(res.filter((r) => !r.pass).length + " FAILED of " + res.length);
	await s.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
