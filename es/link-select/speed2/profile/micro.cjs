// speed2/profile/micro.cjs <label> : synthetic, render-inclusive set (trimmed judge/perf2.cjs) plus a
// decomposition of the es-* cost, es vs legacy in the SAME build, alternating, ROUNDS fresh pages each.
// env ROUNDS (3), PROF=1 (cpu profiles of the synthetic scenarios, es and legacy), PARTS (all).
// Out: out/<label>.json, out/<label>-<scenario>-<mode>-r<n>.cpuprofile. Run inside session.sh.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? +s[Math.floor(s.length / 2)].toFixed(2) : null; };
const ROUNDS = +(process.env.ROUNDS || 3);
const PROF = process.env.PROF === "1";

async function heap(cdp) {
	await cdp.send("HeapProfiler.collectGarbage");
	await cdp.send("HeapProfiler.collectGarbage");
	return (await cdp.send("Runtime.getHeapUsage")).usedSize;
}

// in-page helpers
function helpers() {
	window.__raf2 = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
	window.__area = () => $("<div>").appendTo(".page-body:visible");
}

async function scen(page, cdp, name, mode, label, round, fn, arg) {
	if (PROF) { await cdp.send("Profiler.start"); }
	const r = await page.evaluate(fn, arg);
	if (PROF) fs.writeFileSync(path.join(OUT, `${label}-${name}-${mode}-r${round}.cpuprofile`), JSON.stringify((await cdp.send("Profiler.stop")).profile));
	return r;
}

// first-use: the 1st..12th control on a fresh page, each timed on its own (sync JS incl. mount)
async function first_use(ft) {
	await __raf2();
	const $p = __area();
	const xs = [];
	const lazyOff = window.__es_lazy_off;
	window.__es_lazy_off = true; // eager: the mount happens inside make_control
	for (let i = 0; i < 12; i++) {
		const a = performance.now();
		frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "fu" + i, label: "FU" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: $p, render_input: true });
		xs.push(+(performance.now() - a).toFixed(2));
		await __raf2();
	}
	window.__es_lazy_off = lazyOff;
	$p.remove();
	return xs;
}

async function make100(ft) {
	const xs = [], js = [];
	const $p = __area();
	for (let k = 0; k < 5; k++) {
		$p.empty();
		await __raf2();
		const a = performance.now();
		for (let i = 0; i < 100; i++) frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "f" + i, label: "F" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: $p, render_input: true });
		js.push(performance.now() - a);
		await __raf2();
		xs.push(performance.now() - a);
	}
	$p.remove();
	const m = (v) => +[...v].sort((a, b) => a - b)[2].toFixed(1);
	return { painted: m(xs), js: m(js) };
}
async function setinput100() {
	const $p = __area();
	const ls = Array.from({ length: 100 }, (_, i) => frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "q" + i, label: "Q" + i, options: "a\nb\nc" }, parent: $p, render_input: true }));
	await __raf2();
	const ys = [], js = [];
	for (let k = 0; k < 5; k++) {
		const a = performance.now();
		ls.forEach((c, i) => c.set_input(["a", "b", "c"][(i + k) % 3]));
		js.push(performance.now() - a);
		await __raf2();
		ys.push(performance.now() - a);
	}
	$p.remove();
	const m = (v) => +[...v].sort((a, b) => a - b)[2].toFixed(1);
	return { painted: m(ys), js: m(js) };
}
async function dialog50() {
	const ds = [], js = [];
	for (let k = 0; k < 5; k++) {
		const a = performance.now();
		const d = new frappe.ui.Dialog({ title: "perf", fields: [
			...Array.from({ length: 40 }, (_, i) => ({ fieldname: "l" + i, fieldtype: "Link", options: "User", label: "L" + i })),
			...Array.from({ length: 10 }, (_, i) => ({ fieldname: "s" + i, fieldtype: "Select", options: "a\nb", label: "S" + i })),
		] });
		d.show();
		js.push(performance.now() - a);
		await __raf2();
		ds.push(performance.now() - a);
		d.hide(); d.$wrapper.remove();
		await new Promise((r) => setTimeout(r, 400));
	}
	const m = (v) => +[...v].sort((a, b) => a - b)[2].toFixed(1);
	return { painted: m(ds), js: m(js) };
}

// decomposition (es only): runtime overhead vs component cost
async function decompose() {
	const out = {};
	const V = ES.Vue;
	const m = (v) => +[...v].sort((a, b) => a - b)[Math.floor(v.length / 2)].toFixed(2);
	const CB = ES.def("es-combobox").comp, SEL = ES.def("es-select").comp;
	const cbProps = () => ({ options: [], modelValue: null, query: "", open: false, filterable: false, openOnFocus: false, openOnClick: false, placeholder: "", emptyText: "No results found" });
	const selProps = (v) => ({ options: [{ label: "a", value: "a" }, { label: "b", value: "b" }, { label: "c", value: "c" }], modelValue: v || "a", disabled: false, placeholder: " " });
	if (!customElements.get("es-noop")) ES.defineEs("es-noop", V.defineComponent({ props: { value: String }, render() { return V.h("input", { value: this.value }); } }));
	const run = async (fn, reps = 5) => {
		const js = [], painted = [];
		for (let k = 0; k < reps; k++) {
			const $p = __area();
			await __raf2();
			const a = performance.now();
			const cleanup = fn($p[0]);
			js.push(performance.now() - a);
			await __raf2();
			painted.push(performance.now() - a);
			if (cleanup) cleanup();
			$p.remove();
			await __raf2();
		}
		return { js: m(js), painted: m(painted) };
	};
	// 1. runtime only: 100 trivial es-noop hosts, one ES.mount + ES.flush each (what insert_host does)
	out["100 es-noop, mount+flush each"] = await run((p) => { for (let i = 0; i < 100; i++) { const h = document.createElement("es-noop"); h.value = "x"; p.appendChild(h); ES.flush(); } });
	// 1b. same, connected in one ES.batch
	out["100 es-noop, one ES.batch"] = await run((p) => ES.batch(() => { for (let i = 0; i < 100; i++) { const h = document.createElement("es-noop"); h.value = "x"; p.appendChild(h); } }));
	// 2. plain Vue (no runtime): 100 Combobox / Select in ONE app render
	const plain = (C, props) => (p) => { const a = V.createApp({ render: () => Array.from({ length: 100 }, (_, i) => V.h(C, { key: i, ...props() })) }); a.mount(p); return () => a.unmount(); };
	out["plain Vue: 100 Combobox in one app"] = await run(plain(CB, cbProps));
	out["plain Vue: 100 Select in one app"] = await run(plain(SEL, () => selProps()));
	// 2b. plain Vue: one createApp per component (sync mount each, no runtime)
	const each = (C, props) => (p) => { const apps = []; for (let i = 0; i < 100; i++) { const d = document.createElement("div"); p.appendChild(d); const a = V.createApp({ render: () => V.h(C, props()) }); a.mount(d); apps.push(a); } return () => apps.forEach((a) => a.unmount()); };
	out["plain Vue: 100 Combobox, createApp each"] = await run(each(CB, cbProps));
	out["plain Vue: 100 Select, createApp each"] = await run(each(SEL, () => selProps()));
	// 3. runtime + component, no Desk glue: 100 hosts, ES.flush each
	const esHosts = (tag, props) => (p) => { for (let i = 0; i < 100; i++) { const h = document.createElement(tag); Object.assign(h, props()); p.appendChild(h); ES.flush(); } };
	out["100 es-combobox, mount+flush each"] = await run(esHosts("es-combobox", cbProps));
	out["100 es-select, mount+flush each"] = await run(esHosts("es-select", () => selProps()));
	out["100 es-combobox, one ES.batch"] = await run((p) => ES.batch(() => { for (let i = 0; i < 100; i++) { const h = document.createElement("es-combobox"); Object.assign(h, cbProps()); p.appendChild(h); } }));
	// 3b. same but with the glue's <template slot="item-html"> slot (template stamping path)
	out["100 es-combobox + item-html template, flush each"] = await run((p) => { for (let i = 0; i < 100; i++) { const h = document.createElement("es-combobox"); Object.assign(h, cbProps()); h.innerHTML = '<template slot="item-html"><span class="es-link-html"></span></template>'; p.appendChild(h); ES.flush(); } });
	// 4. Select re-render: 100 mounted es-select, change modelValue on all, one flush (microtask batch path)
	{
		const js = [], painted = [], plainJs = [], plainPainted = [];
		const $p = __area();
		const hs = Array.from({ length: 100 }, () => { const h = document.createElement("es-select"); Object.assign(h, selProps()); $p[0].appendChild(h); return h; });
		ES.flush(); await __raf2();
		for (let k = 0; k < 5; k++) {
			const a = performance.now();
			hs.forEach((h, i) => (h.modelValue = ["a", "b", "c"][(i + k + 1) % 3]));
			ES.flush();
			js.push(performance.now() - a);
			await __raf2();
			painted.push(performance.now() - a);
		}
		$p.remove();
		out["re-render 100 es-select (value change, ES.flush)"] = { js: m(js), painted: m(painted) };
		// plain Vue, one app, reactive values, Vue's own scheduler
		const $q = __area();
		const vals = V.reactive(Array.from({ length: 100 }, () => "a"));
		const a2 = V.createApp({ render: () => vals.map((v, i) => V.h(SEL, { key: i, ...selProps(v) })) });
		a2.mount($q[0]); await __raf2();
		for (let k = 0; k < 5; k++) {
			const a = performance.now();
			for (let i = 0; i < 100; i++) vals[i] = ["a", "b", "c"][(i + k + 1) % 3];
			await V.nextTick();
			plainJs.push(performance.now() - a);
			await __raf2();
			plainPainted.push(performance.now() - a);
		}
		a2.unmount(); $q.remove();
		out["plain Vue: re-render 100 Select (one app, nextTick)"] = { js: m(plainJs), painted: m(plainPainted) };
	}
	// 5. render(spare) cost alone (the post-flush trick run after every syncUpdate)
	{
		const d = document.createElement("div"); const t = performance.now();
		for (let i = 0; i < 1000; i++) V.render(V.h("i"), d);
		out["1000x render(h('i'), spare) (ms)"] = +(performance.now() - t).toFixed(2);
	}
	// 6. lazy-mount rAF check cost model: getClientRects on 100 stand-ins after DOM changes = forced layout
	return out;
}

async function run_mode(browser, mode, label, round, parts) {
	const res = { mode, round };
	const s = await open("v5", { browser });
	const { page } = s;
	if (mode === "legacy") await s.ctx.addInitScript(() => { window.__es_link_off = true; });
	await page.goto(s.base + "/desk/todo");
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await page.waitForTimeout(2500);
	await page.evaluate(helpers);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Profiler.enable");
	await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
	if (parts.includes("first")) {
		res["first-use Link (ms each, 1st..12th)"] = await scen(page, cdp, "firstuse-link", mode, label, round, first_use, "Link");
		res["first-use Select (ms each, 1st..12th)"] = await scen(page, cdp, "firstuse-select", mode, label, round, first_use, "Select");
	}
	if (parts.includes("synth")) {
		res["make 100 Link"] = await scen(page, cdp, "make100link", mode, label, round, make100, "Link");
		res["make 100 Select"] = await scen(page, cdp, "make100select", mode, label, round, make100, "Select");
		res["set_input 100 Select"] = await scen(page, cdp, "setinput100", mode, label, round, setinput100);
		res["dialog 40 Link + 10 Select"] = await scen(page, cdp, "dialog50", mode, label, round, dialog50);
	}
	if (parts.includes("heap")) {
		for (const ft of ["Link", "Select"]) {
			await page.evaluate(() => { window.__hp = $("<div>").appendTo(".page-body:visible"); window.__hc = []; });
			await page.waitForTimeout(300);
			const h0 = await heap(cdp);
			const d0 = await cdp.send("Memory.getDOMCounters");
			await page.evaluate(async (ft) => {
				for (let i = 0; i < 200; i++) __hc.push(frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "h" + i, label: "H" + i, options: ft === "Select" ? "a\nb\nc" : "User" }, parent: __hp, render_input: true }));
				await __raf2();
			}, ft);
			await page.waitForTimeout(500);
			const h1 = await heap(cdp);
			const d1 = await cdp.send("Memory.getDOMCounters");
			await page.evaluate(() => { __hp.remove(); __hc = null; });
			res[`heap per ${ft} (KB)`] = +((h1 - h0) / 200 / 1024).toFixed(1);
			res[`DOM nodes per ${ft}`] = +((d1.nodes - d0.nodes) / 200).toFixed(1);
			res[`listeners per ${ft}`] = +((d1.jsEventListeners - d0.jsEventListeners) / 200).toFixed(1);
		}
	}
	if (parts.includes("decomp") && mode === "es") res.decomp = await scen(page, cdp, "decomp", mode, label, round, decompose);
	res.errors = s.rec.errors.slice(0, 5);
	await s.ctx.close();
	return res;
}

(async () => {
	const label = process.argv[2] || "micro";
	const parts = (process.env.PARTS || "first,synth,heap,decomp").split(",");
	const browser = await chromium.launch();
	const all = [];
	for (let r = 0; r < ROUNDS; r++)
		for (const mode of r % 2 ? ["legacy", "es"] : ["es", "legacy"]) {
			const x = await run_mode(browser, mode, label, r, parts);
			all.push(x);
			console.log(r, mode, JSON.stringify(x));
		}
	await browser.close();
	// medians
	const summary = {};
	for (const mode of ["es", "legacy"]) {
		const xs = all.filter((x) => x.mode === mode);
		const S = (summary[mode] = {});
		for (const k of Object.keys(xs[0])) {
			if (["mode", "round", "errors"].includes(k)) continue;
			const v0 = xs[0][k];
			if (Array.isArray(v0)) S[k] = v0.map((_, i) => med(xs.map((x) => x[k][i])));
			else if (typeof v0 === "number") S[k] = med(xs.map((x) => x[k]));
			else if (v0 && typeof v0 === "object") {
				S[k] = {};
				for (const kk of Object.keys(v0)) {
					const w = v0[kk];
					if (typeof w === "number") S[k][kk] = med(xs.map((x) => x[k][kk]));
					else S[k][kk] = Object.fromEntries(Object.keys(w).map((z) => [z, med(xs.map((x) => x[k][kk][z]))]));
				}
			}
		}
	}
	console.log(JSON.stringify(summary, null, 1));
	fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify({ summary, runs: all }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
