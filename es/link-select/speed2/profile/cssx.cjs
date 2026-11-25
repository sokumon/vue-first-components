// speed2/profile/cssx.cjs <label> : which part of es_link.bundle.css slows Desk's style recalc? Legacy controls
// (window.__es_link_off) so only the CSS differs; variants delete rule groups from the loaded sheet via CSSOM
// before the form opens. Form first open + re-open medians, ROUNDS rounds, variants rotated per round.
// env DTS (Sales Order,ToDo), VARIANTS, ROUNDS (3), REOPEN (4)
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
const OUT = path.join(__dirname, "out");
const DTS = (process.env.DTS || "Sales Order,ToDo").split(",");
const VARIANTS = (process.env.VARIANTS || "full,off,no-root-vars,no-universal,no-scoped,only-universal").split(",");
const ROUNDS = +(process.env.ROUNDS || 3), REOPEN = +(process.env.REOPEN || 4);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(1); };

function applyVariant(v) {
	const link = [...document.querySelectorAll("link[rel=stylesheet]")].find((l) => /es_link/.test(l.href));
	const sheet = link.sheet;
	const info = { top: sheet.cssRules.length, deleted: 0 };
	if (v === "full") return info;
	if (v === "off") { link.disabled = true; return info; }
	const isRoot = (r) => r.selectorText && /^(:root|\[data-theme=dark\])$/.test(r.selectorText.trim());
	const isScope = (r) => r.selectorText && r.selectorText.startsWith(":where(es-combobox");
	const univ = (sel) => /(^|[\s,>~+(&])\*|::/.test(sel);
	// walk a grouping rule list (sheet or @media) and delete per variant
	const walk = (list, owner) => {
		for (let i = list.length - 1; i >= 0; i--) {
			const r = list[i];
			if (r.cssRules && !r.selectorText) { walk(r.cssRules, r); continue; } // @media / @supports
			let del = false;
			if (v === "no-root-vars") del = isRoot(r);
			else if (v === "no-scoped") del = isScope(r);
			else if ((v === "no-universal" || v === "only-universal") && isScope(r)) {
				// nested rules inside the :where(...) wrapper
				for (let j = r.cssRules.length - 1; j >= 0; j--) {
					const u = univ(r.cssRules[j].selectorText || "");
					if ((v === "no-universal" && u) || (v === "only-universal" && !u)) { r.deleteRule(j); info.deleted++; }
				}
			}
			if ((v === "no-star" || v === "no-prose" || v === "no-placeholder") && isScope(r)) {
				const re = v === "no-star" ? /^&\s*(\*|::before|::after|::backdrop)/ : v === "no-prose" ? /\.prose/ : /::placeholder|::-webkit|::file-selector/;
				for (let j = r.cssRules.length - 1; j >= 0; j--) if (re.test((r.cssRules[j].selectorText || "").trim())) { r.deleteRule(j); info.deleted++; }
			}
			if (del) { owner.deleteRule(i); info.deleted++; }
		}
	};
	walk(sheet.cssRules, sheet);
	return info;
}

async function timed_open(page, dt) {
	return page.evaluate(async (dt) => {
		const t = performance.now();
		frappe.set_route("Form", dt, frappe.model.make_new_doc_and_get_name(dt));
		await new Promise((res) => { const c = () => (window.cur_frm?.doctype === dt && cur_frm.layout?.wrapper?.is(":visible") ? res() : setTimeout(c, 2)); c(); });
		const ready = performance.now() - t;
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		return { ready, painted: performance.now() - t };
	}, dt);
}

(async () => {
	const label = process.argv[2] || "cssx";
	const browser = await chromium.launch();
	const all = [];
	for (let r = 0; r < ROUNDS; r++)
		for (const dt of DTS)
			for (let vi = 0; vi < VARIANTS.length; vi++) {
				const v = VARIANTS[(vi + r) % VARIANTS.length];
				const s = await open(dt === "ToDo" ? "v5" : "erp", { browser });
				const { page } = s;
				await s.ctx.addInitScript(() => { window.__es_link_off = true; });
				await page.goto(s.base + "/desk/todo");
				await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
				const info = await page.evaluate(applyVariant, v);
				await page.waitForTimeout(2000);
				const first = await timed_open(page, dt);
				const xs = [];
				for (let i = 0; i < REOPEN; i++) {
					await page.evaluate(() => frappe.set_route("List", "ToDo"));
					await page.waitForTimeout(600);
					xs.push(await timed_open(page, dt));
				}
				const x = { r, dt, v, info, first_ready: first.ready, first_painted: first.painted, reopen_ready: med(xs.map((q) => q.ready)), reopen_painted: med(xs.map((q) => q.painted)) };
				all.push(x);
				console.log(JSON.stringify(x));
				await s.ctx.close();
			}
	await browser.close();
	for (const dt of DTS) for (const v of VARIANTS) {
		const xs = all.filter((x) => x.dt === dt && x.v === v);
		console.log(dt.padEnd(12), v.padEnd(15), ["first_ready", "first_painted", "reopen_ready", "reopen_painted"].map((k) => `${k} ${med(xs.map((x) => x[k]))}`).join("  "), "deleted", xs[0].info.deleted);
	}
	fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(all, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
