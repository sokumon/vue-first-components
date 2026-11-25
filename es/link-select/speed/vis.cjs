const { open } = require("../harness/lib.cjs");
const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	for (const dt of (process.env.DTS||"Sales Order,Purchase Order,Quotation,Delivery Note,Item,Customer,Journal Entry,Payment Entry,Purchase Invoice,Material Request").split(",")) {
		const s = await open("erp", { browser });
		const { page } = s;
		await s.ctx.addInitScript(() => { window.__es_link_off = true; });
		await page.goto(s.base + "/desk/todo");
		await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
		const r = await page.evaluate(async (dt) => {
			frappe.set_route("Form", dt, frappe.model.make_new_doc_and_get_name(dt));
			await new Promise((res) => { const c = () => (window.cur_frm?.doctype === dt && cur_frm.layout?.wrapper?.is(":visible") ? res() : setTimeout(c, 20)); c(); });
			await new Promise((r) => setTimeout(r, 1000));
			const c = { built: 0, onscreen: 0, in_viewport: 0, names: [] };
			for (const f of Object.values(cur_frm.fields_dict)) {
				if (!["Link", "Select", "Dynamic Link"].includes(f.df.fieldtype) || !f.input) continue;
				c.built++;
				const rs = f.input.getClientRects();
				if (rs.length) { c.onscreen++; c.names.push(f.df.fieldname); if (rs[0].top < innerHeight) c.in_viewport++; }
			}
			c.errors = document.querySelectorAll(".modal.show").length; c.names = c.names.length; return c;
		}, dt);
		console.log(dt, JSON.stringify(r));
		await s.ctx.close();
	}
	await browser.close();
})();
