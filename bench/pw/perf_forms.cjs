// Form and control timings, median of N runs. Works on the legacy and the v5 controls.
const { open } = require("./session.cjs");
const N = 7;
(async () => {
	const { browser, page, base } = await open();
	await page.goto(base + "/desk/todo", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(4000);
	const kind = await page.evaluate(() => (frappe.ui.form.Control.view ? "v5" : "legacy"));
	const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
	const out = {};
	for (const [doctype, name] of [["User", "Administrator"], ["System Settings", "System Settings"]]) {
		const runs = [];
		for (let i = 0; i < N; i++) {
			await page.evaluate(() => frappe.set_route("List", "ToDo"));
			await page.waitForTimeout(600);
			runs.push(await page.evaluate(async ([doctype, name]) => {
				const start = performance.now();
				frappe.set_route("Form", doctype, name);
				await new Promise((resolve) => {
					const check = () => (window.cur_frm?.doctype === doctype && cur_frm.layout?.wrapper?.is(":visible") ? resolve() : setTimeout(check, 5));
					check();
				});
				return performance.now() - start;
			}, [doctype, name]));
		}
		runs.shift();
		out[`open ${doctype} (ms)`] = Math.round(med(runs));
	}
	Object.assign(out, await page.evaluate(() => {
		const r = {};
		const parent = $("<div>").appendTo(document.body);
		const time = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };
		const make = (fieldtype, n) => Array.from({ length: n }, (_, i) => frappe.ui.form.make_control({ df: { fieldtype, fieldname: "f" + i, label: "F" + i, options: fieldtype === "Select" ? "a\nb\nc" : undefined }, parent, render_input: true }));
		for (const [ft, n] of [["Data", 500], ["Int", 500], ["Select", 500]]) {
			const xs = [];
			for (let k = 0; k < 5; k++) { parent.empty(); xs.push(time(() => make(ft, n))); }
			xs.sort((a, b) => a - b);
			r[`make ${n} ${ft} controls (ms)`] = Math.round(xs[2]);
		}
		parent.empty();
		const ctls = make("Data", 500);
		const xs = [];
		for (let k = 0; k < 5; k++) xs.push(time(() => ctls.forEach((c, i) => c.set_input("v" + k + i))));
		xs.sort((a, b) => a - b);
		r["set_input on 500 Data controls (ms)"] = +xs[2].toFixed(1);
		const ys = [];
		for (let k = 0; k < 5; k++) ys.push(time(() => ctls.forEach((c) => c.refresh())));
		ys.sort((a, b) => a - b);
		r["refresh() on 500 Data controls (ms)"] = +ys[2].toFixed(1);
		const zs = [];
		for (let k = 0; k < 5; k++) zs.push(time(() => ctls.forEach((c, i) => { c.df.reqd = (k + i) % 2; c.refresh(); })));
		zs.sort((a, b) => a - b);
		r["refresh() on 500 after toggling reqd (ms)"] = +zs[2].toFixed(1);
		parent.remove();
		return r;
	}));
	console.log(kind, JSON.stringify(out));
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
