const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5");
	const { page } = s;
	for (const f of (process.env.FLAGS || "").split(",").filter(Boolean)) await s.ctx.addInitScript((f) => { window["__es_" + f] = true; }, f);
	await s.ctx.addInitScript(() => {
		const ric = window.requestIdleCallback;
		window.__ric = [];
		window.requestIdleCallback = function (f, o) { const st = new Error().stack.split("\n")[2]; return ric.call(window, (d) => { const t = performance.now(); f(d); window.__ric.push([Math.round(t), +(performance.now() - t).toFixed(1), st.trim().slice(0, 80)]); }, o); };
	});
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(2500);
	console.log(JSON.stringify(await page.evaluate(() => ({ ric: __ric, stats: ES.stats(), now: Math.round(performance.now()) }))));
	// time es_mount per call on first form open
	const r = await page.evaluate(async () => {
		const P = frappe.ui.form.ControlLink.prototype, S = frappe.ui.form.ControlSelect.prototype;
		const T = [];
		for (const [o, n] of [[P, "es_mount"], [S, "es_mount"], [S, "make_input"]]) { const f = o[n]; o[n] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { T.push(n + ":" + this.df.fieldtype + ":" + (performance.now() - t).toFixed(1)); } }; }
		const t = performance.now();
		frappe.set_route("Form", "ToDo", frappe.model.make_new_doc_and_get_name("ToDo"));
		await new Promise((r) => setTimeout(r, 1500));
		return T;
	});
	console.log(r.join(" "));
	await s.ctx.close(); process.exit(0);
})();
