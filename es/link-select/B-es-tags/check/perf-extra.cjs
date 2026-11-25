// B-only: the cost perf.cjs cannot see because B renders prop changes in a microtask.
// set_input on 200 Link / Select including the es-* render (await a microtask), and per-control
// DOM nodes / listeners with the portal content closed.
const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5"); const { page } = s;
	await page.goto(s.base + "/desk/todo"); await page.waitForTimeout(3000);
	const r = {};
	for (const mode of ["es", "legacy-in-same-build"]) r[mode] = await page.evaluate(async (mode) => {
		window.__es_link_off = mode !== "es";
		const out = {};
		const $p = $("<div>").appendTo(document.body);
		const make = (ft, n) => Array.from({ length: n }, (_, i) => frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "f" + i, label: "F" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: $p, render_input: true }));
		for (const ft of ["Link", "Select"]) {
			$p.empty(); const cs = make(ft, 200);
			const xs = [];
			for (let k = 0; k < 5; k++) {
				const a = performance.now();
				cs.forEach((c, i) => c.set_input(ft === "Link" ? (i % 2 ? "Administrator" : "Guest") + k : ["a", "b", "c"][(i + k) % 3]));
				await Promise.resolve(); if (frappe.ui.form.es_link) frappe.ui.form.es_link.ES.flush();
				xs.push(performance.now() - a);
			}
			xs.sort((a, b) => a - b); out[`set_input on 200 ${ft} incl. render (ms)`] = +xs[2].toFixed(1);
		}
		// per-control DOM nodes and JS listeners (CDP counters are page-wide: measure 100 controls)
		$p.empty();
		for (const ft of ["Link", "Select"]) {
			const n0 = document.getElementsByTagName("*").length;
			const a = performance.now(); const cs = make(ft, 100); await Promise.resolve();
			out[`make 100 ${ft} (ms)`] = +(performance.now() - a).toFixed(1);
			out[`elements per ${ft}`] = +((document.getElementsByTagName("*").length - n0) / 100).toFixed(1);
			$p.empty();
		}
		$p.remove();
		out.es_stats = frappe.ui.form.es_link.ES.stats();
		window.__es_link_off = false;
		return out;
	}, mode);
	console.log(JSON.stringify(r));
	await s.browser.close();
})();
