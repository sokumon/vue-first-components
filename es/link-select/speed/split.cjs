// speed/split.cjs : first open of Sales Invoice with make_input / ES.flush / sync_select timed in the page.
const { open } = require("../harness/lib.cjs");
const { chromium } = require("playwright");
const DT = process.env.DT || "Sales Invoice";
(async () => {
	const browser = await chromium.launch();
	for (const mode of (process.env.MODES || "es,legacy").split(",")) for (let rep = 0; rep < 2; rep++) {
		const s = await open("erp", { browser });
		const { page } = s;
		if (mode === "legacy") await s.ctx.addInitScript(() => { window.__es_link_off = true; });
		await page.goto(s.base + "/desk/todo");
		await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
		await page.waitForTimeout(2500);
		const r = await page.evaluate(async (dt) => {
			const T = (window.__T = {});
			const wrap = (obj, name, key) => {
				const f = obj[name];
				obj[name] = function () {
					const t = performance.now();
					try { return f.apply(this, arguments); } finally { const x = (T[key] ||= { n: 0, ms: 0 }); x.n++; x.ms += performance.now() - t; }
				};
			};
			const F = frappe.ui.form;
			wrap(F.ControlLink.prototype, "make_input", "Link.make_input");
			wrap(F.ControlSelect.prototype, "make_input", "Select.make_input");
			wrap(F.ControlLink.prototype, "set_formatted_input", "Link.set_formatted_input");
			wrap(F.ControlSelect.prototype, "set_formatted_input", "Select.set_formatted_input");
			wrap(F, "make_control", "make_control (all types)");
			if (window.ES) { wrap(ES, "flush", "ES.flush"); wrap(ES, "mount", "ES.mount"); }
			// microtask-batched renders show up as long tasks after the sync part
			const lt = [];
			new PerformanceObserver((l) => l.getEntries().forEach((e) => lt.push(e.duration))).observe({ type: "longtask" });
			const t = performance.now();
			frappe.set_route("Form", dt, frappe.model.make_new_doc_and_get_name(dt));
			await new Promise((res) => { const c = () => (window.cur_frm?.doctype === dt && cur_frm.layout?.wrapper?.is(":visible") ? res() : setTimeout(c, 2)); c(); });
			const ready = performance.now() - t;
			await new Promise((r) => setTimeout(r, 1500));
			const out = { ready: +ready.toFixed(0), longtasks: lt.map((x) => Math.round(x)) };
			for (const [k, v] of Object.entries(T)) out[k] = `${v.n}x ${v.ms.toFixed(1)}ms`;
			return out;
		}, DT);
		console.log(mode, JSON.stringify(r));
		await s.ctx.close();
	}
	await browser.close();
})();
