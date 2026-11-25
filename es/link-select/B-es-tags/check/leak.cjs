// Where does the retained heap come from? bare hosts vs Desk controls, attached vs detached.
const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5"); const { page } = s;
	await page.goto(s.base + "/desk/todo"); await page.waitForTimeout(3000);
	const cdp = await page.context().newCDPSession(page);
	const heap = async () => { for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage"); return (await cdp.send("Runtime.getHeapUsage")).usedSize; };
	const cases = {
		bare_combobox_attached: () => { const $p = $("<div>").appendTo(document.body); for (let i = 0; i < 100; i++) $p.append(document.createElement("es-combobox")); frappe.ui.form.es_link.ES.flush(); window.__p = $p; },
		bare_select_attached: () => { const $p = $("<div>").appendTo(document.body); for (let i = 0; i < 100; i++) { const h = document.createElement("es-select"); h.options = [{ label: "a", value: "a" }]; $p.append(h); } frappe.ui.form.es_link.ES.flush(); window.__p = $p; },
		select_controls_labeled: () => { const $p = $("<div>").appendTo(document.body); window.__cs = []; for (let i = 0; i < 100; i++) __cs.push(frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "f" + i, label: "F" + i, options: "a\nb\nc" }, parent: $p, render_input: true })); window.__p = $p; },
		link_controls_labeled: () => { const $p = $("<div>").appendTo(document.body); window.__cs = []; for (let i = 0; i < 200; i++) __cs.push(frappe.ui.form.make_control({ df: { fieldtype: "Link", fieldname: "f" + i, label: "F" + i, options: "User" }, parent: $p, render_input: true })); window.__p = $p; },
		link_controls_attached: () => { const $p = $("<div>").appendTo(document.body); for (let i = 0; i < 100; i++) frappe.ui.form.make_control({ df: { fieldtype: "Link", fieldname: "f" + i, options: "User" }, parent: $p, render_input: true }); window.__p = $p; },
	};
	const out = {};
	for (const round of [1, 2]) for (const [name, fn] of Object.entries(cases)) {
		const h0 = await heap();
		await page.evaluate(`(${fn.toString()})()`);
		await page.waitForTimeout(200);
		const h1 = await heap();
		await page.evaluate(async () => { __p.remove(); window.__p = null; window.__cs = null; await new Promise((r) => setTimeout(r, 1500)); });
		const h2 = await heap();
		out[name + " r" + round] = { per_kb: +((h1 - h0) / 100 / 1024).toFixed(1), left_per_kb: +((h2 - h0) / 100 / 1024).toFixed(1), top: await page.evaluate(() => frappe.ui.form.es_link.ES.stats().top) };
	}
	console.log(JSON.stringify(out, null, 1));
	await s.browser.close();
})();
