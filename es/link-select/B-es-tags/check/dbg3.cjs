const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5"); const { page } = s;
	page.on("console", (m) => /dbg/.test(m.text()) && console.log(m.text().slice(0, 400)));
	await page.goto(s.base + "/desk/todo/new");
	await page.waitForFunction(() => window.cur_frm && cur_frm.doctype === "ToDo" && cur_frm.layout, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	const trig = page.locator('[data-fieldname="priority"] es-select button[data-slot=trigger]').first();
	await trig.click(); await page.waitForTimeout(400);
	await page.evaluate(() => { for (const o of document.querySelectorAll("es-portal [role=option]")) console.log("dbg " + [...o.attributes].filter(a=>a.name!=="class").map((a) => a.name + "=" + a.value).join(" ")); console.log("dbg form? " + !!cur_frm.fields_dict.priority._es_host.closest("form")); });
	// plain es-select outside the form
	await page.keyboard.press("Escape");
	await page.evaluate(() => { const h = document.createElement("es-select"); h.id = "plain"; h.options = [{label:"a",value:"a"},{label:"b",value:"b"}]; h.addEventListener("update:modelValue", (e) => console.log("dbg plain " + e.detail)); document.body.prepend(h); });
	await page.waitForTimeout(300);
	await page.locator("#plain button").click(); await page.waitForTimeout(400);
	await page.locator('es-portal [role=option]:visible', { hasText: "b" }).first().click(); await page.waitForTimeout(500);
	await s.browser.close();
})();
