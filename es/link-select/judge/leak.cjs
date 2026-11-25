// judge/leak.cjs <label> : is the heap of removed controls given back, and when? jQuery .remove() vs
// plain el.remove(), measured 0.5 s / 5 s / 15 s after removal. -> ../results/judge/leak-<label>.json
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open } = require("../harness/lib.cjs");
async function heap(cdp) {
	await cdp.send("HeapProfiler.collectGarbage");
	await cdp.send("HeapProfiler.collectGarbage");
	return (await cdp.send("Runtime.getHeapUsage")).usedSize / 1024;
}
(async () => {
	const label = process.argv[2] || "run";
	const browser = await chromium.launch();
	const s = await open("v5", { browser });
	const { page } = s;
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(2500);
	const cdp = await page.context().newCDPSession(page);
	const res = { label };
	for (const how of ["jquery", "native"]) for (const ft of ["Link", "Select"]) {
		const h0 = await heap(cdp);
		await page.evaluate(async (ft) => {
			window.__lp = $("<div>").appendTo(".page-body:visible");
			for (let i = 0; i < 200; i++) frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "h" + i, label: "H" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: __lp, render_input: true });
			await new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
		}, ft);
		const h1 = await heap(cdp);
		await page.evaluate((how) => { if (how === "jquery") __lp.remove(); else __lp[0].remove(); window.__lp = null; }, how);
		const r = { made_kb: Math.round(h1 - h0) };
		let waited = 0;
		for (const t of [500, 5000, 15000]) { await page.waitForTimeout(t - waited); waited = t; r[`kept_kb_${t / 1000}s`] = Math.round((await heap(cdp)) - h0); }
		res[`${how} ${ft}`] = r;
		console.log(how, ft, JSON.stringify(r));
	}
	await browser.close();
	const dir = path.join(__dirname, "..", "results", "judge");
	fs.writeFileSync(path.join(dir, `leak-${label}.json`), JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
