// judge/perf2.cjs <label> : render-inclusive perf (time until the controls are painted, not until the
// constructor returns). Writes ../results/judge/perf2-<label>.json. Run under the bench lock.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(1); };

async function heap(cdp) {
	await cdp.send("HeapProfiler.collectGarbage");
	await cdp.send("HeapProfiler.collectGarbage");
	return (await cdp.send("Runtime.getHeapUsage")).usedSize;
}
async function form_open(page, dt, N) {
	const xs = [];
	for (let i = 0; i < N; i++) {
		await page.evaluate(() => frappe.set_route("List", "ToDo"));
		await page.waitForTimeout(700);
		xs.push(await page.evaluate(async (dt) => {
			const t = performance.now();
			frappe.set_route("Form", dt, frappe.model.make_new_doc_and_get_name(dt));
			// visible + every visible Link/Select has a visible input or trigger, then two frames (paint)
			const ready = () => {
				if (!(window.cur_frm?.doctype === dt && cur_frm.layout?.wrapper?.is(":visible"))) return false;
				for (const c of Object.values(cur_frm.fields_dict)) {
					const ft = c.df?.fieldtype;
					if (!["Link", "Select", "Dynamic Link"].includes(ft) || !c.$wrapper?.[0] || !__tw.vis(c.$wrapper[0])) continue;
					const ci = c.$wrapper[0].querySelector(".control-input");
					if (!ci || !__tw.vis(ci)) continue;
					if (![...ci.querySelectorAll("input,select,button")].some(__tw.vis)) return false;
				}
				return true;
			};
			await new Promise((res, rej) => { const c = () => (ready() ? res() : performance.now() - t > 30000 ? rej(new Error("timeout")) : setTimeout(c, 2)); c(); });
			await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
			return performance.now() - t;
		}, dt));
	}
	xs.shift();
	return med(xs);
}

let res0;
(async () => {
	const label = process.argv[2] || "run"; const MODE = process.env.MODE || "es"; res0 = { mode: MODE };
	const N = 7;
	const browser = await chromium.launch();
	const res = { label, ...res0 };
	{
		const s = await open("v5", { browser });
		const { page } = s;
		if (MODE.startsWith("legacy")) await s.ctx.addInitScript(() => { window.__es_link_off = true; });
		if (MODE.includes("+eager")) await s.ctx.addInitScript(() => { window.__es_lazy_off = true; });
		if (MODE.includes("+top")) await s.ctx.addInitScript(() => { window.__top = true; });
		await page.goto(s.base + "/desk/todo");
		await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
		await page.waitForTimeout(2500);
		res["open new ToDo, painted (ms)"] = await form_open(page, "ToDo", N);
		res["open new Workflow, painted (ms)"] = await form_open(page, "Workflow", N);
		await page.evaluate(() => frappe.set_route("List", "ToDo"));
		await page.waitForTimeout(800);
		Object.assign(res, await page.evaluate(async () => {
			const r = {};
			const raf2 = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
			const $p = window.__top ? $("<div style=\"position:fixed;inset:0;overflow:auto;z-index:5;background:#fff\">").appendTo("body") : $("<div>").appendTo(".page-body:visible");
			for (const ft of ["Link", "Select"]) {
				const xs = [];
				for (let k = 0; k < 5; k++) {
					$p.empty();
					await raf2();
					const a = performance.now();
					for (let i = 0; i < 100; i++) frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "f" + i, label: "F" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: $p, render_input: true });
					await raf2();
					xs.push(performance.now() - a);
				}
				xs.sort((a, b) => a - b);
				r[`make 100 ${ft}, painted (ms)`] = +xs[2].toFixed(1);
			}
			$p.empty();
			const __unused=0; const ls = Array.from({ length: 100 }, (_, i) => frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "q" + i, label: "Q" + i, options: "a\nb\nc" }, parent: $p, render_input: true }));
			await raf2();
			const ys = [];
			for (let k = 0; k < 5; k++) { const a = performance.now(); ls.forEach((c, i) => c.set_input(["a", "b", "c"][(i + k) % 3])); await raf2(); ys.push(performance.now() - a); }
			ys.sort((a, b) => a - b);
			r["set_input 100 Select, painted (ms)"] = +ys[2].toFixed(1);
			$p.remove();
			const ds = [];
			for (let k = 0; k < 5; k++) {
				const a = performance.now();
				const d = new frappe.ui.Dialog({ title: "perf", fields: [
					...Array.from({ length: 40 }, (_, i) => ({ fieldname: "l" + i, fieldtype: "Link", options: "User", label: "L" + i })),
					...Array.from({ length: 10 }, (_, i) => ({ fieldname: "s" + i, fieldtype: "Select", options: "a\nb", label: "S" + i })),
				] });
				d.show();
				await raf2();
				ds.push(performance.now() - a);
				d.hide(); d.$wrapper.remove();
			}
			ds.sort((a, b) => a - b);
			r["dialog 40 Link + 10 Select, painted (ms)"] = +ds[2].toFixed(1);
			return r;
		}));
		const cdp = await page.context().newCDPSession(page);
		for (const ft of ["Link", "Select"]) {
			await page.evaluate(() => { window.__hp = window.__top ? $("<div style=\"position:fixed;inset:0;overflow:auto;z-index:5;background:#fff\">").appendTo("body") : $("<div>").appendTo(".page-body:visible"); window.__hc = []; });
			await page.waitForTimeout(300);
			const h0 = await heap(cdp);
			const d0 = await cdp.send("Memory.getDOMCounters");
			await page.evaluate(async (ft) => {
				for (let i = 0; i < 200; i++) __hc.push(frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "h" + i, label: "H" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: __hp, render_input: true }));
				await new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
			}, ft);
			await page.waitForTimeout(500);
			const h1 = await heap(cdp);
			const d1 = await cdp.send("Memory.getDOMCounters");
			await page.evaluate(() => { __hp.remove(); __hc = null; });
			await page.waitForTimeout(1500);
			const h2 = await heap(cdp);
			res[`heap per ${ft}, attached (KB)`] = +((h1 - h0) / 200 / 1024).toFixed(1);
			res[`DOM nodes per ${ft}`] = +((d1.nodes - d0.nodes) / 200).toFixed(1);
			res[`listeners per ${ft}`] = +((d1.jsEventListeners - d0.jsEventListeners) / 200).toFixed(1);
			res[`heap kept after remove 200 ${ft} (KB)`] = +((h2 - h0) / 1024).toFixed(0);
		}
		await s.ctx.close();
	}
	await browser.close();
	const dir = path.join(__dirname, "out");
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, `perf2-${label}.json`), JSON.stringify(res, null, 1));
	console.log(JSON.stringify(res, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
