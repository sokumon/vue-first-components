// which code paths force a mount while a form opens, and how many stay pending
const { open } = require("../harness/lib.cjs");
const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	for (const dt of (process.env.DTS || "Sales Order,Delivery Note,ToDo").split(",")) {
		const s = await open(dt === "ToDo" ? "v5" : "erp", { browser });
		const { page } = s;
		await s.ctx.addInitScript(() => { window.__es_lazy_trace = true; });
		await page.goto(s.base + "/desk/todo");
		await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
		const r = await page.evaluate(async (dt) => {
			frappe.set_route("Form", dt, frappe.model.make_new_doc_and_get_name(dt));
			await new Promise((res) => { const c = () => (window.cur_frm?.doctype === dt && cur_frm.layout?.wrapper?.is(":visible") ? res() : setTimeout(c, 20)); c(); });
			await new Promise((r) => setTimeout(r, 1500));
			const st = frappe.ui.form.es_link_lazy;
			return { forced: st.forced, visible: st.visible, io: st.io, focus: st.focus, pending: st.pending(), trace: st.trace, hosts: document.querySelectorAll("es-combobox").length };
		}, dt);
		console.log(dt, JSON.stringify(r), s.rec.errors.slice(0, 3));
		await s.ctx.close();
	}
	await browser.close();
})();
