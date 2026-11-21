// Real-desk regression checks for round three of the adversarial review of the issue #1 fixes.
const { open } = require("./session.cjs");
(async () => {
	const { browser, page, errors, base } = await open();
	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1500);
	const q = (fn, arg) => page.evaluate(fn, arg);
	const r = {};

	await q(() => {
		const { h, ref, watch, onMounted, Teleport } = window.__vue_first.Vue;
		const d = (name, o) => frappe.ui.define({ name: "frappe.ui.T" + name, ...o });
		const src = (window.T_src = ref(0));
		window.T = {
			Watcher: d("Watcher", {
				data: () => ({ shown: 0 }),
				setup(self) { watch(src, (v) => (self.shown = v)); return {}; },
				render: (c) => h("i", { class: "t-w" }, `${c.shown}/${src.value}`),
			}),
			Boom: d("Boom", { data: () => ({ boom: false }), render: (c) => { if (c.boom) throw new Error("A's render broke"); return h("div", { class: "t-boom" }); } }),
			Plain: d("Plain", { render: (c) => h("div", { class: "t-plain" }, c.label || "p") }),
			Box: d("Box", {
				setup(self) {
					onMounted(() => (window.T_kid = new frappe.ui.TPlain({ parent: self.$el })));
					onMounted(() => { throw new Error("second hook fails"); });
					return {};
				},
				render: () => h("div", { class: "t-box" }),
			}),
			Picker: d("Picker", {
				data: () => ({ items: ["a", "b", "c"], index: 2 }),
				setup(self) { watch(() => self.items, (items) => { if (self.index >= items.length) self.index = 0; }); return {}; },
				render: (c) => h("b", { class: "t-pick" }, c.items[c.index].toUpperCase()),
			}),
			Rows: d("Rows", { render: (c) => Array.from({ length: c.n }, (_, i) => h("tr", { key: i }, [h("td", i)])) }),
			Pop: d("Pop", { render: () => h(Teleport, { to: "body" }, [h("div", { class: "t-pop" })]) }),
			Local: d("Local", { setup() { const column = { label: "Status", render: (v) => v }; return { column }; }, render: () => h("div") }),
		};
		window.T_host = () => $("<div class='t-host'>").appendTo(frappe.get_current_page().main);
		class Loud extends frappe.ui.TPlain { destroy() { $(this.$el).remove(); super.destroy(); } }
		window.T_Loud = Loud;
	});

	Object.assign(r, await q(async () => {
		const o = {};
		const tick = () => new Promise((f) => setTimeout(f, 0));
		// many views, each with a watcher feeding it, in one tick
		let host = T_host();
		const ws = Array.from({ length: 150 }, () => new T.Watcher({ parent: host }));
		T_src.value = 1; await tick(); await tick();
		const first = ws.filter((w) => $(w.$el).text() !== "1/1").length;
		T_src.value = 2; await tick(); await tick();
		const second = ws.filter((w) => $(w.$el).text() !== "2/2").length;
		const z = new T.Plain({ parent: host, label: "z0" }); z.label = "z1"; await tick();
		o["150 views fed by their own watchers all update, and keep updating"] = first === 0 && second === 0 && $(z.$el).text() === "z1" ? true : { first, second, z: $(z.$el).text() };
		// another view's pending error isn't blamed on the controller being built
		host = T_host();
		const a = new T.Boom({ parent: host });
		const orig = console.error; console.error = () => {};
		a.boom = true;
		let threw = null;
		try { new T.Plain({ parent: host, label: "b" }); } catch (e) { threw = e.message; }
		console.error = orig;
		o["an unrelated view's queued error doesn't make this new throw"] = threw === null && host.find(".t-plain").text() === "b" ? true : threw;
		// failed construction destroys what it drew
		host = T_host();
		window.T_kid = null;
		try { new T.Box({ parent: host }); } catch {}
		o["a failed new destroys the controllers its hooks drew"] = !!window.T_kid && window.T_kid.$destroyed === true;
		// watcher fixes state before the render
		host = T_host();
		const p = new T.Picker({ parent: host });
		const errs = []; console.error = (...x) => errs.push(String(x[0]));
		p.items = ["x"]; await tick(); await tick();
		console.error = orig;
		o["a view's own watcher still runs before its render"] = host.text() === "X" && errs.length === 0 ? true : { text: host.text(), errs };
		// destroy() override that removes its own DOM
		host = T_host();
		const l = new T_Loud({ parent: host });
		try { l.destroy(); o["a destroy() override that removes its DOM with jQuery ends"] = l.$destroyed === true && host.children().length === 0; }
		catch (e) { o["a destroy() override that removes its DOM with jQuery ends"] = e.message; }
		const l2 = new T_Loud({ parent: host });
		try { host.empty(); o["...and so does emptying its host"] = l2.$destroyed === true; } catch (e) { o["...and so does emptying its host"] = e.message; }
		// many top-level rows
		host = $("<table><tbody class='t-tbody'></tbody></table>").appendTo(frappe.get_current_page().main).find("tbody");
		const rows = new T.Rows({ parent: host, n: 8000 });
		let t = performance.now();
		host.empty();
		const ms = performance.now() - t;
		o["8000 top-level rows: .empty() is linear and destroys the view"] = rows.$destroyed === true && ms < 150 ? true : { ms: Math.round(ms), destroyed: rows.$destroyed };
		host.closest("table").remove();
		// Teleport-only view, host removed / emptied
		host = T_host();
		const pop = new T.Pop({ parent: host });
		host.remove(); await tick();
		const pop2_host = T_host();
		const pop2 = new T.Pop({ parent: pop2_host });
		pop2_host.empty(); await tick();
		o["a Teleport-only view goes with its host (.remove() and .empty())"] = pop.$destroyed === true && pop2.$destroyed === true && document.querySelectorAll(".t-pop").length === 0 ? true : { a: pop.$destroyed, b: pop2.$destroyed, left: document.querySelectorAll(".t-pop").length };
		// local plain object with render
		const lc = new T.Local({ parent: T_host() });
		o["a local object with a render key stays this.x"] = lc.column?.label === "Status";
		// created inside a running post flush, then its host emptied
		host = T_host();
		const { desk_renderer, Vue } = window.__vue_first;
		let kid;
		const app = desk_renderer.createApp({ setup() { const slot = Vue.useTemplateRef("slot"); Vue.onMounted(() => { kid = new T.Plain({ parent: slot.value }); $(slot.value).empty(); }); return () => Vue.h("div", { ref: "slot" }); } });
		app.mount(host[0]);
		o["created in a Vue onMounted, host emptied right away: destroyed"] = kid?.$destroyed === true;
		app.unmount();
		$(".t-host").remove();
		return o;
	}));

	// router
	Object.assign(r, await q(() => {
		const o = {};
		const provides = frappe.ui.app._context.provides;
		const router = provides[Object.getOwnPropertySymbols(provides).find((s) => s.description === "router")];
		window.T_router = router;
		o["a shell named in the route is kept"] = router.resolve("/desk/build/user").href === "/desk/build/user" || router.resolve("/desk/build/user").href;
		o["another site keeps its full URL"] = router.resolve("https://example.com/x").href === "https://example.com/x";
		o["a file link is never 'active'"] = router.resolve("/files/x.pdf").matched[0] !== router.currentRoute.value.matched[0];
		return o;
	}));
	// what the router itself leaves when push() resolves (a form then swaps the hash for its active tab,
	// and a list view puts its filters after the hash: both are frappe's own pages rewriting the URL)
	await q(() => { window.__pushed = null; T_router.push({ path: "/desk/user/Administrator", query: { tab: "x" }, hash: "y" }).then(() => (window.__pushed = location.search + location.hash)); });
	await page.waitForFunction(() => window.__pushed !== null, null, { timeout: 15000 }).catch(() => {});
	r["query plus hash: the query stays before the hash"] = (await q(() => window.__pushed)) === "?tab=x#y" || (await q(() => window.__pushed));

	let pass = 0, total = 0;
	for (const [k, v] of Object.entries(r)) { total++; if (v === true) pass++; console.log(`  ${v === true ? "PASS" : "FAIL"}  ${k}${v === true ? "" : "  -> " + JSON.stringify(v)}`); }
	console.log(`\n${pass}/${total} passed`);
	const real = errors.filter((e) => !/socket\.io/.test(e) && !/A's render broke|second hook fails/.test(e));
	console.log("console errors and Vue warnings:", real.length ? real : "none");
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
