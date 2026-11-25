// speed2/profile/scale.cjs <label> : does the per-control cost grow with N? make N Select / N Link and
// set_input on N Select, N = 25, 50, 100, 200; es vs legacy alternating, ROUNDS fresh pages; median ms
// per control (painted). Quadratic growth points at Vue's queue scan (flushPreFlushCbs) during sync updates.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
const OUT = path.join(__dirname, "out");
const ROUNDS = +(process.env.ROUNDS || 3);
const NS = [25, 50, 100, 200];
(async () => {
	const label = process.argv[2] || "scale";
	const browser = await chromium.launch();
	const all = [];
	for (let r = 0; r < ROUNDS; r++)
		for (const mode of r % 2 ? ["legacy", "es"] : ["es", "legacy"]) {
			const s = await open("v5", { browser });
			const { page } = s;
			if (mode === "legacy") await s.ctx.addInitScript(() => { window.__es_link_off = true; });
			await page.goto(s.base + "/desk/todo");
			await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
			await page.waitForTimeout(2000);
			const res = await page.evaluate(async (NS) => {
				const raf2 = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
				const out = {};
				const m = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
				for (const ft of ["Select", "Link"]) for (const N of NS) {
					const xs = [];
					for (let k = 0; k < 3; k++) {
						const $p = $("<div>").appendTo(".page-body:visible");
						await raf2();
						const a = performance.now();
						for (let i = 0; i < N; i++) frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "f" + i, label: "F" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: $p, render_input: true });
						await raf2();
						xs.push(performance.now() - a);
						$p.remove();
						await raf2();
					}
					out[`make ${ft} N=${N} (ms/control)`] = +(m(xs) / N).toFixed(3);
				}
				for (const N of NS) {
					const $p = $("<div>").appendTo(".page-body:visible");
					const ls = Array.from({ length: N }, (_, i) => frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "q" + i, label: "Q" + i, options: "a\nb\nc" }, parent: $p, render_input: true }));
					await raf2(); await raf2();
					const xs = [];
					for (let k = 0; k < 5; k++) {
						const a = performance.now();
						ls.forEach((c, i) => c.set_input(["a", "b", "c"][(i + k + 1) % 3]));
						await raf2();
						xs.push(performance.now() - a);
					}
					out[`set_input Select N=${N} (ms/control)`] = +(m(xs) / N).toFixed(3);
					$p.remove();
					await raf2();
				}
				return out;
			}, NS);
			all.push({ mode, r, ...res });
			console.log(r, mode, JSON.stringify(res));
			await s.ctx.close();
		}
	await browser.close();
	const keys = Object.keys(all[0]).filter((k) => !["mode", "r"].includes(k));
	const med = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
	const summary = {};
	for (const k of keys) summary[k] = { es: med(all.filter((x) => x.mode === "es").map((x) => x[k])), legacy: med(all.filter((x) => x.mode === "legacy").map((x) => x[k])) };
	for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(40), "es", v.es, "legacy", v.legacy);
	fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify({ summary, runs: all }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
