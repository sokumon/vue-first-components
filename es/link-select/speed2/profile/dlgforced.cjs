// speed2/profile/dlgforced.cjs : which code paths force a Link mount in a 40 Link + 10 Select dialog, and in form opens
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
(async () => {
	const browser = await chromium.launch();
	const s = await open("v5", { browser });
	await s.ctx.addInitScript(() => { window.__es_lazy_trace = true; });
	await s.page.goto(s.base + "/desk/todo");
	await s.page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await s.page.waitForTimeout(1500);
	const r = await s.page.evaluate(async () => {
		const st = frappe.ui.form.es_link_lazy;
		const snap = () => JSON.parse(JSON.stringify({ forced: st.forced, visible: st.visible, io: st.io, focus: st.focus, trace: st.trace || {} }));
		const before = snap();
		const d = new frappe.ui.Dialog({ title: "perf", fields: [
			...Array.from({ length: 40 }, (_, i) => ({ fieldname: "l" + i, fieldtype: "Link", options: "User", label: "L" + i })),
			...Array.from({ length: 10 }, (_, i) => ({ fieldname: "s" + i, fieldtype: "Select", options: "a\nb", label: "S" + i })),
		] });
		const afterCtor = snap();
		d.show();
		const afterShow = snap();
		await new Promise((x) => setTimeout(x, 800));
		return { before, afterCtor, afterShow, after: snap(), pending: st.pending() };
	});
	console.log(JSON.stringify(r, null, 1));
	await browser.close();
})();
