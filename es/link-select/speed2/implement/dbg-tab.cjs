const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5");
	const { page } = s;
	for (const f of (process.env.FLAGS || "").split(",").filter(Boolean)) await s.ctx.addInitScript((f) => { window["__es_" + f] = true; }, f);
	page.on("console", (m) => /^DBG/.test(m.text()) && console.log(m.text()));
	await page.goto(s.base + "/desk/todo/new");
	await page.waitForFunction(() => window.cur_frm && cur_frm.doctype === "ToDo" && cur_frm.layout, null, { timeout: 60000 });
	await page.waitForTimeout(800);
	await page.evaluate(() => {
		const f = cur_frm.fields_dict.allocated_to;
		const inp = f.input;
		for (const ev of ["awesomplete-open", "awesomplete-close", "awesomplete-select", "awesomplete-selectcomplete", "keydown", "blur", "focus"])
			inp.addEventListener(ev, (e) => console.log("DBG", ev, e.key || "", JSON.stringify(e.text || ""), f._es_open, document.querySelector("[data-highlighted]")?.textContent?.trim().slice(0, 30)), true);
	});
	await page.locator('[data-fieldname="allocated_to"] input').first().click(); await page.keyboard.type("Admin", { delay: 30 }); await page.waitForTimeout(1300);
	console.log(await page.evaluate(() => "DBG before tab: open=" + cur_frm.fields_dict.allocated_to._es_open + " hl=" + document.querySelector("[data-highlighted]")?.textContent + " opts=" + document.querySelectorAll("[role=option]").length));
	await page.keyboard.press("Tab"); await page.waitForTimeout(1200);
	console.log("DBG result", await page.evaluate(() => cur_frm.doc.allocated_to));
	await s.ctx.close(); process.exit(0);
})();
