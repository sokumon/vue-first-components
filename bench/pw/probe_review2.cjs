// Real-desk regression checks for round two of the adversarial review of the issue #1 fixes.
const { open } = require("./session.cjs");
(async () => {
	const { browser, page, errors, base, ctx } = await open();
	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1500);
	const cdp = await ctx.newCDPSession(page);
	const gc = async () => { for (let i = 0; i < 3; i++) { await page.evaluate(() => new Promise((f) => setTimeout(f, 0))); await cdp.send("HeapProfiler.collectGarbage"); } };
	const q = (fn, arg) => page.evaluate(fn, arg);
	const r = {};

	await q(() => {
		const { h, ref, reactive, nextTick, defineComponent } = window.__vue_first.Vue;
		const d = (name, o) => frappe.ui.define({ name: "frappe.ui.S" + name, ...o });
		const store = (window.S_store = reactive({ docs: { a: { title: "A" } }, selected: "a" }));
		const Detail = defineComponent({ setup: () => () => h("b", { class: "s-detail" }, store.docs[store.selected].title) });
		class FakeDialog { render() {} show() { this.shown = true; } }
		window.S = {
			Plain: d("Plain", { render: (c) => h("div", { class: "s-plain" }, c.label || "p") }),
			Two: d("Two", { data: () => ({ a: true, b: false }), render: (c) => [c.a ? h("div", { class: "s-a" }) : null, c.b ? h("span", { class: "s-b" }) : null] }),
			Outer: d("Outer", { render: () => h("div", { class: "s-outer" }, [h("div", { class: "s-slot" })]) }),
			Maybe: d("Maybe", { data: () => ({ show: false }), render: (c) => (c.show ? h("div", { class: "s-maybe" }) : null) }),
			Panel: d("Panel", { data: () => ({ open: true }), methods: { close() { store.selected = null; this.open = false; } }, render: (c) => h("div", { class: "s-panel" }, c.open ? [h(Detail)] : "closed") }),
			Bad: d("Bad", { data: () => ({ key: "ok" }), render: (c) => h("div", { class: "s-bad", [c.key]: "1" }) }),
			FirstRenderThrows: d("FirstRenderThrows", { render: (c) => h("div", c.doc.title) }),
			Reentrant: d("Reentrant", { data: () => ({ n: 0 }), methods: { label() { this.flush(); return "n=" + this.n; } }, render: (c) => h("div", { class: "s-re" }, c.label()) }),
			Locals: d("Locals", { setup() { const dialog = new FakeDialog(); const later = nextTick; return { dialog, later }; }, render: () => h("div") }),
		};
		window.S_host = () => $("<div class='s-host'>").appendTo(frappe.get_current_page().main);
	});

	Object.assign(r, await q(async () => {
		const o = {};
		const tick = () => new Promise((f) => setTimeout(f, 0));
		// cleanData cost with many controllers in one host
		let host = S_host();
		const rows = Array.from({ length: 4000 }, (_, i) => new S.Plain({ parent: host, label: "r" + i }));
		let t = performance.now();
		host.empty();
		const ms = performance.now() - t;
		o["4000 controllers in one host: .empty() destroys all"] = rows.every((x) => x.$destroyed) || "some alive";
		o["4000 controllers in one host: .empty() is linear (ms)"] = ms < 150 ? true : Math.round(ms);
		window.__empty_ms = ms;
		// root moved elsewhere
		host = S_host();
		const other = S_host();
		let c = new S.Plain({ parent: host });
		$(c.$el).appendTo(other);
		other.empty();
		o["a root moved by legacy code: removing it still destroys the controller"] = c.$destroyed === true;
		// fragment of placeholders, host emptied
		host = S_host();
		c = new S.Two({ parent: host });
		c.a = false; c.flush();
		host.empty();
		c.b = true; c.flush(); await tick();
		o["a fragment of placeholders, host emptied: not redrawn, destroyed"] = host.children().length === 0 && c.$destroyed === true;
		// nested destroy
		host = S_host();
		const outer = new S.Outer({ parent: host });
		const inner = new S.Plain({ parent: host.find(".s-slot") });
		outer.destroy();
		o["destroy() destroys controllers drawn inside the view"] = inner.$destroyed === true;
		// parked with .detach()
		host = S_host();
		c = new S.Maybe({ parent: host });
		const parked = host.contents().detach();
		c.flush(); c.label = "x"; await tick();
		host.append(parked);
		c.show = true; c.flush();
		o[".contents().detach() of a placeholder view keeps it alive"] = c.$destroyed !== true && host.find(".s-maybe").length === 1;
		// order: child component reading state the view is about to drop
		host = S_host();
		const errs = [];
		const orig = console.error; console.error = (...a) => { errs.push(String(a[0])); orig.apply(console, a); };
		window.__unhandled = 0; window.addEventListener("unhandledrejection", () => window.__unhandled++);
		c = new S.Panel({ parent: host });
		c.close(); await tick(); await tick();
		console.error = orig;
		o["view renders before the components inside it (no render of a dropped child)"] = host.text() === "closed" && errs.length === 0 && window.__unhandled === 0 ? true : { text: host.text(), errs, unhandled: window.__unhandled };
		// one view's error doesn't stop another
		host = S_host();
		const bad = new S.Bad({ parent: host });
		const good = new S.Plain({ parent: host, label: "g0" });
		const orig2 = console.error; console.error = () => {};
		bad.key = "bad attr"; good.label = "g1";
		await tick(); await tick();
		console.error = orig2;
		o["an error in one view's re-render doesn't leave the next view stale"] = host.find(".s-plain").text() === "g1";
		// first-render error
		host = S_host();
		try { new S.FirstRenderThrows({ parent: host }); o["an error in the first render makes new throw"] = "no throw"; }
		catch (e) { o["an error in the first render makes new throw"] = /title/.test(e.message) && host.children().length === 0; }
		// flush inside render
		host = S_host();
		try { c = new S.Reentrant({ parent: host }); c.n = 1; c.flush(); o["flush() called from inside the template doesn't recurse"] = host.text() === "n=1"; }
		catch (e) { o["flush() called from inside the template doesn't recurse"] = e.message; }
		// local bindings that look like imports
		c = new S.Locals({ parent: S_host() });
		o["a local class instance and a local alias of a vue function stay this.x"] = typeof c.dialog?.show === "function" && typeof c.later === "function";
		$(".s-host").remove();
		return o;
	}));

	// GC: native removal, failed constructions, controllers created inside Vue onMounted
	await q(() => {
		window.__w = {};
		const host = $("<div class='s-host'>").appendTo(frappe.get_current_page().main)[0];
		window.__w.native = Array.from({ length: 100 }, (_, i) => { const c = new S.Plain({ parent: host, label: "n" + i }); host.removeChild(c.$el); return new WeakRef(c); });
		window.__w.failed = Array.from({ length: 100 }, () => { try { new S.FirstRenderThrows({ parent: host }); } catch {} return null; });
	});
	await gc();
	const alive = await q(() => window.__w.native.filter((x) => x.deref()).length);
	r["GC: dropped, DOM removed natively, host still on the page -> collected"] = alive === 0 ? true : alive + "/100 alive";

	// router
	Object.assign(r, await q(() => {
		const o = {};
		const provides = frappe.ui.app._context.provides;
		const router = provides[Object.getOwnPropertySymbols(provides).find((s) => s.description === "router")];
		o["string route 'List/ToDo' resolves like set_route"] = router.resolve("List/ToDo").href === "/desk/todo" || router.resolve("List/ToDo").href;
		o["string route 'Form/User/x' resolves like set_route"] = router.resolve("Form/User/Administrator").href === "/desk/user/Administrator" || router.resolve("Form/User/Administrator").href;
		o["'?status=Open' is relative to the current page"] = router.resolve("?status=Open").href.startsWith(location.pathname + "?status=Open") || router.resolve("?status=Open").href;
		o["non-desk absolute paths stay"] = router.resolve("/files/x.pdf").href === "/files/x.pdf";
		return o;
	}));
	const calls = [];
	await page.exposeFunction("__log_route2", (x) => calls.push(x));
	await q(() => {
		const set_route = frappe.set_route;
		frappe.set_route = function (...a) { window.__log_route2(JSON.stringify(a)); return set_route.apply(this, a); };
		const { h, withModifiers } = window.__vue_first.Vue;
		frappe.ui.define({ name: "frappe.ui.SStop", render: () => h("div", { class: "s-stop", onClick: withModifiers(() => {}, ["stop"]) }, [h(window.__vue_first.FuiButton, { class: "s-stop-btn", label: "Roles", route: "/desk/role" })]) });
		new frappe.ui.SStop({ parent: $("<div id='s-stop'>").prependTo(frappe.get_current_page().main) });
	});
	await page.click("#s-stop .s-stop-btn");
	await page.waitForTimeout(2000);
	r["Button inside a @click.stop row still navigates, once"] = (await q(() => frappe.get_route().join("/"))) === "List/Role/List" && calls.length === 1 ? true : { route: await q(() => frappe.get_route()), calls };

	let pass = 0, total = 0;
	for (const [k, v] of Object.entries(r)) { total++; if (v === true) pass++; console.log(`  ${v === true ? "PASS" : "FAIL"}  ${k}${v === true ? "" : "  -> " + JSON.stringify(v)}`); }
	console.log(`\n${pass}/${total} passed`);
	const real = errors.filter((e) => !/socket\.io/.test(e) && !/title|bad attr|InvalidCharacter/.test(e));
	console.log("console errors and Vue warnings:", real.length ? real : "none");
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
