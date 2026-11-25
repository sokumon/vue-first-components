// Runs the differential flows on whatever mode the bench is in and writes
//   ../results/harness-<label>.json   (+ ../results/<label>/shots/*.png)
// Usage: node run.cjs <label> [flow ...]      flows: v5.form_todo v5.dialog ... erp.sales_invoice (default: all)
// Run under the bench lock: flock ../bench.lock node run.cjs legacy
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open, recorder } = require("./lib.cjs");
const FLOWS = require("./flows.cjs");

(async () => {
	const label = process.argv[2] || "run";
	const only = process.argv.slice(3);
	const outdir = path.join(__dirname, "..", "results", label);
	fs.mkdirSync(outdir, { recursive: true });
	const browser = await chromium.launch();
	const result = { label, started: new Date().toISOString(), meta: {}, flows: {} };
	try { result.meta.bench_mode = fs.readFileSync(process.env.HOME + "/fb/pwt/mode/current", "utf8").trim(); } catch {}
	for (const [site, flows] of Object.entries(FLOWS)) {
		for (const [name, fn] of Object.entries(flows)) {
			const key = `${site}.${name}`;
			if (only.length && !only.some((o) => key === o || site === o)) continue;
			const s = await open(site, { browser });
			const r = recorder(s.page, s.rec, key, outdir);
			const t0 = Date.now();
			let fatal = null;
			try {
				await fn({ page: s.page, rec: s.rec, r, base: s.base });
			} catch (e) {
				fatal = (e.message || String(e)).split("\n")[0].slice(0, 300);
			}
			if (!result.meta[site]) {
				result.meta[site] = await s.page.evaluate(() => ({
					vue: window.frappe?.Vue?.version ?? null,
					combobox_link: (() => { try { return !!frappe.ui.form.is_combobox_link_enabled?.(); } catch { return null; } })(),
					link_class: frappe.ui?.form?.ControlLink?.name ?? null,
					select_class: frappe.ui?.form?.ControlSelect?.name ?? null,
					lang: frappe.boot?.lang ?? null,
				})).catch(() => null);
			}
			result.flows[key] = { ms: Date.now() - t0, fatal, steps: r.steps, late_errors: s.rec.errors.slice(r.steps.reduce((n, st) => n + st.errors.length, 0)) };
			const bad = r.steps.filter((st) => st.obs && st.obs.error).length;
			console.log(`${key.padEnd(22)} ${String(r.steps.length).padStart(2)} steps  ${bad} step errors  ${s.rec.errors.length} console errors  ${Date.now() - t0}ms${fatal ? "  FATAL " + fatal : ""}`);
			await s.ctx.close();
		}
	}
	await browser.close();
	const file = path.join(__dirname, "..", "results", `harness-${label}.json`);
	fs.writeFileSync(file, JSON.stringify(result, null, 1));
	console.log("wrote", file);
})().catch((e) => { console.error(e); process.exit(1); });
