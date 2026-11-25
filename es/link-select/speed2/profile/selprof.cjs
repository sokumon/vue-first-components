// speed2/profile/selprof.cjs : CPU profile of make + set_input of 20 Selects with 30 options (es), and the
// option counts of the Selects on the test forms.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
(async () => {
	const browser = await chromium.launch();
	const s = await open("erp", { browser });
	const { page } = s;
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(1500);
	const counts = {};
	for (const dt of ["Sales Order", "Delivery Note", "Stock Entry", "ToDo", "Item", "Customer", "User"]) {
		counts[dt] = await page.evaluate(async (dt) => {
			await frappe.model.with_doctype(dt);
			return frappe.meta.get_docfield ? frappe.get_meta(dt).fields.filter((f) => f.fieldtype === "Select").map((f) => (f.options || "").split("\n").length).sort((a, b) => b - a) : [];
		}, dt);
	}
	console.log("Select option counts per doctype:", JSON.stringify(counts));
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Profiler.enable");
	await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
	for (const phase of ["make", "set_input"]) {
		if (phase === "make") await cdp.send("Profiler.start");
		const t = await page.evaluate(async (phase) => {
			const raf2 = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
			const opts = Array.from({ length: 30 }, (_, i) => "opt " + i).join("\n");
			if (phase === "make") {
				window.__$p = $("<div>").appendTo(".page-body:visible"); await raf2();
				const a = performance.now();
				window.__ls = Array.from({ length: 20 }, (_, i) => frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "s" + i, label: "S", options: opts }, parent: __$p, render_input: true }));
				await raf2();
				return performance.now() - a;
			}
			const a = performance.now();
			__ls.forEach((c, i) => c.set_input("opt " + ((i + 7) % 30)));
			await raf2();
			return performance.now() - a;
		}, phase);
		if (phase === "set_input") { /* profile both phases into one */ }
		console.log(phase, t.toFixed(1), "ms for 20");
	}
	fs.writeFileSync(path.join(__dirname, "out", "selprof-30opts.cpuprofile"), JSON.stringify((await cdp.send("Profiler.stop")).profile));
	await browser.close();
})();
