const { open } = require("../../harness/lib.cjs");
(async () => {
	const { browser, page, rec, base } = await open("v5");
	await page.goto(base + "/desk/todo/new");
	await page.waitForFunction(() => window.cur_frm && cur_frm.doctype === "ToDo");
	await page.waitForTimeout(800);
	const inp = (await page.evaluateHandle(() => cur_frm.fields_dict.allocated_to.input)).asElement();
	await inp.click();
	await page.keyboard.type("adm", { delay: 40 });
	await page.waitForTimeout(1200);
	const log = [];
	for (let i = 0; i < 4; i++) {
		log.push(await page.evaluate(() => ({ rows: __tw.options(), active: __tw.active_option(), hl: [...document.querySelectorAll("[data-highlighted]")].map((e) => e.textContent.trim()), ae: document.activeElement.tagName + "." + document.activeElement.className.slice(0, 40) })));
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(150);
	}
	console.log(JSON.stringify({ log, errors: rec.errors }, null, 1));
	await page.screenshot({ path: __dirname + "/arrows.png" });
	await browser.close();
})();
