const { open } = require("../harness/lib.cjs");
const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	const s = await open("erp", { browser }); const { page } = s;
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.evaluate(() => frappe.set_route("Form", "Sales Invoice", frappe.model.make_new_doc_and_get_name("Sales Invoice")));
	await page.waitForTimeout(3000);
	await page.screenshot({ path: __dirname + "/out/si.png" });
	console.log(await page.evaluate(() => [cur_frm?.doctype, cur_frm.fields_dict.customer?.input?.getClientRects().length, cur_frm.fields_dict.customer?.$wrapper?.is(":visible"), document.querySelectorAll(".modal.show").length]));
	await browser.close();
})();
