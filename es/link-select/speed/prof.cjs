// speed/prof.cjs <label> : Sales Invoice open, legacy controls vs es controls in the SAME build
// (legacy = window.__es_link_off before any script). Splits first open (controls built) from
// re-open (frm cached, only refresh), and records a CPU profile of one of each. Run under bench lock.
const fs = require("fs");
const path = require("path");
const { open } = require("../harness/lib.cjs");
const { chromium } = require("playwright");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(1); };
const P = process.env.PROF !== "0";
const DT = process.env.DT || "Sales Invoice";

async function timed_open(page) {
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
	}, DT);
}

function summarize(profile, top = 30) {
	const { nodes, samples, timeDeltas } = profile;
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const self = new Map();
	for (let i = 0; i < samples.length; i++) self.set(samples[i], (self.get(samples[i]) || 0) + (timeDeltas[i] || 0));
	const fn = new Map(), file = new Map();
	let total = 0;
	for (const [id, us] of self) {
		const n = byId.get(id); const cf = n.callFrame;
		const f = (cf.url.split("/").pop() || "(" + cf.functionName + ")").replace(/\.[A-Z0-9]{8}\./, ".");
		if (/^\((idle|program)\)$/.test(f)) continue;
		total += us;
		const k = `${cf.functionName || "(anon)"} @ ${f}:${cf.lineNumber + 1}`;
		fn.set(k, (fn.get(k) || 0) + us);
		file.set(f, (file.get(f) || 0) + us);
	}
	const ms = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => `${(v / 1000).toFixed(1).padStart(7)} ms  ${k}`);
	return { total_ms: +(total / 1000).toFixed(1), files: ms(file).slice(0, 15), functions: ms(fn) };
}

async function run(browser, mode, label) {
	const s = await open("erp", { browser });
	const { page } = s;
	if (mode === "legacy") await s.ctx.addInitScript(() => { window.__es_link_off = true; });
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(2500);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Profiler.enable");
	await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
	const res = { mode };
	// first open: builds every control
	if (P) await cdp.send("Profiler.start");
	res.first = await timed_open(page);
	if (P) { const p1 = (await cdp.send("Profiler.stop")).profile;
	fs.writeFileSync(path.join(OUT, `${label}-${mode}-first.cpuprofile`), JSON.stringify(p1));
	res.first_prof = summarize(p1); }
	res.es_hosts = await page.evaluate(() => document.querySelectorAll("es-combobox,es-select").length);
	res.fields = await page.evaluate(() => {
		const c = { Link: 0, Select: 0, built: 0, visible: 0 };
		for (const f of Object.values(cur_frm.fields_dict)) {
			if (!["Link", "Select", "Dynamic Link"].includes(f.df.fieldtype)) continue;
			c[f.df.fieldtype === "Select" ? "Select" : "Link"]++;
			if (f.$input) c.built++;
			if (f.$wrapper?.[0] && __tw.vis(f.$wrapper[0])) c.visible++;
		}
		return c;
	});
	// re-opens: frm and its controls are cached, only refresh runs
	const xs = [];
	for (let i = 0; i < 6; i++) {
		await page.evaluate(() => frappe.set_route("List", "ToDo"));
		await page.waitForTimeout(700);
		if (P && i === 3) await cdp.send("Profiler.start");
		xs.push(await timed_open(page));
		if (P && i === 3) {
			const p2 = (await cdp.send("Profiler.stop")).profile;
			fs.writeFileSync(path.join(OUT, `${label}-${mode}-reopen.cpuprofile`), JSON.stringify(p2));
			res.reopen_prof = summarize(p2);
		}
	}
	res.reopen_ready = med(xs.slice(1).map((x) => x.ready));
	res.reopen_painted = med(xs.slice(1).map((x) => x.painted));
	res.errors = s.rec.errors.slice(0, 5);
	await s.ctx.close();
	return res;
}

(async () => {
	const label = process.argv[2] || "run";
	const modes = (process.env.MODES || "legacy,es").split(",");
	const browser = await chromium.launch();
	const out = {};
	for (let rep = 0; rep < (+process.env.REPS || 1); rep++)
		for (const m of modes) {
			const r = await run(browser, m, label);
			(out[m] ||= []).push(r);
			console.log(m, "first", JSON.stringify(r.first), "reopen ready/painted", r.reopen_ready, r.reopen_painted, "hosts", r.es_hosts, JSON.stringify(r.fields), r.errors.length ? r.errors : "");
		}
	await browser.close();
	fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(out, null, 1));
})();
