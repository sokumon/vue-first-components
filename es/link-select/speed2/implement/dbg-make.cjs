const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5");
	const { page } = s;
	for (const f of (process.env.FLAGS || "").split(",").filter(Boolean)) await s.ctx.addInitScript((f) => { window["__es_" + f] = true; }, f);
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(2500);
	for (const ft of ["Link", "Select"]) {
		const r = await page.evaluate(async (ft) => {
			const raf2 = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
			const $p = $("<div>").appendTo(".page-body:visible");
			await raf2();
			const t = performance.now();
			const ls = [];
			for (let i = 0; i < 100; i++) ls.push(frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "f" + i, label: "F" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: $p, render_input: true }));
			const js = performance.now() - t;
			const t1 = [];
			await new Promise((x) => requestAnimationFrame(() => { t1.push(performance.now() - t); requestAnimationFrame(() => { t1.push(performance.now() - t); x(); }); }));
			const out = { ft, js: Math.round(js), frames: t1.map(Math.round), hosts: $p[0].querySelectorAll("es-combobox,es-select").length, vis: ls.filter((c) => c.$wrapper[0].getBoundingClientRect().top < innerHeight).length, lazy: JSON.stringify({ ...frappe.ui.form.es_link_lazy, pending: frappe.ui.form.es_link_lazy.pending() }), H: innerHeight, top: $p[0].getBoundingClientRect().top, h: $p[0].getBoundingClientRect().height };
			await new Promise((x) => setTimeout(x, 500));
			out.hosts_later = $p[0].querySelectorAll("es-combobox,es-select").length;
			$p.remove();
			return out;
		}, ft);
		console.log(JSON.stringify(r));
	}
	await s.ctx.close(); process.exit(0);
})();
