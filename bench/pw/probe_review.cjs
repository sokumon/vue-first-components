// Real-desk regression checks for the defects an adversarial review found in the issue #1 fixes.
const { open } = require("./session.cjs");
(async () => {
	const { browser, page, errors, base } = await open();
	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1500);
	const q = (fn, arg) => page.evaluate(fn, arg);

	await q(() => {
		const { h, ref, watch, onMounted, useTemplateRef, defineComponent } = window.__vue_first.Vue;
		const d = (name, o) => frappe.ui.define({ name: "frappe.ui.R" + name, ...o });
		window.R = {
			Plain: d("Plain", { render: (c) => h("div", { class: "r-plain" }, c.label || "p") }),
			Check: d("Check", { data: () => ({ dirty: true }), render: (c) => h("input", { type: "checkbox", class: "r-check", onClick: () => (c.dirty = false) }) }),
			Maybe: d("Maybe", { data: () => ({ show: true }), render: (c) => (c.show ? h("div", { class: "r-maybe" }, "M") : null) }),
			Swap: d("Swap", {
				setup() {
					const s = ref(true);
					const Inner = defineComponent({ setup: () => () => (s.value ? h("div", { class: "r-in-a" }) : h("section", { class: "r-in-b" })) });
					return { s, Inner };
				},
				render: (c, _, __, $s) => h($s.Inner),
			}),
			Thrower: d("Thrower", { created() { throw new Error("doc is required"); }, render: () => h("div", { class: "r-throw" }) }),
			Kid: d("Kid", {
				setup() {
					const box = useTemplateRef("box");
					const log = [];
					onMounted(() => log.push("setup onMounted, box=" + !!box.value));
					return { box, log };
				},
				mounted() { this.log.push("class mounted, box=" + !!this.box); },
				render: () => h("div", { ref: "box", class: "r-kid" }),
			}),
			Quitter: d("Quitter", { created() { this.destroy(); }, mounted() { this.mounted_ran = true; }, render: () => h("div", { class: "r-quit" }) }),
			Hidden: d("Hidden", {
				setup() { const ran = []; onMounted(() => ran.push("onMounted")); return { ran }; },
				methods: { renders() { return false; } },
				render: () => h("div", { class: "r-hidden" }),
			}),
			Search: d("Search", {
				setup() {
					const qq = ref("");
					const results = ref([]);
					watch(qq, (v) => (results.value = ["a" + v, "b" + v]));
					return { qq, results };
				},
				methods: { search(v) { this.qq = v; } },
				render: (c, _, __, $s) => h("ul", { class: "r-search" }, $s.results.map((r) => h("li", r))),
			}),
			Measure: d("Measure", {
				setup() {
					const el = useTemplateRef("el");
					const width = ref(-1);
					onMounted(() => (width.value = el.value.children.length));
					return { el, width };
				},
				render: (c, _, __, $s) => h("div", { ref: "el", class: "r-measure", "data-w": $s.width }, [h("i"), h("i")]),
			}),
			Imports: d("Imports", {
				setup() { const Inner = { __name: "Inner", __file: "Inner.vue", render: () => h("b") }; /* what a .vue import is */ const local = ref(1); return { Inner, local }; },
				render: (c, _, __, $s) => h($s.Inner),
			}),
			Routes: d("Routes", { render: () => h("div", { class: "r-routes" }) }),
		};
		window.Rhost = () => $("<div class='r-host'>").appendTo(frappe.get_current_page().main);
	});

	const r = {};
	Object.assign(r, await q(async () => {
		const o = {};
		const tick = () => new Promise((f) => setTimeout(f, 0));
		// replaceWith on a view root
		let host = Rhost();
		let c = new R.Plain({ parent: host });
		try { $(c.$el).replaceWith('<p class="new">new</p>'); o["replaceWith on a view root works and destroys it"] = host.find("p.new").length === 1 && c.$destroyed === true; }
		catch (e) { o["replaceWith on a view root works and destroys it"] = "throws " + e.message; }
		// handler returning false
		host = Rhost();
		c = new R.Check({ parent: host });
		let bubbled = 0;
		host.on("click", () => bubbled++);
		host.find(".r-check")[0].click();
		o["@click that evaluates to false doesn't preventDefault or stop bubbling"] = host.find(".r-check")[0].checked === true && bubbled === 1;
		// comment root, host emptied
		host = Rhost();
		c = new R.Maybe({ parent: host });
		c.show = false; c.flush();
		host.empty();
		c.show = true; c.flush(); await tick();
		o["a view showing only a comment, host emptied: not redrawn, destroyed"] = host.children().length === 0 && c.$destroyed === true;
		// child component swaps the root
		host = Rhost();
		c = new R.Swap({ parent: host });
		c.s = false; c.flush();
		const swapped = host.find(".r-in-b").length === 1;
		host.empty();
		o["root swapped by a child component: jQuery .empty() destroys it"] = swapped && c.$destroyed === true;
		// errors in created
		host = Rhost();
		try { new R.Thrower({ parent: host }); o["an error in created() makes new throw"] = "no throw"; }
		catch (e) { o["an error in created() makes new throw"] = e.message === "doc is required" && host.children().length === 0; }
		// created inside a Vue onMounted
		host = Rhost();
		const { desk_renderer, Vue } = window.__vue_first;
		let kid;
		const page_app = desk_renderer.createApp({
			setup() {
				const slot = Vue.useTemplateRef("slot");
				Vue.onMounted(() => (kid = new R.Kid({ parent: slot.value })));
				return () => Vue.h("div", { ref: "slot" });
			},
		});
		page_app.mount(host[0]);
		o["created in a Vue onMounted: setup onMounted and refs come before mounted()"] = JSON.stringify(kid?.log) === JSON.stringify(["setup onMounted, box=true", "class mounted, box=true"]) || kid?.log;
		page_app.unmount();
		// destroy during construction
		host = Rhost();
		c = new R.Quitter({ parent: host });
		o["destroy() in created(): nothing drawn, no mounted()"] = host.find(".r-quit").length === 0 && !c.mounted_ran && c.$destroyed === true;
		// selectors and HTML
		host = Rhost();
		host.append("<div class='slot'></div><div class='slot'></div>");
		try { new R.Plain({ parent: ".r-host:last .slot:first", label: "sel" }); o["a jQuery-only selector works as parent"] = host.find(".slot").first().text() === "sel"; }
		catch (e) { o["a jQuery-only selector works as parent"] = "throws " + e.message; }
		// renders() false
		c = new R.Hidden({ parent: Rhost() });
		await tick();
		o["renders() false: setup's onMounted doesn't run"] = c.ran.length === 0;
		// watcher-fed state
		c = new R.Search({ parent: Rhost() });
		c.search("x"); c.flush();
		o["flush() runs watchers and the render they cause"] = $(c.$el).text() === "axbx";
		// onMounted that sets state
		c = new R.Measure({ parent: Rhost() });
		o["state set in onMounted is drawn when new returns"] = c.$el.getAttribute("data-w") === "2";
		// .vue-like import
		c = new R.Imports({ parent: Rhost() });
		o["a component import isn't this.x, local state is"] = c.Inner === undefined && c.local === 1;
		$(".r-host").remove();
		return o;
	}));

	// router
	Object.assign(r, await q(async () => {
		const o = {};
		const router = frappe.ui.app._context.provides[Object.getOwnPropertySymbols(frappe.ui.app._context.provides).find((s) => s.description === "router")];
		o["array route: absolute href"] = router.resolve(["Form", "User", "Administrator"]).href === "/desk/user/Administrator" || router.resolve(["Form", "User", "Administrator"]).href;
		o["array route with options: query, not [object Object]"] = router.resolve(["List", "ToDo", { status: "Open" }]).href === "/desk/todo?status=Open" || router.resolve(["List", "ToDo", { status: "Open" }]).href;
		o["object route keeps query and hash"] = router.resolve({ path: "/desk/todo", query: { status: "Open" }, hash: "x" }).href === "/desk/todo?status=Open#x";
		o["named route is refused, not sent home"] = await router.push({ name: "Form", params: {} }).then(() => "resolved", (e) => /no desk route/.test(e.message));
		o["currentRoute carries the query"] = (() => { const u = router.currentRoute.value; return u.path === location.pathname && typeof u.query === "object"; })();
		return o;
	}));
	const calls = [];
	await page.exposeFunction("__log_route", (x) => calls.push(x));
	await q(() => {
		const set_route = frappe.set_route;
		frappe.set_route = function (...a) { window.__log_route(JSON.stringify(a)); return set_route.apply(this, a); };
		const { h } = window.__vue_first.Vue;
		const host = $("<div id='rl'>").prependTo(frappe.get_current_page().main)[0];
		// a frappe-ui Button with an array route, inside a class
		frappe.ui.define({ name: "frappe.ui.RLink", setup() { return {}; }, render: () => h(window.__vue_first.FuiButton, { class: "rl-btn", label: "Go", route: ["Form", "User", "Administrator"] }) });
		window.rl = new frappe.ui.RLink({ parent: host });
	}).catch((e) => (r["router link setup"] = String(e)));
	if (await q(() => !!document.querySelector("#rl .rl-btn"))) {
		await page.click("#rl .rl-btn");
		await page.waitForTimeout(2000);
		r["array-route Button opens the form, navigating once"] = (await q(() => frappe.get_route().join("/"))) === "Form/User/Administrator" && calls.length === 1 ? true : { route: await q(() => frappe.get_route()), calls };
	} else r["array-route Button renders"] = "no button";

	let pass = 0, total = 0;
	for (const [k, v] of Object.entries(r)) { total++; if (v === true) pass++; console.log(`  ${v === true ? "PASS" : "FAIL"}  ${k}${v === true ? "" : "  -> " + JSON.stringify(v)}`); }
	console.log(`\n${pass}/${total} passed`);
	const real = errors.filter((e) => !/socket\.io/.test(e) && !/doc is required/.test(e));
	console.log("console errors and Vue warnings:", real.length ? real : "none");
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
