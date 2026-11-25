// heap per control and what is left after jQuery .remove(), for Data (v8 base), Link and Select (variant A)
const { open } = require("../../harness/lib.cjs");
(async () => {
	const { browser, page, base } = await open("v5");
	await page.goto(base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(2000);
	const cdp = await page.context().newCDPSession(page);
	const heap = async () => { await cdp.send("HeapProfiler.collectGarbage"); await cdp.send("HeapProfiler.collectGarbage"); return (await cdp.send("Runtime.getHeapUsage")).usedSize; };
	const out = {};
	for (const ft of (process.argv[2] || "Data,Link,Select").split(",")) {
		const h0 = await heap();
		const st = await page.evaluate((ft) => {
			window.__hp = $("<div>").appendTo(document.body);
			window.__hc = [];
			for (let i = 0; i < 200; i++) __hc.push(frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "h" + i, label: "H" + i, options: ft === "Select" ? "a\nb\nc" : ft === "Link" ? "User" : "" }, parent: __hp, render_input: true }));
			return true;
		}, ft);
		const h1 = await heap();
		const after = await page.evaluate(() => {
			const c = __hc[0];
			__hp.remove();
			const v = c.link_view || c.select_view;
			const r = { destroyed: c.$fui?.destroyed, view_destroyed: v?.$fui.destroyed, view_unmounted: v?.$fui.view?.isUnmounted, owner_is_control: v ? v.$fui.owner === c.$fui : null };
			window.__probe_c = null; __hc = null; __hp = null;
			return r;
		});
		await page.waitForTimeout(500);
		const h2 = await heap();
		out[ft] = { per_control_kb: +((h1 - h0) / 200 / 1024).toFixed(1), left_kb: +((h2 - h0) / 1024).toFixed(0), ...after };
	}
	console.log(JSON.stringify(out, null, 1));
	if (process.argv[3]) {
		// retainers of one leftover LinkInput view: heap snapshot class counts
		await page.evaluate(() => { window.__hp = $("<div>").appendTo(document.body); for (let i = 0; i < 50; i++) frappe.ui.form.make_control({ df: { fieldtype: "Link", fieldname: "z" + i, label: "Z", options: "User" }, parent: __hp, render_input: true }); __hp.remove(); __hp = null; });
		await heap();
		const chunks = [];
		cdp.on("HeapProfiler.addHeapSnapshotChunk", (m) => chunks.push(m.chunk));
		await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
		require("fs").writeFileSync(process.argv[3], chunks.join(""));
	}
	await browser.close();
})();
