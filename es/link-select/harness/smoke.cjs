// Smoke check: Desk loads on both sites, a form opens, one Vue copy.
const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	for (const [base, route] of [["http://v5.localhost:8000", "/desk/todo/new"], ["http://erp.localhost:8001", "/desk/sales-invoice/new"]]) {
		const ctx = await browser.newContext();
		const r = await ctx.request.post(base + "/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
		const page = await ctx.newPage();
		const errs = [];
		page.on("pageerror", (e) => errs.push(e.message));
		page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
		await page.goto(base + route);
		await page.waitForFunction(() => window.cur_frm && cur_frm.layout, null, { timeout: 60000 }).catch(() => {});
		const info = await page.evaluate(() => ({ frm: window.cur_frm?.doctype, vue: !!frappe.Vue, vueVersion: frappe.Vue?.version, link: !!frappe.ui.form.ControlLink, url: location.pathname, setup: frappe.boot?.setup_complete, company: frappe.defaults?.get_user_default?.("Company") }));
		console.log(base, r.status(), JSON.stringify(info), errs.slice(0, 5));
		await ctx.close();
	}
	await browser.close();
})();
