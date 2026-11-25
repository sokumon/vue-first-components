const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5"); const { page } = s;
	page.on("console", (m) => /dbg/.test(m.text()) && console.log(m.text().slice(0, 600)));
	await page.goto(s.base + "/desk/todo/new");
	await page.waitForFunction(() => window.cur_frm && cur_frm.doctype === "ToDo" && cur_frm.layout, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	await page.evaluate(() => {
		const h = cur_frm.fields_dict.priority._es_host;
		const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(h), "modelValue");
		Object.defineProperty(h, "modelValue", { configurable: true, get() { return d.get.call(this); }, set(v) { console.log("dbg set mv " + v + " " + new Error().stack.split("\n").slice(2, 5).join("|")); d.set.call(this, v); } });
		for (const n of ["update:modelValue", "update:open", "focus", "blur"]) h.addEventListener(n, (e) => console.log("dbg ev " + n + " " + (typeof e.detail === "object" ? "obj" : e.detail)));
		console.log("dbg opts " + JSON.stringify(h.options) + " mv " + h.modelValue);
	});
	const trig = page.locator('[data-fieldname="priority"] es-select button[data-slot=trigger]').first();
	await trig.click(); await page.waitForTimeout(400);
	await page.locator('es-portal [role=option]:visible', { hasText: "High" }).first().click(); await page.waitForTimeout(500);
	console.log("dbg final " + await page.evaluate(() => cur_frm.doc.priority));
	await s.browser.close();
})();
