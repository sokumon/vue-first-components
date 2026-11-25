// Perf for Link/Select: form open times (median), synthetic make_control cost, dialog with many links,
// JS heap per control and heap growth over repeated form opens (CDP, after forced GC).
// Usage: node perf.cjs <label> [runs=7] -> ../results/perf-<label>.json. Run under the bench lock.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open } = require("./lib.cjs");
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(1); };

async function heap(cdp) {
	await cdp.send("HeapProfiler.collectGarbage");
	await cdp.send("HeapProfiler.collectGarbage");
	return (await cdp.send("Runtime.getHeapUsage")).usedSize;
}
// DOM nodes and JS event listeners live outside the JS heap: count them separately
const dom = async (cdp) => cdp.send("Memory.getDOMCounters");
async function open_times(page, specs, N) {
	const out = {};
	for (const [label, route] of specs) {
		const xs = [];
		for (let i = 0; i < N; i++) {
			await page.evaluate(() => frappe.set_route("List", "ToDo"));
			await page.waitForTimeout(700);
			xs.push(await page.evaluate(async (route) => {
				const t = performance.now();
				// a full form even for quick-entry doctypes (frappe.new_doc would open the quick entry dialog)
				if (route[0] === "new") frappe.set_route("Form", route[1], frappe.model.make_new_doc_and_get_name(route[1]));
				else frappe.set_route(...route);
				const dt = route[1];
				await new Promise((res, rej) => { const c = () => (window.cur_frm?.doctype === dt && cur_frm.layout?.wrapper?.is(":visible") ? res() : performance.now() - t > 30000 ? rej(new Error("form did not open: " + dt)) : setTimeout(c, 5)); c(); });
				return performance.now() - t;
			}, route));
		}
		xs.shift();
		out[`open ${label} (ms)`] = med(xs);
		console.error("  ", label, out[`open ${label} (ms)`]);
		out[`open ${label} controls`] = await page.evaluate(() => {
			const c = Object.values(cur_frm.fields_dict).map((f) => f.df.fieldtype);
			return { link: c.filter((t) => t === "Link" || t === "Dynamic Link").length, select: c.filter((t) => t === "Select").length, all: c.length };
		});
	}
	return out;
}

(async () => {
	const label = process.argv[2] || "run";
	const N = +(process.argv[3] || 7);
	const browser = await chromium.launch();
	const res = { label, started: new Date().toISOString() };
	// --- v5: forms + synthetic
	{
		const s = await open("v5", { browser });
		const { page } = s;
		await page.goto(s.base + "/desk/todo");
		await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
		await page.waitForTimeout(3000);
		Object.assign(res, await open_times(page, [["User", ["Form", "User", "Administrator"]], ["ToDo (new)", ["new", "ToDo"]], ["Workflow (new)", ["new", "Workflow"]]], N));
		await page.evaluate(() => frappe.set_route("List", "ToDo"));
		await page.waitForTimeout(1000);
		const cdp = await page.context().newCDPSession(page);
		// synthetic make_control: 200 Link + 200 Select
		Object.assign(res, await page.evaluate(async () => {
			const r = {};
			const t = (fn) => { const a = performance.now(); fn(); return performance.now() - a; };
			const $p = $("<div>").appendTo(document.body);
			const make = (ft, n) => Array.from({ length: n }, (_, i) => frappe.ui.form.make_control({
				df: { fieldtype: ft, fieldname: "f" + i, label: "F" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: $p, render_input: true }));
			for (const [ft, n] of [["Link", 200], ["Select", 200]]) {
				const xs = [];
				for (let k = 0; k < 5; k++) { $p.empty(); xs.push(t(() => make(ft, n))); }
				xs.sort((a, b) => a - b);
				r[`make ${n} ${ft} controls (ms)`] = +xs[2].toFixed(1);
			}
			$p.empty();
			const ls = make("Link", 200);
			const ys = [];
			for (let k = 0; k < 5; k++) ys.push(t(() => ls.forEach((c, i) => c.set_input(i % 2 ? "Administrator" : "Guest"))));
			ys.sort((a, b) => a - b);
			r["set_input on 200 Link (ms)"] = +ys[2].toFixed(1);
			const zs = [];
			for (let k = 0; k < 5; k++) zs.push(t(() => ls.forEach((c) => c.refresh())));
			zs.sort((a, b) => a - b);
			r["refresh() on 200 Link (ms)"] = +zs[2].toFixed(1);
			const ss = make("Select", 200);
			const ws = [];
			for (let k = 0; k < 5; k++) ws.push(t(() => ss.forEach((c, i) => c.set_input(["a", "b", "c"][(i + k) % 3]))));
			ws.sort((a, b) => a - b);
			r["set_input on 200 Select (ms)"] = +ws[2].toFixed(1);
			$p.remove();
			// dialog with 40 Link + 10 Select
			const ds = [];
			for (let k = 0; k < 5; k++) {
				const a = performance.now();
				const d = new frappe.ui.Dialog({ title: "perf", fields: [
					...Array.from({ length: 40 }, (_, i) => ({ fieldname: "l" + i, fieldtype: "Link", options: "User", label: "L" + i })),
					...Array.from({ length: 10 }, (_, i) => ({ fieldname: "s" + i, fieldtype: "Select", options: "a\nb", label: "S" + i })),
				] });
				d.show();
				ds.push(performance.now() - a);
				d.hide();
				d.$wrapper.remove();
			}
			ds.sort((a, b) => a - b);
			r["dialog 40 Link + 10 Select, new+show (ms)"] = +ds[2].toFixed(1);
			return r;
		}));
		// heap per control
		await page.evaluate(() => { window.__hp = $("<div>").appendTo(document.body); window.__hc = []; });
		const h0 = await heap(cdp);
		const d0 = await dom(cdp);
		await page.evaluate(() => { for (let i = 0; i < 300; i++) __hc.push(frappe.ui.form.make_control({ df: { fieldtype: "Link", fieldname: "h" + i, label: "H" + i, options: "User" }, parent: __hp, render_input: true })); });
		const h1 = await heap(cdp);
		const d1 = await dom(cdp);
		await page.evaluate(() => { for (let i = 0; i < 300; i++) __hc.push(frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "s" + i, label: "S" + i, options: "a\nb\nc" }, parent: __hp, render_input: true })); });
		const h2 = await heap(cdp);
		const d2 = await dom(cdp);
		await page.evaluate(() => { __hp.remove(); __hc = null; });
		const h3 = await heap(cdp);
		const d3 = await dom(cdp);
		res["DOM nodes per Link control"] = +((d1.nodes - d0.nodes) / 300).toFixed(1);
		res["DOM nodes per Select control"] = +((d2.nodes - d1.nodes) / 300).toFixed(1);
		res["JS listeners per Link control"] = +((d1.jsEventListeners - d0.jsEventListeners) / 300).toFixed(1);
		res["JS listeners per Select control"] = +((d2.jsEventListeners - d1.jsEventListeners) / 300).toFixed(1);
		res["DOM nodes left after removing 600 controls"] = d3.nodes - d0.nodes;
		res["heap per Link control (KB)"] = +((h1 - h0) / 300 / 1024).toFixed(2);
		res["heap per Select control (KB)"] = +((h2 - h1) / 300 / 1024).toFixed(2);
		res["heap left after removing 600 controls (KB)"] = +((h3 - h0) / 1024).toFixed(1);
		await s.ctx.close();
	}
	// --- erp: Sales Invoice / Stock Entry open + heap growth
	{
		const s = await open("erp", { browser });
		const { page } = s;
		await page.goto(s.base + "/desk/todo");
		await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
		await page.waitForTimeout(3000);
		Object.assign(res, await open_times(page, [["Sales Invoice (new)", ["new", "Sales Invoice"]], ["Stock Entry (new)", ["new", "Stock Entry"]]], N));
		const cdp = await page.context().newCDPSession(page);
		await page.evaluate(() => frappe.set_route("List", "ToDo"));
		await page.waitForTimeout(800);
		const a = await heap(cdp);
		for (let i = 0; i < 5; i++) {
			await page.evaluate(() => frappe.set_route("Form", "Sales Invoice", frappe.model.make_new_doc_and_get_name("Sales Invoice")));
			await page.waitForFunction(() => window.cur_frm?.doctype === "Sales Invoice" && cur_frm.layout?.wrapper?.is(":visible"));
			await page.waitForTimeout(800);
			await page.evaluate(() => frappe.set_route("List", "ToDo"));
			await page.waitForTimeout(600);
		}
		const b = await heap(cdp);
		res["heap growth per new Sales Invoice (KB, 5 opens)"] = +((b - a) / 5 / 1024).toFixed(1);
		res["heap after (MB)"] = +(b / 1048576).toFixed(1);
		await s.ctx.close();
	}
	await browser.close();
	const file = path.join(__dirname, "..", "results", `perf-${label}.json`);
	fs.writeFileSync(file, JSON.stringify(res, null, 1));
	console.log(JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
