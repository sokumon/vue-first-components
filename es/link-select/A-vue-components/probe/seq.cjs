// replays form_todo from select-pick to enter-on-action with traces
const { open, settle, wait_form } = require("../../harness/lib.cjs");
(async () => {
	const { browser, page, rec, base } = await open("v5");
	await page.goto(base + "/desk/todo/new");
	await wait_form(page, "ToDo");
	const F = (f) => `cur_frm.fields_dict.${f}`;
	const el = async (p) => (await page.evaluateHandle((p) => eval(p).input, p)).asElement();
	const search = async (p, text) => {
		if (await page.evaluate(() => __tw.listbox_open())) { await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(400); }
		await (await el(p)).click();
		await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace");
		if (text) await page.keyboard.type(text, { delay: 40 });
		await page.waitForTimeout(700); await settle(page, rec);
	};
	await (await el(F("status"))).selectOption({ label: "Closed" });
	await page.evaluate(() => cur_frm.set_value("reference_type", "User"));
	await page.waitForTimeout(500);
	await search(F("reference_name"), "Admin");
	await page.keyboard.press("Enter"); await page.waitForTimeout(800); await settle(page, rec);
	await page.evaluate(async () => { await cur_frm.fields_dict.allocated_to.set_value(""); });
	await search(F("allocated_to"), "adm");
	const log = [];
	for (let i = 0; i < 5; i++) {
		log.push(await page.evaluate(() => ({ rows: __tw.options(), active: __tw.active_option(), ae: document.activeElement.getAttribute("data-fieldname"), open: cur_frm.fields_dict.allocated_to.awesomplete.isOpened })));
		await page.keyboard.press("ArrowDown"); await page.waitForTimeout(60);
	}
	await page.screenshot({ path: __dirname + "/seq.png" });
	console.log(JSON.stringify({ log, errors: rec.errors }, null, 1));
	await browser.close();
})();
