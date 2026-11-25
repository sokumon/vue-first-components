// speed2/implement/cssv.cjs <label> : CSS variants swapped in-page (link disabled + <style> with the file's text),
// legacy controls by default (CTL=es for es controls). Variants: off | <name> = cssvar/<name>.css.
// env DTS, VARIANTS, ROUNDS (3), REOPEN (4), CTL (legacy). Run inside session.sh.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
const OUT = path.join(__dirname, "out");
const DTS = (process.env.DTS || "Sales Order,Delivery Note,Stock Entry,ToDo").split(",");
const VARIANTS = (process.env.VARIANTS || "base,off,nest,where,tag,scope").split(",");
const ROUNDS = +(process.env.ROUNDS || 3), REOPEN = +(process.env.REOPEN || 4);
const CTL = process.env.CTL || "legacy";
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(1); };
const texts = {};
for (const v of VARIANTS) if (v !== "off") texts[v] = fs.readFileSync(path.join(__dirname, "cssvar", v + ".css"), "utf8");

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
		await new Promise((res) => { const c = () => (ready() ? res() : setTimeout(c, 2)); c(); });
		const tr = performance.now() - t;
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		return { ready: tr, painted: performance.now() - t };
	}, dt);
}

(async () => {
	const label = process.argv[2] || "cssv";
	const browser = await chromium.launch();
	const all = [];
	for (let r = 0; r < ROUNDS; r++)
		for (const dt of DTS)
			for (let vi = 0; vi < VARIANTS.length; vi++) {
				const v = VARIANTS[(vi + r) % VARIANTS.length];
				const s = await open(dt === "ToDo" ? "v5" : "erp", { browser });
				const { page } = s;
				if (CTL === "legacy") await s.ctx.addInitScript(() => { window.__es_link_off = true; });
				await page.goto(s.base + "/desk/todo");
				await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
				await page.evaluate(([v, txt]) => {
					const link = [...document.querySelectorAll("link[rel=stylesheet]")].find((l) => /es_link/.test(l.href));
					if (v === "base" && !txt) return;
					link.disabled = true;
					if (txt) { const st = document.createElement("style"); st.textContent = txt; link.after(st); }
				}, [v, texts[v] || ""]);
				await page.waitForTimeout(2000);
				const first = await timed_open(page, dt);
				const xs = [];
				for (let i = 0; i < REOPEN; i++) {
					await page.evaluate(() => frappe.set_route("List", "ToDo"));
					await page.waitForTimeout(600);
					xs.push(await timed_open(page, dt));
				}
				const x = { r, dt, v, first_ready: first.ready, first_painted: first.painted, reopen_ready: med(xs.map((q) => q.ready)), reopen_painted: med(xs.map((q) => q.painted)), errors: s.rec.errors.slice(0, 3) };
				all.push(x);
				console.log(JSON.stringify(x));
				await s.ctx.close();
			}
	await browser.close();
	for (const dt of DTS) for (const v of VARIANTS) {
		const xs = all.filter((x) => x.dt === dt && x.v === v);
		console.log(dt.padEnd(14), v.padEnd(8), ["first_ready", "first_painted", "reopen_ready", "reopen_painted"].map((k) => `${k} ${med(xs.map((x) => x[k]))} [${Math.round(Math.min(...xs.map((x) => x[k])))}-${Math.round(Math.max(...xs.map((x) => x[k])))}]`).join("  "));
	}
	fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(all, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
