// JS heap and DOM per control, es vs legacy controls in the same build (window.__es_link_off), CDP GC.
const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5"); const { page } = s;
	await page.goto(s.base + "/desk/todo"); await page.waitForTimeout(3000);
	const cdp = await page.context().newCDPSession(page);
	const heap = async () => { for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage"); return (await cdp.send("Runtime.getHeapUsage")).usedSize; };
	const out = {};
	// warm both paths once
	for (const mode of ["legacy", "es", "legacy", "es"]) for (const ft of ["Link", "Select"]) {
		await page.evaluate(([mode]) => { window.__es_link_off = mode !== "es"; window.__p = $("<div>").appendTo(document.body); window.__cs = []; }, [mode]);
		const h0 = await heap(); const d0 = await cdp.send("Memory.getDOMCounters");
		await page.evaluate(async (ft) => { for (let i = 0; i < 200; i++) __cs.push(frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "f" + i, label: "F" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: __p, render_input: true })); await new Promise((r) => setTimeout(r, 50)); }, ft);
		const h1 = await heap(); const d1 = await cdp.send("Memory.getDOMCounters");
		const stats_before = await page.evaluate(() => frappe.ui.form.es_link.ES.stats().top);
		await page.evaluate(async () => { __p.remove(); __cs = null; await new Promise((r) => setTimeout(r, 1500)); });
		const stats_after = await page.evaluate(() => frappe.ui.form.es_link.ES.stats().top);
		const h2 = await heap();
		out[`${mode} ${ft}`] = { heap_kb_per: +((h1 - h0) / 200 / 1024).toFixed(2), nodes_per: +((d1.nodes - d0.nodes) / 200).toFixed(1), listeners_per: +((d1.jsEventListeners - d0.jsEventListeners) / 200).toFixed(1), heap_kb_left_after_remove: +((h2 - h0) / 1024).toFixed(0), es_top_before_remove: stats_before, es_top_after_remove: stats_after };
	}
	await page.evaluate(() => (window.__es_link_off = false));
	out.es_stats_after = await page.evaluate(() => frappe.ui.form.es_link.ES.stats());
	console.log(JSON.stringify(out, null, 1));
	await s.browser.close();
})();
