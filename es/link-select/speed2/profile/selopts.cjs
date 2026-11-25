// speed2/profile/selopts.cjs : Select cost vs number of options (es vs legacy), 50 controls, painted ms per control
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
(async () => {
	const browser = await chromium.launch();
	const res = {};
	for (let r = 0; r < 3; r++) for (const mode of r % 2 ? ["legacy", "es"] : ["es", "legacy"]) {
		const s = await open("v5", { browser });
		if (mode === "legacy") await s.ctx.addInitScript(() => { window.__es_link_off = true; });
		await s.page.goto(s.base + "/desk/todo");
		await s.page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
		await s.page.waitForTimeout(1500);
		const x = await s.page.evaluate(async () => {
			const raf2 = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
			const out = {};
			for (const k of [3, 3, 10, 30]) {
				const opts = Array.from({ length: k }, (_, i) => "opt " + i).join("\n");
				const $p = $("<div>").appendTo(".page-body:visible"); await raf2();
				const a = performance.now();
				const ls = [];
				for (let i = 0; i < 50; i++) ls.push(frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "s" + i, label: "S", options: opts }, parent: $p, render_input: true }));
				await raf2();
				const make = (performance.now() - a) / 50;
				const b = performance.now();
				ls.forEach((c, i) => c.set_input("opt " + ((i + 1) % k)));
				await raf2();
				out[`options=${k}`] = { make: +make.toFixed(2), set_input: +((performance.now() - b) / 50).toFixed(2) };
				$p.remove(); await raf2();
			}
			return out;
		});
		(res[mode] ||= []).push(x);
		console.log(r, mode, JSON.stringify(x));
		await s.ctx.close();
	}
	await browser.close();
})();
