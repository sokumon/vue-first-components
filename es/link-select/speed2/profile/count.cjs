// speed2/profile/count.cjs : component instances, DOM nodes and effects under one Link / one Select host
const { chromium } = require("playwright");
const { open } = require("../../harness/lib.cjs");
(async () => {
	const browser = await chromium.launch();
	const s = await open("v5", { browser });
	await s.page.goto(s.base + "/desk/todo");
	await s.page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 60000 });
	await s.page.waitForTimeout(1500);
	const r = await s.page.evaluate(async () => {
		const out = {};
		const $p = $("<div>").appendTo(".page-body:visible");
		window.__es_lazy_off = true;
		for (const ft of ["Link", "Select"]) {
			const c = frappe.ui.form.make_control({ df: { fieldtype: ft, fieldname: "x" + ft, label: "X", options: ft === "Select" ? "a\nb\nc" : "User" }, parent: $p, render_input: true });
			await new Promise((x) => setTimeout(x, 50));
			const node = c._es_host._es.node;
			const names = {}; let n = 0, effects = 0;
			const walk = (v) => { if (!v) return; if (v.component) { n++; const nm = v.component.type.name || v.component.type.__name || "?"; names[nm] = (names[nm] || 0) + 1; effects += (v.component.scope?.effects?.length || 0); walk(v.component.subTree); return; } if (Array.isArray(v.children)) v.children.forEach((ch) => ch && typeof ch === "object" && walk(ch)); if (v.dynamicChildren) {} };
			walk(node.subTree);
			out[ft] = { components: n, effects, dom_in_wrapper: c.$wrapper[0].getElementsByTagName("*").length, by_name: names };
		}
		window.__es_lazy_off = false;
		return out;
	});
	console.log(JSON.stringify(r, null, 1));
	await browser.close();
})();
