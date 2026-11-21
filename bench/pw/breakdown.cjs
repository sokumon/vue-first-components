// Where a Data control's creation time goes: wraps each phase method on the prototype chain and
// sums its own time (time inside it minus time inside other wrapped phases). Legacy or v5.
const { open } = require("./session.cjs");
(async () => {
	const { browser, page, base } = await open();
	await page.goto(base + "/desk/todo", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(4000);
	await page.evaluate((m) => (window.__MODE = m), process.env.MODE || "create");
	console.log(await page.evaluate(() => {
		const kind = frappe.ui.form.Control.view ? "v5" : "legacy";
		const phases = ["make", "make_wrapper", "set_input_areas", "set_max_width", "refresh", "get_status", "refresh_input", "make_input", "set_input_attributes", "bind_change_event", "setup_autoname_check", "setup_copy_button", "set_input", "set_formatted_input", "set_disp_area", "set_description", "set_label", "set_doc_url", "set_mandatory", "set_bold", "set_required", "flush"];
		const self = {}, stack = [];
		const restore = [];
		const protos = [];
		for (let p = frappe.ui.form.ControlData.prototype; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) protos.push(p);
		for (const name of phases) {
			const owner = protos.find((p) => Object.hasOwn(p, name));
			if (!owner) continue;
			const fn = owner[name];
			restore.push(() => (owner[name] = fn));
			owner[name] = function (...a) {
				const t0 = performance.now();
				stack.push(0);
				try { return fn.apply(this, a); } finally {
					const child = stack.pop();
					const dt = performance.now() - t0;
					self[name] = (self[name] || 0) + dt - child;
					if (stack.length) stack[stack.length - 1] += dt;
				}
			};
		}
		const parent = $("<div>").appendTo(document.body);
		const make = (n) => { for (let i = 0; i < n; i++) frappe.ui.form.make_control({ df: { fieldtype: "Data", fieldname: "f" + i, label: "F" + i }, parent, render_input: true }); };
		make(300); parent.empty();
		for (const k of Object.keys(self)) delete self[k];
		const runs = 5, n = 500;
		let total = 0;
		const MODE = window.__MODE;
		if (MODE === "refresh") {
			parent.empty();
			const ctls = []; for (let i = 0; i < n; i++) ctls.push(frappe.ui.form.make_control({ df: { fieldtype: "Data", fieldname: "f" + i, label: "F" + i }, parent, render_input: true }));
			for (const k of Object.keys(self)) delete self[k];
			for (let r = 0; r < runs; r++) { const t = performance.now(); ctls.forEach((c) => c.refresh()); total += performance.now() - t; }
		} else for (let r = 0; r < runs; r++) { parent.empty(); const t = performance.now(); make(n); total += performance.now() - t; }
		restore.forEach((f) => f());
		parent.remove();
		const per = (ms) => +((ms / runs / n) * 1000).toFixed(1); // microseconds per control
		const rows = Object.entries(self).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${String(per(v)).padStart(6)} us  ${k}`);
		const accounted = Object.values(self).reduce((a, b) => a + b, 0);
		return `${kind}: ${per(total)} us per Data control (${window.__MODE}); outside these phases (constructor, Vue mount, $.extend, tooltip): ${per(total - accounted)} us\n` + rows.join("\n");
	}));
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
