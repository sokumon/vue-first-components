// variant A checks the harness doesn't make: picking in frappe-ui's Select with the mouse and keyboard,
// the list's place (input/.. listbox), visuals, TableMultiSelect, awesomplete shim API.
const { open, settle, wait_form } = require("../../harness/lib.cjs");
const out = {};
(async () => {
	const { browser, page, rec, base } = await open("v5");
	const shot = (n) => page.screenshot({ path: __dirname + "/shots/" + n + ".png" });
	require("fs").mkdirSync(__dirname + "/shots", { recursive: true });
	try {
		await page.goto(base + "/desk/todo/new");
		await wait_form(page, "ToDo");
		await shot("todo-form");
		// Select: mouse
		const trig = page.locator('.frappe-control[data-fieldname=status] [data-slot="trigger"]').first();
		out.select_trigger_text = await trig.innerText();
		await trig.click();
		await page.waitForTimeout(400);
		await shot("select-open");
		out.select_rows = await page.evaluate(() => __tw.options());
		await page.locator('[role="option"]:visible', { hasText: "Closed" }).first().click();
		await page.waitForTimeout(500);
		out.select_after_mouse = await page.evaluate(() => ({ doc: cur_frm.doc.status, native: cur_frm.fields_dict.status.$input.val(), shown: document.querySelector('.frappe-control[data-fieldname=status] [data-slot="trigger"]').innerText, dirty: cur_frm.is_dirty() }));
		// Select: keyboard
		await trig.focus();
		await page.keyboard.press("Enter");
		await page.waitForTimeout(300);
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(400);
		out.select_after_keys = await page.evaluate(() => cur_frm.doc.status);
		// set_focus goes to the trigger
		out.set_focus = await page.evaluate(() => { cur_frm.fields_dict.priority.set_focus(); return document.activeElement.closest(".frappe-control")?.dataset.fieldname + ":" + document.activeElement.tagName; });
		// Link list placement + shim
		const inp = (await page.evaluateHandle(() => cur_frm.fields_dict.allocated_to.input)).asElement();
		await inp.click();
		await page.waitForTimeout(1500);
		await shot("link-open");
		out.link = await page.evaluate(() => {
			const c = cur_frm.fields_dict.allocated_to, aw = c.awesomplete, lb = c.input.parentElement.querySelector('[role="listbox"]');
			return { listbox_near_input: !!lb, ul_is_listbox: aw.ul === lb, isOpened: aw.isOpened, list_len: aw.list.length, aria: c.input.getAttribute("aria-expanded"), in_awesomplete: !!c.input.closest(".awesomplete"), z: getComputedStyle(lb.closest("[data-reka-popper-content-wrapper]") || lb).zIndex };
		});
		await page.evaluate(() => cur_frm.fields_dict.allocated_to.awesomplete.close());
		await page.waitForTimeout(300);
		out.link_after_close = await page.evaluate(() => ({ open: __tw.listbox_open(), isOpened: cur_frm.fields_dict.allocated_to.awesomplete.isOpened, ac: cur_frm.fields_dict.allocated_to.autocomplete_open }));
		// read-only
		await page.evaluate(() => { cur_frm.set_value("allocated_to", "Administrator"); });
		await page.waitForTimeout(600);
		await shot("link-value");
		// dialog with link + select + table multiselect
		await page.evaluate(() => {
			window.__d = new frappe.ui.Dialog({ title: "TW", fields: [
				{ fieldname: "u", fieldtype: "Link", options: "User", label: "User" },
				{ fieldname: "s", fieldtype: "Select", options: ["", "A", "B"], label: "Kind", placeholder: "Pick" },
				{ fieldname: "roles", fieldtype: "Table MultiSelect", options: "Has Role", label: "Roles" },
			] });
			__d.show();
		});
		await page.waitForTimeout(800);
		const di = (await page.evaluateHandle(() => __d.fields_dict.u.input)).asElement();
		await di.click();
		await page.waitForTimeout(1500);
		await shot("dialog-link-open");
		out.dialog_list_visible_top = await page.evaluate(() => { const lb = __d.fields_dict.u.input.parentElement.querySelector('[role="listbox"]'); if (!lb) return null; const r = lb.getBoundingClientRect(); const e = document.elementFromPoint(r.left + 10, r.top + 10); return lb.contains(e); });
		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);
		const ti = (await page.evaluateHandle(() => __d.fields_dict.roles.input)).asElement();
		await ti.click();
		await page.keyboard.type("Sys", { delay: 40 });
		await page.waitForTimeout(1500);
		await page.keyboard.press("Enter");
		await page.waitForTimeout(1200);
		await shot("dialog-tms");
		out.tms = await page.evaluate(() => __d.get_value("roles"));
		out.dialog_open = await page.evaluate(() => __d.display);
	} catch (e) { out.error = e.message.split("\n")[0]; }
	out.errors = rec.errors;
	console.log(JSON.stringify(out, null, 1));
	await browser.close();
})();
