// B smoke: the es-* inputs mount in a form, the Link searches and picks, the Select mirrors its <select>.
const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5");
	const { page, rec } = s;
	await page.goto(s.base + "/desk/todo/new");
	await page.waitForFunction(() => window.cur_frm && cur_frm.doctype === "ToDo" && cur_frm.layout, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	const info = await page.evaluate(() => {
		const f = cur_frm.fields_dict.allocated_to, st = cur_frm.fields_dict.status;
		return {
			es: !!frappe.ui.form.es_link, link_host: !!f._es_host, input_tag: f.input && f.input.tagName, in_host: !!(f.input && f.input.closest("es-combobox")),
			api: __tw.api(f), structure: __tw.structure(f), sel_host: !!st._es_host, sel_tag: st.input.tagName, sel_opts: st._es_host && st._es_host.options.length,
			trigger_text: st._es_host && st._es_host.innerText,
		};
	});
	console.log(JSON.stringify(info, null, 1));
	const el = await page.evaluateHandle(() => cur_frm.fields_dict.allocated_to.input);
	await el.asElement().click();
	await page.waitForTimeout(1200);
	console.log("after focus", JSON.stringify(await page.evaluate(() => ({ opts: __tw.options(), active: __tw.active_option(), open: cur_frm.fields_dict.allocated_to.awesomplete.isOpened }))));
	await page.keyboard.type("adm", { delay: 40 });
	await page.waitForTimeout(1200);
	console.log("after type", JSON.stringify(await page.evaluate(() => ({ opts: __tw.options(), active: __tw.active_option(), val: cur_frm.fields_dict.allocated_to.$input.val() }))));
	await page.keyboard.press("Enter");
	await page.waitForTimeout(1200);
	console.log("after enter", JSON.stringify(await page.evaluate(() => ({ opts: __tw.options(), val: cur_frm.fields_dict.allocated_to.$input.val(), doc: cur_frm.doc.allocated_to }))));
	await page.screenshot({ path: __dirname + "/smoke.png" });
	console.log("errors", rec.errors.slice(0, 8));
	await s.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
