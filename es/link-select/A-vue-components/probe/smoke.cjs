// quick dev probe for variant A: form, link search/pick, select, dialog. node smoke.cjs
const { open, settle, wait_form } = require("../../harness/lib.cjs");
(async () => {
	const { browser, page, rec, base } = await open("v5");
	const out = {};
	try {
		await page.goto(base + "/desk/todo/new");
		await wait_form(page, "ToDo");
		out.version = await page.evaluate(() => window.__vue_first?.version);
		out.chain = await page.evaluate(() => __tw.api(cur_frm.fields_dict.allocated_to));
		out.struct = await page.evaluate(() => __tw.structure(cur_frm.fields_dict.allocated_to));
		out.sel = await page.evaluate(() => ({ state: __tw.state(cur_frm.fields_dict.status), s: __tw.structure(cur_frm.fields_dict.status) }));
		const inp = await page.evaluateHandle(() => cur_frm.fields_dict.allocated_to.input);
		await inp.asElement().click();
		await page.waitForTimeout(1500);
		out.open_rows = await page.evaluate(() => ({ rows: __tw.options(), active: __tw.active_option(), aria: cur_frm.fields_dict.allocated_to.input.getAttribute("aria-expanded") }));
		await page.keyboard.type("frappe@", { delay: 40 });
		await page.waitForTimeout(1200);
		out.typed_rows = await page.evaluate(() => ({ rows: __tw.options(), active: __tw.active_option() }));
		await page.keyboard.press("Enter");
		await page.waitForTimeout(1200);
		out.after_enter = await page.evaluate(() => ({ st: __tw.state(cur_frm.fields_dict.allocated_to), open: __tw.listbox_open(), ev: __tw.events }));
		await page.screenshot({ path: __dirname + "/smoke.png" });
	} catch (e) {
		out.error = e.message;
	}
	out.errors = rec.errors;
	console.log(JSON.stringify(out, null, 1));
	await browser.close();
})();
