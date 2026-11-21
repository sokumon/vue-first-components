// Real-desk regression checks for round four of the adversarial review of the issue #1 fixes.
const { open } = require("./session.cjs");
(async () => {
	const { browser, page, errors, base } = await open();
	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1500);
	const q = (fn, arg) => page.evaluate(fn, arg);
	const r = {};

	await q(() => {
		const { h, ref, watch, onMounted } = window.__vue_first.Vue;
		const d = (name, o) => frappe.ui.define({ name: "frappe.ui.U" + name, ...o });
		window.U = {
			LatePicker: d("LatePicker", {
				data: () => ({ items: ["a", "b", "c"], index: 2 }),
				setup(self) { onMounted(() => watch(() => self.items, (items) => { if (self.index >= items.length) self.index = 0; })); return {}; },
				render: (c) => h("b", c.items[c.index].toUpperCase()),
			}),
			Maybe: d("Maybe", { data: () => ({ show: false }), render: (c) => (c.show ? h("div", { class: "u-m" }) : null) }),
			Plain: d("Plain", { render: (c) => h("div", { class: "u-plain" }, c.label || "p") }),
			Outer2: d("Outer2", {
				setup() { const x = ref(0); watch(x, () => { throw new Error("watcher after mount broke"); }); onMounted(() => (x.value = 1)); return {}; },
				render: () => h("div", { class: "u-o2" }),
			}),
			Box: d("Box", {
				setup(self) { onMounted(() => (window.U_kid = new window.U_Sloppy({ parent: self.$el }))); onMounted(() => { throw new Error("second hook fails"); }); return {}; },
				render: () => h("div", { class: "u-box" }),
			}),
		};
		window.U_Sloppy = class extends U.Plain { destroy() { super.destroy(); this.socket.off(); } };
		window.U_Loud = class extends U.Plain { destroy() { window.U_calls = (window.U_calls || 0) + 1; $(this.$el).remove(); super.destroy(); } };
		window.U_host = () => $("<div class='u-host'>").appendTo(frappe.get_current_page().main);
	});

	Object.assign(r, await q(async () => {
		const o = {};
		const tick = () => new Promise((f) => setTimeout(f, 0));
		const orig = console.error;
		// watcher made in onMounted
		let host = U_host();
		const p = new U.LatePicker({ parent: host });
		const errs = []; console.error = (...x) => errs.push(String(x[0]));
		p.items = ["x"]; await tick(); await tick();
		console.error = orig;
		o["a watcher made in onMounted still runs before the view's render"] = host.text() === "X" && errs.length === 0 ? true : { text: host.text(), errs };
		// html(undefined)
		host = U_host();
		const m = new U.Maybe({ parent: host });
		host.html(undefined);
		m.show = true; m.flush();
		o[".html(undefined) leaves a placeholder view alone, as jQuery does"] = m.$destroyed !== true && host.find(".u-m").length === 1;
		// destroy override called once
		host = U_host();
		window.U_calls = 0;
		const l = new U_Loud({ parent: host });
		l.destroy();
		o["a destroy() override that removes its DOM runs once"] = window.U_calls === 1 && l.$destroyed === true;
		// errors after mount, during new
		host = U_host();
		console.error = () => {};
		let threw = null;
		try { new U.Outer2({ parent: host }); } catch (e) { threw = e.message; }
		console.error = orig;
		o["an error from a watcher its onMounted set off makes new throw"] = threw === "watcher after mount broke" && host.children().length === 0 ? true : threw;
		// nested destroy that throws
		host = U_host();
		console.error = () => {};
		try { new U.Box({ parent: host }); } catch {}
		console.error = orig;
		o["a failed new still removes its view when a nested destroy throws"] = host.find(".u-box").length === 0;
		$(".u-host").remove();
		return o;
	}));

	// router: same-page hash, and a hash that arrives after the user went elsewhere
	await page.goto(base + "/desk/user/Administrator", { waitUntil: "load" });
	await page.waitForFunction(() => window.cur_frm?.doc?.name === "Administrator", null, { timeout: 30000 });
	await page.waitForTimeout(1000);
	r["push('#tab') on the page showing switches the hash"] = await q(async () => {
		const provides = frappe.ui.app._context.provides;
		const router = (window.U_router = provides[Object.getOwnPropertySymbols(provides).find((s) => s.description === "router")]);
		await router.push("#settings_tab");
		return location.hash === "#settings_tab" || location.hash;
	});
	r["a late hash isn't written onto the page the user went to"] = await q(async () => {
		const done = U_router.push({ path: "/desk/role", hash: "late" });
		await new Promise((f) => setTimeout(f, 30));
		frappe.set_route("/desk/note");
		await done;
		await new Promise((f) => setTimeout(f, 300));
		return !location.hash.includes("late") || location.href;
	});

	// a Button whose route has a query and a hash, clicked
	await page.goto(base + "/desk/todo", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1000);
	await q(() => {
		const { h } = window.__vue_first.Vue;
		frappe.ui.define({ name: "frappe.ui.UQH", render: () => h(window.__vue_first.FuiButton, { class: "u-qh", label: "Go", route: { path: "/desk/user/Administrator", query: { tab: "x" }, hash: "settings_tab" } }) });
		new frappe.ui.UQH({ parent: $("<div id='u-qh'>").prependTo(frappe.get_current_page().main) });
	});
	await page.click("#u-qh .u-qh");
	await page.waitForFunction(() => window.cur_frm?.doc?.name === "Administrator", null, { timeout: 30000 }).catch(() => {});
	await page.waitForTimeout(1500);
	r["a Button with query and hash keeps both, the query first"] = await q(() => (location.search === "?tab=x" && !location.hash.includes("?")) || location.href);

	let pass = 0, total = 0;
	for (const [k, v] of Object.entries(r)) { total++; if (v === true) pass++; console.log(`  ${v === true ? "PASS" : "FAIL"}  ${k}${v === true ? "" : "  -> " + JSON.stringify(v)}`); }
	console.log(`\n${pass}/${total} passed`);
	const real = errors.filter((e) => !/socket\.io/.test(e) && !/watcher after mount broke|second hook fails|socket/.test(e));
	console.log("console errors and Vue warnings:", real.length ? real : "none");
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
