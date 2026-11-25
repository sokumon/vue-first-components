const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5"); const { page, rec } = s;
	await page.goto(s.base + "/desk/todo/new");
	await page.waitForFunction(() => window.cur_frm && cur_frm.doctype === "ToDo" && cur_frm.layout, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	await page.evaluate(() => { const h = cur_frm.fields_dict.priority._es_host; window.__ev = []; for (const n of ["update:modelValue", "update:open"]) h.addEventListener(n, (e) => __ev.push([n, e.detail])); cur_frm.fields_dict.priority.$input.on("change", () => __ev.push(["change", cur_frm.fields_dict.priority.$input.val()])); });
	const trig = page.locator('[data-fieldname="priority"] es-select button[data-slot=trigger]').first();
	await trig.click(); await page.waitForTimeout(400);
	console.log(await page.evaluate(() => [...document.querySelectorAll("es-portal [role=option]")].map((o) => o.outerHTML.slice(0, 200))));
	await page.locator('es-portal [role=option]:visible', { hasText: "High" }).first().click(); await page.waitForTimeout(500);
	console.log(JSON.stringify(await page.evaluate(() => ({ ev: __ev, doc: cur_frm.doc.priority }))), rec.errors);
	await s.browser.close();
})();
