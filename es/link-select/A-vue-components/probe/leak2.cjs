// perf.cjs's heap sequence (300 Link + 300 Select in one container, then .remove()), with checks
const { open } = require("../../harness/lib.cjs");
(async () => {
	const { browser, page, base } = await open("v5");
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(2000);
	const cdp = await page.context().newCDPSession(page);
	const heap = async () => { await cdp.send("HeapProfiler.collectGarbage"); await cdp.send("HeapProfiler.collectGarbage"); return (await cdp.send("Runtime.getHeapUsage")).usedSize; };
	const mode = process.argv[2] || "perf";
	await page.evaluate(() => { window.__hp = $("<div>").appendTo(document.body); window.__hc = []; });
	const h0 = await heap();
	await page.evaluate(() => { for (let i = 0; i < 300; i++) __hc.push(frappe.ui.form.make_control({ df: { fieldtype: "Link", fieldname: "h" + i, label: "H" + i, options: "User" }, parent: __hp, render_input: true })); });
	await page.evaluate(() => { for (let i = 0; i < 300; i++) __hc.push(frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "s" + i, label: "S" + i, options: "a\nb\nc" }, parent: __hp, render_input: true })); });
	const h1 = await heap();
	const r = await page.evaluate(() => { const c = __hc; __hp.remove(); __hc = null; return { destroyed: c.filter((x) => x.$fui.destroyed).length }; });
	const h2 = await heap();
	await page.waitForTimeout(3000);
	const h3 = await heap();
	console.log(JSON.stringify({ made_kb: (h1 - h0) / 1024 | 0, left_now_kb: (h2 - h0) / 1024 | 0, left_3s_kb: (h3 - h0) / 1024 | 0, ...r }));
	await browser.close();
})();
