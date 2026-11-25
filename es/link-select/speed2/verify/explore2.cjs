const { open } = require("../../harness/lib.cjs");
const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	const s = await open("erp", { browser });
	const { page } = s;
	await page.goto(s.base + "/desk/item/new");
	await page.waitForFunction(() => window.cur_frm?.doctype === "Item" && cur_frm.layout.wrapper.is(":visible"), null, { timeout: 60000 });
	await page.waitForTimeout(2000);
	console.log(JSON.stringify(await page.evaluate(async () => {
		const out = [];
		const tabs = cur_frm.layout.tabs.map((t) => t.df.fieldname + (t.is_hidden() ? "(hid)" : ""));
		for (const [k, c] of Object.entries(cur_frm.fields_dict)) {
			const ft = c.df.fieldtype;
			if (!["Link", "Select", "Dynamic Link"].includes(ft)) continue;
			const tab = (c.$wrapper.closest(".tab-pane").attr("id") || "").replace("item-", "");
			const sec = c.section;
			out.push([k, ft, c._es_ph || c._es_sel_pending ? "P" : "M", c.$wrapper.is(":visible") ? "vis" : "hid", tab, sec && sec.is_collapsed && sec.is_collapsed() ? "coll" : "", c.df.depends_on || "", c.df.read_only ? "ro" : "", c.df.options && ft==="Select" ? JSON.stringify(c.df.options).slice(0,40) : c.df.options].join(" | "));
		}
		const cnt = {};
		for (const dt of ["Customer", "Item", "Item Group", "UOM", "Warehouse", "Sales Order", "Brand", "Company"]) cnt[dt] = (await frappe.db.get_list(dt, { limit: 3 })).map((x) => x.name);
		return { tabs, cnt, fields: out };
	}), null, 1));
	await browser.close();
})();
