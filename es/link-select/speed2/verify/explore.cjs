const { open } = require("../../harness/lib.cjs");
const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	const s = await open("erp", { browser });
	const { page } = s;
	await page.goto(s.base + "/desk/sales-order/new");
	await page.waitForFunction(() => window.cur_frm?.doctype === "Sales Order" && cur_frm.layout.wrapper.is(":visible"), null, { timeout: 60000 });
	await page.waitForTimeout(2000);
	console.log(JSON.stringify(await page.evaluate(() => {
		const out = [];
		for (const [k, c] of Object.entries(cur_frm.fields_dict)) {
			const ft = c.df.fieldtype;
			if (!["Link", "Select", "Dynamic Link"].includes(ft)) continue;
			const tab = c.$wrapper.closest(".tab-pane").attr("id") || "";
			const sec = c.$wrapper.closest(".form-section");
			out.push([k, ft, !!c._es_ph || !!c._es_sel_pending ? "P" : "M", c.$wrapper.is(":visible") ? "vis" : "hid", tab.slice(-25), sec.hasClass("collapsed") || sec.find(".section-body:hidden").length ? "coll" : "", c.df.depends_on ? "dep" : "", c.df.read_only ? "ro" : ""].join(" "));
		}
		return { lazy: frappe.ui.form.es_link_lazy && { pending: frappe.ui.form.es_link_lazy.pending(), forced: frappe.ui.form.es_link_lazy.forced }, fields: out };
	}), null, 1));
	console.log(s.rec.errors);
	await browser.close();
})();
