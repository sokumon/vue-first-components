// speed2/profile/forms.cjs <label> : first open + re-open of real forms, es vs legacy controls in the SAME
// build (legacy = window.__es_link_off before any script), alternating per round, fresh context per run.
// env: DTS (default "Sales Order,Delivery Note,Stock Entry,ToDo"), ROUNDS (3), REOPEN (5),
//      PROF=1 cpu profile (100us) of first open + one re-open; TRACE=1 Chrome trace of first open;
//      TIMERS=1 in-page timers on make_input/es_mount/ES.flush/... (separate pass: they add overhead);
//      WARM=<doctype> open that form first (warms es code + JIT), then measure.
// Outputs: out/<label>.json, out/<label>-<dt>-<mode>-r<round>-{first,reopen}.cpuprofile, ...trace.json
// Run inside session.sh (no own lock).
const fs = require("fs");
const path = require("path");
const { open } = require("../../harness/lib.cjs");
const { chromium } = require("playwright");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null; };
const DTS = (process.env.DTS || "Sales Order,Delivery Note,Stock Entry,ToDo").split(",");
const ROUNDS = +(process.env.ROUNDS || 3), REOPEN = +(process.env.REOPEN || 5);
const PROF = process.env.PROF === "1", TRACE = process.env.TRACE === "1", TIMERS = process.env.TIMERS === "1";
const WARM = process.env.WARM || "";
const MODES = (process.env.MODES || "es,legacy").split(",");
const slug = (s) => s.replace(/\s+/g, "_");

async function timed_open(page, dt) {
	return page.evaluate(async (dt) => {
		const t = performance.now();
		frappe.set_route("Form", dt, frappe.model.make_new_doc_and_get_name(dt));
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
		const tReady = performance.now() - t;
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		return { ready: +tReady.toFixed(1), painted: +(performance.now() - t).toFixed(1) };
	}, dt);
}

function install_timers() {
	const T = (window.__T = {});
	const wrap = (obj, name, key) => {
		const f = obj && obj[name];
		if (typeof f !== "function") return;
		obj[name] = function () {
			const t = performance.now();
			try { return f.apply(this, arguments); } finally { const x = (T[key] ||= { n: 0, ms: 0 }); x.n++; x.ms += performance.now() - t; }
		};
	};
	const F = frappe.ui.form;
	wrap(F.ControlLink.prototype, "make_input", "Link.make_input");
	wrap(F.ControlLink.prototype, "es_mount", "Link.es_mount");
	wrap(F.ControlSelect.prototype, "make_input", "Select.make_input");
	wrap(F.ControlLink.prototype, "set_formatted_input", "Link.set_formatted_input");
	wrap(F.ControlSelect.prototype, "set_formatted_input", "Select.set_formatted_input");
	wrap(F, "make_control", "make_control (all types)");
	if (window.ES) { wrap(ES, "flush", "ES.flush"); wrap(ES, "mount", "ES.mount"); }
	const lt = (window.__LT = []);
	new PerformanceObserver((l) => l.getEntries().forEach((e) => lt.push(Math.round(e.duration)))).observe({ type: "longtask" });
}

async function run(browser, dt, mode, label, round) {
	const site = dt === "ToDo" ? "v5" : "erp";
	const s = await open(site, { browser });
	const { page } = s;
	if (mode.startsWith("legacy")) await s.ctx.addInitScript(() => { window.__es_link_off = true; });
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	if (mode.endsWith("-nocss")) await page.evaluate(() => { for (const l of document.querySelectorAll("link[rel=stylesheet]")) if (/es_link/.test(l.href)) l.disabled = true; });
	await page.waitForTimeout(2500);
	const res = { dt, mode, round };
	res.app_before = await page.evaluate(() => ({ es_app: !!(window.ES && ES.app), hosts: document.querySelectorAll("es-combobox,es-select").length }));
	if (WARM) {
		res.warm = await timed_open(page, WARM);
		await page.evaluate(() => frappe.set_route("List", "ToDo"));
		await page.waitForTimeout(1000);
	}
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Profiler.enable");
	await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
	const base = `${label}-${slug(dt)}-${mode}-r${round}`;
	if (TIMERS) await page.evaluate(install_timers);
	if (PROF) await cdp.send("Profiler.start");
	if (TRACE) await browser.startTracing(page, { path: path.join(OUT, base + "-first.trace.json"), categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8", "v8.execute", "blink.user_timing", "disabled-by-default-v8.gc"] });
	res.first = await timed_open(page, dt);
	if (TRACE) await browser.stopTracing();
	if (PROF) fs.writeFileSync(path.join(OUT, base + "-first.cpuprofile"), JSON.stringify((await cdp.send("Profiler.stop")).profile));
	if (TIMERS) {
		await page.waitForTimeout(1500);
		res.timers = await page.evaluate(() => { const o = {}; for (const [k, v] of Object.entries(__T)) o[k] = { n: v.n, ms: +v.ms.toFixed(1) }; o.longtasks = __LT.slice(); return o; });
	}
	res.counts = await page.evaluate(() => {
		const c = { Link: 0, Select: 0, visible: 0, hosts: document.querySelectorAll("es-combobox,es-select").length };
		for (const f of Object.values(cur_frm.fields_dict)) {
			if (!["Link", "Select", "Dynamic Link"].includes(f.df.fieldtype)) continue;
			c[f.df.fieldtype === "Select" ? "Select" : "Link"]++;
			if (f.$wrapper?.[0] && __tw.vis(f.$wrapper[0])) c.visible++;
		}
		const L = frappe.ui.form.es_link_lazy;
		if (L) c.lazy = { pending: L.pending(), visible: L.visible, io: L.io, focus: L.focus, forced: L.forced };
		c.dom = document.getElementsByTagName("*").length;
		return c;
	});
	const xs = [];
	for (let i = 0; i < REOPEN + 1; i++) {
		await page.evaluate(() => frappe.set_route("List", "ToDo"));
		await page.waitForTimeout(700);
		const p = PROF && i === 2;
		if (p) await cdp.send("Profiler.start");
		xs.push(await timed_open(page, dt));
		if (p) fs.writeFileSync(path.join(OUT, base + "-reopen.cpuprofile"), JSON.stringify((await cdp.send("Profiler.stop")).profile));
	}
	res.reopen_ready = med(xs.slice(1).map((x) => x.ready));
	res.reopen_painted = med(xs.slice(1).map((x) => x.painted));
	res.errors = s.rec.errors.slice(0, 5);
	await s.ctx.close();
	return res;
}

(async () => {
	const label = process.argv[2] || "forms";
	const browser = await chromium.launch();
	const all = [];
	for (let r = 0; r < ROUNDS; r++)
		for (const dt of DTS)
			for (const mode of r % 2 ? [...MODES].reverse() : MODES) {
				const x = await run(browser, dt, mode, label, r);
				all.push(x);
				console.log(r, dt.padEnd(14), mode.padEnd(6), "first", JSON.stringify(x.first), "reopen", x.reopen_ready, x.reopen_painted, JSON.stringify(x.counts), x.timers ? JSON.stringify(x.timers) : "", x.errors.length ? x.errors : "");
			}
	await browser.close();
	const summary = {};
	for (const dt of DTS) for (const mode of MODES) {
		const xs = all.filter((x) => x.dt === dt && x.mode === mode);
		const f = (k) => xs.map(k);
		const st = (v) => ({ med: med(v), min: Math.min(...v), max: Math.max(...v) });
		summary[`${dt} | ${mode}`] = {
			first_ready: st(f((x) => x.first.ready)), first_painted: st(f((x) => x.first.painted)),
			reopen_ready: st(f((x) => x.reopen_ready)), reopen_painted: st(f((x) => x.reopen_painted)),
		};
	}
	for (const [k, v] of Object.entries(summary)) console.log(k.padEnd(24), Object.entries(v).map(([a, b]) => `${a} ${b.med} [${b.min}-${b.max}]`).join("  "));
	fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify({ summary, runs: all }, null, 1));
})();
