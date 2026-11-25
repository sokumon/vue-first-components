const { open } = require("../../harness/lib.cjs");
(async () => {
	const s = await open("v5"); const { page } = s;
	page.on("console", (m) => /dbg/.test(m.text()) && console.log(m.text().slice(0, 400)));
	await page.goto(s.base + "/desk/todo");
	await page.waitForTimeout(3000);
	const variants = { mv: { modelValue: "b" }, dis: { opts: true }, form: { form: true }, ph: { placeholder: " " } };
	for (const [name, v] of Object.entries(variants)) {
		await page.evaluate(([name, v]) => {
			const h = document.createElement("es-select"); h.id = "p_" + name;
			h.options = [{ label: "a", value: "a", ...(v.opts ? { disabled: false } : {}) }, { label: "b", value: "b", ...(v.opts ? { disabled: false } : {}) }, { label: "c", value: "c" }];
			if (v.modelValue) h.modelValue = v.modelValue; if (v.placeholder) h.placeholder = v.placeholder;
			h.addEventListener("update:modelValue", (e) => console.log("dbg " + name + " " + e.detail));
			const box = v.form ? $("<form>").prependTo(document.body)[0] : document.body; box.prepend(h);
		}, [name, v]);
		await page.waitForTimeout(300);
		await page.locator("#p_" + name + " button").click(); await page.waitForTimeout(400);
		await page.locator('es-portal [role=option]:visible', { hasText: "c" }).first().click(); await page.waitForTimeout(500);
		console.log("dbg done " + name);
	}
	await s.browser.close();
})();
