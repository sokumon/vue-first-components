// Real-desk checks for the fixes to issue #1 (flaws 2, 3, 5, 6, 7, 8, 9, 10). probe.cjs covers 1 and 4.
const { open } = require("./session.cjs");
(async () => {
	const { browser, page, errors, base, ctx } = await open();
	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => window.frappe?.app?.sidebar && frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1500);
	const cdp = await ctx.newCDPSession(page);
	const gc = async () => {
		for (let i = 0; i < 3; i++) {
			await page.evaluate(() => new Promise((f) => setTimeout(f, 0)));
			await cdp.send("HeapProfiler.collectGarbage");
		}
	};
	const q = (fn, arg) => page.evaluate(fn, arg);
	const r = {};

	// #8 internals canary
	// v8: verify() runs at app.mount and throws if the internals are not as expected; a mounted app means it passed
	r["#8 internals canary: the runtime's Vue internals verified at load"] = await q(() => !!frappe.ui.app?._container && frappe.ui.vue_verified === true);

	// #9 hooks and template refs in the class's <script setup>; #10 privacy
	// v8 (SPEC.md section 5, O5): a view's own onMounted/onUpdated and template refs keep Vue's timing
	// (post flush, the next microtask when `new` runs outside a flush); parts and mounted() are ready
	// when `new` returns. These checks wait one tick where v5 checked synchronously.
	Object.assign(r, await q(async () => {
		const o = {};
		const tick = () => new Promise((f) => setTimeout(f, 0));
		const host = $('<div id="sp-host">').prependTo(frappe.get_current_page().main);
		const sp = (window.sp = new frappe.ui.SetupProbe({ parent: host }));
		await tick();
		o["#9 onMounted in setup ran (v8: by the next tick), with the template ref set"] = sp.calls.join() === "mounted:true";
		o["#9 useTemplateRef is the element"] = sp.box instanceof HTMLElement && sp.box.classList.contains("sp-box");
		o["#9 ref=\"x\" on a setup ref() fills it"] = sp.legacy_box instanceof HTMLElement && sp.legacy_box.classList.contains("sp-legacy");
		sp.set_label("y");
		sp.flush();
		const drawn = sp.box.textContent === "y";
		await tick();
		o["#9/#4 flush() drew the update; onUpdated ran (v8: by the next tick)"] = drawn && sp.calls.join() === "mounted:true,updated";
		o["#10 vue imports are not this.x"] = sp.ref === undefined && sp.onMounted === undefined && sp.useTemplateRef === undefined;
		o["#10 other imports are not this.x"] = sp.Button === undefined;
		o["#10 local state, functions and let are this.x"] = Array.isArray(sp.calls) && typeof sp.bump_local === "function" && sp.counter === 0 && (sp.bump_local(), sp.counter === 1);
		o["#10 setup fields aren't enumerable"] = !Object.keys(sp).some((k) => ["calls", "box", "counter"].includes(k));
		o["controller made in mounted() draws into the parent's DOM"] = host.find(".setup-probe .perf-row").text() === "child 0";
		return o;
	}));

	// #5 router: a Button with route renders a link and navigates through the desk router
	r["#5 Button route renders an <a href>"] = await q(() => document.querySelector("#sp-host .sp-route-btn")?.closest("a")?.getAttribute("href") === "/desk/role");

	// #3 host isn't resolved with jQuery on render
	r["#3 no jQuery call during re-render and flush"] = await q(() => {
		const real = window.$;
		let calls = 0;
		const spy = function (...a) { calls++; return real.apply(this, a); };
		Object.assign(spy, real);
		window.$ = spy;
		try {
			for (let i = 0; i < 20; i++) { sp.set_label("z" + i); sp.flush(); }
		} finally { window.$ = real; }
		return calls === 0 && sp.box.textContent === "z19";
	});

	// #2 reads in methods that aren't rendering aren't tracked through the proxy
	r["#2 the public object is still reactive for undeclared keys"] = await q(() => {
		sp.undeclared = 1;
		return sp.undeclared === 1;
	});

	// #7 lifetime: removed through jQuery, the controller and its child are destroyed
	Object.assign(r, await q(() => {
		const o = {};
		const child = sp.child;
		$("#sp-host").remove();
		o["#7 jQuery .remove() destroys the controller"] = sp.$fui.destroyed === true;
		o["#7 ...and a controller drawn inside it"] = child.$fui.destroyed === true;
		sp.set_label("after"); sp.flush();
		o["#7 a destroyed controller ignores flush()"] = true;
		const host = $('<div id="det-host">').appendTo(frappe.get_current_page().main);
		const row = new frappe.ui.PerfRow({ parent: host, label: "d" });
		const $row = host.children().detach();
		row.set(5); row.flush();
		$row.appendTo(host);
		o["#7 .detach() keeps it alive and updating"] = !row.$fui.destroyed && host.text() === "d 5";
		host.html("");
		o["#7 .html('') on the host destroys it"] = row.$fui.destroyed === true;
		host.remove();
		return o;
	}));

	const make = (kind) => q((kind) => {
		const area = $(`<div id="gc-${kind}">`).appendTo(frappe.get_current_page().main);
		window.__refs ||= {};
		const Row = kind.startsWith("global") ? frappe.ui.GlobalRow : frappe.ui.PerfRow;
		window.__refs[kind] = Array.from({ length: 200 }, (_, i) => {
			const c = new Row({ parent: $("<div>").appendTo(area), label: "g" + i });
			if (kind.endsWith("destroyed")) c.destroy();
			return new WeakRef(c);
		});
		if (kind.endsWith("jquery")) area.remove();
		if (kind.endsWith("native")) area[0].remove();
	}, kind);
	const kinds = ["local-jquery", "local-native", "local-attached", "local-destroyed", "global-jquery", "global-native", "global-destroyed"];
	for (const k of kinds) await make(k);
	await gc();
	const alive = await q(() => Object.fromEntries(Object.entries(window.__refs).map(([k, refs]) => [k, refs.filter((x) => x.deref()).length])));
	r["#7 GC: dropped, DOM removed by jQuery -> collected"] = alive["local-jquery"] === 0 ? true : alive;
	r["#7 GC: dropped, global store, DOM removed by jQuery -> collected"] = alive["global-jquery"] === 0 ? true : alive;
	r["#7 GC: destroy() -> collected"] = alive["local-destroyed"] === 0 && alive["global-destroyed"] === 0 ? true : alive;
	r["#7 GC: dropped, DOM removed natively, no global state -> collected"] = alive["local-native"] === 0 ? true : alive;
	r["#7 GC: dropped but still on the page -> kept"] = alive["local-attached"] === 200 ? true : alive;
	console.log("GC alive of 200 each:", JSON.stringify(alive));
	await q(() => { $("#gc-local-attached").remove(); $("#gc-global-native").remove(); });

	// #5 navigation through the provided router (last: it leaves the page)
	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1000);
	await q(() => { window.sp2 = new frappe.ui.SetupProbe({ parent: $('<div id="sp2">').prependTo(frappe.get_current_page().main) }); });
	await page.click("#sp2 .sp-route-btn");
	await page.waitForTimeout(1500);
	r["#5 clicking it routes the desk without a reload"] = await q(() => frappe.get_route().join("/") === "List/Role/List" && !!window.sp2);

	let pass = 0, total = 0;
	for (const [k, v] of Object.entries(r)) { total++; if (v === true) pass++; console.log(`  ${v === true ? "PASS" : "FAIL"}  ${k}${v === true ? "" : "  -> " + JSON.stringify(v)}`); }
	console.log(`\n${pass}/${total} passed`);
	const real = errors.filter((e) => !/socket\.io/.test(e));
	console.log("console errors and Vue warnings:", real.length ? real : "none");
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
