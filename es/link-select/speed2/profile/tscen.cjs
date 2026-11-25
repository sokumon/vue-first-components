// speed2/profile/tscen.cjs <label> : Chrome trace + CPU profile of single synthetic scenarios (one warm-up
// iteration, then one traced), es and legacy alternating, ROUNDS fresh pages. Writes
// out/<label>-<scen>-<mode>-r<n>-first.trace.json (read by trace.cjs <label>) and .cpuprofile (cmp.cjs).
// env SCENS (comma list), ROUNDS (3), CSSOFF=1 disables es_link.bundle.css in the page.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
const OUT = path.join(__dirname, "out");
const ROUNDS = +(process.env.ROUNDS || 3);
const CATS = ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8.execute", "blink.user_timing", "disabled-by-default-v8.gc"];
const SC = {
	inputs100: { modes: ["es"], fn: async () => { const p = $("<div>").appendTo(".page-body:visible")[0]; for (let i = 0; i < 100; i++) { const d = document.createElement("div"); d.className = "form-group"; d.innerHTML = '<input class="form-control" type="text">'; p.appendChild(d); } return p; } },
	noop100: { modes: ["es"], fn: async () => { const V = ES.Vue; if (!customElements.get("es-noop")) ES.defineEs("es-noop", V.defineComponent({ props: { value: String }, render() { return V.h("input", { value: this.value }); } })); const p = $("<div>").appendTo(".page-body:visible")[0]; for (let i = 0; i < 100; i++) { const h = document.createElement("es-noop"); p.appendChild(h); ES.flush(); } return p; } },
	plainselect100: { modes: ["es"], fn: async () => { const V = ES.Vue, C = ES.def("es-select").comp; const p = $("<div>").appendTo(".page-body:visible")[0]; V.createApp({ render: () => Array.from({ length: 100 }, (_, i) => V.h(C, { key: i, options: [{ label: "a", value: "a" }, { label: "b", value: "b" }, { label: "c", value: "c" }], modelValue: "a", placeholder: " " })) }).mount(p); return p; } },
	plaincombo100: { modes: ["es"], fn: async () => { const V = ES.Vue, C = ES.def("es-combobox").comp; const p = $("<div>").appendTo(".page-body:visible")[0]; V.createApp({ render: () => Array.from({ length: 100 }, (_, i) => V.h(C, { key: i, options: [], modelValue: null, query: "", open: false, filterable: false, openOnFocus: false, openOnClick: false, placeholder: "" })) }).mount(p); return p; } },
	make100link: { fn: async () => { const $p = $("<div>").appendTo(".page-body:visible"); for (let i = 0; i < 100; i++) frappe.ui.form.make_control({ df: { fieldtype: "Link", fieldname: "f" + i, label: "F" + i, options: "User" }, parent: $p, render_input: true }); return $p[0]; } },
	make100select: { fn: async () => { const $p = $("<div>").appendTo(".page-body:visible"); for (let i = 0; i < 100; i++) frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "f" + i, label: "F" + i, options: "a\nb\nc" }, parent: $p, render_input: true }); return $p[0]; } },
	setinput100: {
		setup: async () => { const $p = $("<div>").appendTo(".page-body:visible"); window.__ls = Array.from({ length: 100 }, (_, i) => frappe.ui.form.make_control({ df: { fieldtype: "Select", fieldname: "q" + i, label: "Q" + i, options: "a\nb\nc" }, parent: $p, render_input: true })); window.__lsp = $p[0]; window.__k = (window.__k || 0) + 1; },
		fn: async () => { const k = ++window.__k; __ls.forEach((c, i) => c.set_input(["a", "b", "c"][(i + k) % 3])); return null; },
		cleanup: () => { __lsp.remove(); },
	},
	dialog50: { fn: async () => { const d = new frappe.ui.Dialog({ title: "perf", fields: [...Array.from({ length: 40 }, (_, i) => ({ fieldname: "l" + i, fieldtype: "Link", options: "User", label: "L" + i })), ...Array.from({ length: 10 }, (_, i) => ({ fieldname: "s" + i, fieldtype: "Select", options: "a\nb", label: "S" + i }))] }); d.show(); window.__d = d; return null; }, after: () => { __d.hide(); __d.$wrapper.remove(); } },
};

(async () => {
	const label = process.argv[2] || "ts";
	const names = (process.env.SCENS || Object.keys(SC).join(",")).split(",");
	const browser = await chromium.launch();
	const out = [];
	for (let r = 0; r < ROUNDS; r++)
		for (const name of names) {
			const sc = SC[name];
			const modes = sc.modes || (r % 2 ? ["legacy", "es"] : ["es", "legacy"]);
			for (const mode of modes) {
				const s = await open("v5", { browser });
				const { page } = s;
				if (mode === "legacy") await s.ctx.addInitScript(() => { window.__es_link_off = true; });
				await page.goto(s.base + "/desk/todo");
				await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
				await page.waitForTimeout(2000);
				if (process.env.CSSOFF) await page.evaluate(() => { for (const l of document.querySelectorAll('link[rel=stylesheet]')) if (/es_link/.test(l.href)) l.disabled = true; });
				const cdp = await page.context().newCDPSession(page);
				await cdp.send("Profiler.enable");
				await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
				const go = (fn, after) => page.evaluate(async ([f, a]) => {
					const raf2 = () => new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x)));
					await raf2();
					const t = performance.now();
					const el = await (0, eval)("(" + f + ")")();
					const js = performance.now() - t;
					await raf2();
					const painted = performance.now() - t;
					window.__el = el; window.__after = a;
					return { js: +js.toFixed(1), painted: +painted.toFixed(1) };
				}, [fn.toString(), after ? after.toString() : null]);
				if (sc.setup) await page.evaluate(sc.setup);
				const clean = () => page.evaluate(async () => { if (window.__el && __el.remove) __el.remove(); if (window.__after) (0, eval)("(" + __after + ")")(); await new Promise((x) => requestAnimationFrame(() => requestAnimationFrame(x))); });
				await go(sc.fn, sc.after); // warm-up
				await clean();
				await page.waitForTimeout(300);
				const base = `${label}-${name}-${mode}-r${r}`;
				await cdp.send("Profiler.start");
				await browser.startTracing(page, { path: path.join(OUT, base + "-first.trace.json"), categories: CATS });
				const t = await go(sc.fn, sc.after);
				await browser.stopTracing();
				await clean();
				fs.writeFileSync(path.join(OUT, base + "-first.cpuprofile"), JSON.stringify((await cdp.send("Profiler.stop")).profile));
				if (sc.cleanup) await page.evaluate(sc.cleanup);
				out.push({ name, mode, r, ...t });
				console.log(r, name, mode, JSON.stringify(t), s.rec.errors.slice(0, 2));
				await s.ctx.close();
			}
		}
	await browser.close();
	fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
