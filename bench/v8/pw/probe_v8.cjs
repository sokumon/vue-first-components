// Real-desk probe for the v5 design: Chromium, real Frappe desk, real frappe-ui components.
const { open } = require("./session.cjs");
const noise = (e) => /socket\.io/.test(e);
(async () => {
	const { browser, page, errors, base } = await open();
	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => window.frappe?.app?.sidebar && frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1500);

	// --- A: browser/probe_browser.cjs, unchanged except the route
	const a = await page.evaluate(async () => {
		const r = {};
		const c = (name, ok) => (r[name] = ok);
		c("app exists, one root", !!frappe.ui.app && !!frappe.ui.app._container && document.querySelectorAll("#fui-overlays").length === 1);
		c("legacy sidebar still there", !!document.querySelector(".body-sidebar"));
		c("legacy page still there", !!frappe.get_current_page()?.wrapper?.length);
		const Probe = frappe.ui.VueProbe;
		c("class emitted by the build", typeof Probe === "function" && Probe.name === "VueProbe");
		c("methods on prototype at load", Object.hasOwn(Probe.prototype, "add"));
		const host = $('<div id="probe-host">').prependTo(frappe.get_current_page().main);
		const probe = new Probe({ parent: host });
		const $root = () => host.find(".vue-probe");
		c("drawn synchronously", $root().find(".numbers").text() === "0|0|Save");
		c("wrapper field", probe.wrapper.is(".vue-probe"));
		probe.bump(); probe.flush();
		c("method + setup ref + computed + flush", $root().find(".numbers").text() === "1|2|Save");
		let clicked = 0;
		const $b = probe.add_button("Go", () => clicked++);
		c("returned real button", $b.length === 1 && $b.is("button"));
		$b.addClass("btn-primary"); probe.count = 5; probe.flush();
		c("caller class survives", $b.hasClass("btn-primary"));
		$b.trigger("click");
		c("jQuery trigger reaches handler", clicked === 1);
		$root().find(".filled").html("<b>legacy</b>"); probe.count = 6; probe.flush();
		c("jQuery fill survives", $root().find(".filled b").length === 1);
		const { add } = Probe.prototype;
		Probe.prototype.add = function (by) { add.call(this, by * 10); };
		$root()[0].click();
		await new Promise((f) => setTimeout(f, 50));
		c("real click, prototype patch, async update", $root().find(".numbers").text() === "16|32|Save");
		Probe.prototype.add = add;
		class Sub extends Probe { bump() { super.bump(); super.bump(); } }
		const s = new Sub({ parent: host }); s.bump();
		c("app subclass with super", s.count === 2 && s instanceof Probe);
		s.destroy(); probe.destroy();
		await new Promise((f) => setTimeout(f, 0));
		c("destroy removes the views", host.find(".vue-probe").length === 0);
		host.remove();
		return r;
	});

	// --- B: real frappe-ui Button + Dropdown inside an emitted class, driven by real input
	const b = {};
	await page.evaluate(() => {
		const host = $('<div id="fui-host" style="padding:20px">').prependTo(frappe.get_current_page().main);
		window.fp = new frappe.ui.FuiProbe({ parent: host });
	});
	const q = (fn) => page.evaluate(fn);
	b["Button renders as frappe-ui"] = await q(() => { const el = document.querySelector("#fui-host .fui-btn"); return !!el && el.tagName === "BUTTON" && /inline-flex/.test(el.className) && el.textContent.trim() === "Save"; });
	await page.click("#fui-host .fui-btn");
	await page.waitForTimeout(50);
	b["real click on Button reaches template handler"] = await q(() => document.querySelector("#fui-host .clicks").textContent === "1");
	b["caller class on Button survives a re-render"] = await q(() => {
		$("#fui-host .fui-btn").addClass("from-caller"); fp.set_label("Submit"); fp.flush();
		const el = document.querySelector("#fui-host .fui-btn");
		return el.classList.contains("from-caller") && el.textContent.trim() === "Submit";
	});
	b["jQuery .trigger reaches frappe-ui's own listener"] = await q(async () => {
		$("#fui-host .fui-btn").trigger("click"); await new Promise((f) => setTimeout(f, 20));
		return document.querySelector("#fui-host .clicks").textContent === "2";
	});
	await page.click("#fui-host .fui-dd-trigger");
	await page.waitForTimeout(300);
	b["Dropdown opens on real click"] = await q(() => document.querySelectorAll('[role="menuitem"]').length === 2);
	b["menu portals out of the class's host"] = await q(() => { const m = document.querySelector('[role="menu"]'); return !!m && !document.querySelector("#fui-host").contains(m); });
	b["focus moves into the menu"] = await q(() => !!document.activeElement?.closest('[role="menu"]'));
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("ArrowDown");
	b["arrow keys move focus between items"] = await q(() => document.activeElement?.getAttribute("role") === "menuitem" && document.activeElement.textContent.trim() === "Beta");
	await page.keyboard.press("Enter");
	await page.waitForTimeout(300);
	b["Enter selects into a <script setup> ref"] = await q(() => document.querySelector("#fui-host .picked").textContent === "Beta" && !document.querySelector('[role="menu"]'));
	b["focus returns to the trigger after select"] = await q(() => document.activeElement?.classList.contains("fui-dd-trigger"));
	await page.click("#fui-host .fui-dd-trigger");
	await page.waitForTimeout(300);
	await page.keyboard.press("Escape");
	await page.waitForTimeout(300);
	b["Escape closes and restores focus"] = await q(() => !document.querySelector('[role="menu"]') && document.activeElement?.classList.contains("fui-dd-trigger"));
	await page.click("#fui-host .fui-dd-trigger");
	await page.waitForTimeout(300);
	b["re-render while open keeps menu and focus"] = await q(() => {
		const before = document.activeElement;
		fp.set_label("Again"); fp.flush();
		return document.querySelectorAll('[role="menuitem"]').length === 2 && document.activeElement === before && !!before?.closest('[role="menu"]');
	});
	await page.mouse.click(1200, 700);
	await page.waitForTimeout(300);
	b["outside click closes"] = await q(() => !document.querySelector('[role="menu"]'));

	// --- C: flush() with a real <Transition> and focus
	const c = await page.evaluate(async () => {
		const r = {};
		const wait = (ms) => new Promise((f) => setTimeout(f, ms));
		const box = () => document.querySelector("#fui-host .fq-box");
		const tick = () => Promise.resolve();
		fp.toggle(); fp.flush();
		r["enter: element exists right after flush (sync)"] = !!box();
		await tick();
		r["enter: element exists after one microtask"] = !!box();
		r["enter: transition classes applied"] = !!box() && box().classList.contains("fq-enter-active");
		box().querySelector("input").focus();
		r["focus into the entered element"] = document.activeElement?.classList.contains("fq-input");
		await wait(400);
		r["enter classes removed after transitionend"] = !!box() && !box().classList.contains("fq-enter-active") && !box().classList.contains("fq-enter-to");
		fp.set_label("Typing"); fp.flush();
		r["re-render keeps focus on the input"] = document.activeElement?.classList.contains("fq-input");
		fp.toggle(); fp.flush(); await tick();
		r["leave: element still there, leaving"] = !!box() && box().classList.contains("fq-leave-active");
		await wait(450);
		r["leave: removed after transitionend"] = !box();
		fp.toggle(); fp.flush(); await tick(); fp.toggle(); fp.flush(); await tick(); fp.toggle(); fp.flush(); await tick();
		await wait(450);
		r["rapid toggles settle to one element"] = document.querySelectorAll("#fui-host .fq-box").length === 1;
		document.querySelector("#fui-host .fui-input").focus();
		fp.set_label("X"); fp.flush();
		r["focused plain input survives flush"] = document.activeElement?.classList.contains("fui-input");
		fp.destroy();
		await wait(50);
		r["destroy removes the frappe-ui view"] = !document.querySelector("#fui-host .fui-probe");
		document.querySelector("#fui-host").remove();
		return r;
	});

	// --- D: the desk still works around it
	await page.goto(base + "/desk/user/Administrator", { waitUntil: "load" });
	await page.waitForFunction(() => window.cur_frm?.doc?.name === "Administrator", null, { timeout: 30000 }).catch(() => {});
	const d = { "form opens with v5 loaded": await q(() => window.cur_frm?.doc?.name === "Administrator") };
	await page.goto(base + "/desk/role", { waitUntil: "load" });
	await page.waitForTimeout(1500);
	d["list route after form"] = await q(() => frappe.get_route().join("/") === "List/Role/List" && document.querySelectorAll("#fui-overlays").length === 1);

	let pass = 0, total = 0;
	for (const [name, block] of Object.entries({ "A. probe_browser checks": a, "B. frappe-ui in a class": b, "C. flush, transitions, focus": c, "D. desk": d })) {
		console.log("\n" + name);
		for (const [k, v] of Object.entries(block)) { total++; if (v === true) pass++; console.log(`  ${v === true ? "PASS" : "FAIL"}  ${k}${v === true ? "" : "  -> " + JSON.stringify(v)}`); }
	}
	console.log(`\n${pass}/${total} passed`);
	const real = errors.filter((e) => !noise(e));
	console.log("console errors and Vue warnings:", real.length ? real : "none");
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
