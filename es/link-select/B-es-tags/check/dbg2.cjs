const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5"); const { page, rec } = s;
	page.on("console", (m) => console.log("console", m.type(), m.text().slice(0, 200)));
	await page.goto(s.base + "/desk/todo/new");
	await page.waitForFunction(() => window.cur_frm && cur_frm.doctype === "ToDo" && cur_frm.layout, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	await page.evaluate(() => {
		const h = cur_frm.fields_dict.priority._es_host;
		const c = h.esComponent; const inst = c.$;
		const orig = inst.emit; inst.emit = (...a) => { console.log("emit " + JSON.stringify(a.slice(0, 2))); return orig(...a); };
		const walk = (v, d) => { if (!v || d > 40) return; if (v.component) { const ci = v.component; if (ci.type.__name === "SelectRoot" || ci.type.name === "SelectRoot") { const o = ci.emit; ci.emit = (...a) => { console.log("root emit " + JSON.stringify(a.slice(0,2))); return o(...a); }; } walk(ci.subTree, d + 1); } if (Array.isArray(v.children)) v.children.forEach((c) => walk(c, d + 1)); };
		walk(inst.subTree, 0);
		document.addEventListener("select.select", (e) => console.log("selectevt " + e.defaultPrevented), true);
		console.log("props " + JSON.stringify(inst.props.modelValue) + " vnodeprops " + Object.keys(inst.vnode.props).join(","));
	});
	const trig = page.locator('[data-fieldname="priority"] es-select button[data-slot=trigger]').first();
	await trig.click(); await page.waitForTimeout(400);
	await page.locator('es-portal [role=option]:visible', { hasText: "High" }).first().click(); await page.waitForTimeout(500);
	console.log(await page.evaluate(() => cur_frm.fields_dict.priority._es_host.modelValue));
	await s.browser.close();
})();
