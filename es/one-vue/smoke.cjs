// One-Vue smoke test on v5.localhost. NODE_PATH=~/fb/pw/node_modules node smoke.cjs
const { chromium } = require("playwright");
const base = "http://v5.localhost:8000";
let pass = 0, fail = 0;
const check = (name, ok, info) => {
	ok ? pass++ : fail++;
	console.log(`${ok ? "ok  " : "FAIL"} ${name}${info !== undefined ? "  " + JSON.stringify(info).slice(0, 600) : ""}`);
};

// every mounted Vue app on the page: same runtime as frappe.Vue?
const APPS_PROBE = () => {
	const els = [...document.querySelectorAll("*")].filter((el) => el.__vue_app__);
	const apps = [...new Set(els.map((el) => el.__vue_app__))];
	return {
		vue: !!window.frappe?.Vue,
		apps: apps.map((app) => {
			const key = Symbol("probe");
			app.provide(key, 42);
			const injected = app.runWithContext(() => frappe.Vue.inject(key, null));
			const inst = app._container?._vnode?.component;
			const scope = inst ? inst.scope.run(() => frappe.Vue.getCurrentScope()) : null;
			// a reactive() from frappe.Vue, read inside the bundle's render effect, re-renders it
			let tracked = null;
			if (inst) {
				const r = frappe.Vue.reactive({ n: 0 });
				let runs = 0;
				const runner = inst.scope.run(() =>
					frappe.Vue.effect(() => {
						runs++;
						r.n;
					})
				);
				r.n++;
				tracked = runs === 2;
				runner.effect.stop();
			}
			return {
				name: inst?.type?.name || inst?.type?.__name || "?",
				version: app.version,
				same_inject: injected === 42,
				same_scope: !!inst && scope === inst.scope,
				tracked,
			};
		}),
	};
};

// fetch every script the page loaded and count Vue runtimes in them
const COPIES_PROBE = async () => {
	const urls = [...new Set(performance.getEntriesByType("resource").map((e) => e.name))].filter(
		(u) => /\.js(\?|$)/.test(u)
	);
	const copies = [];
	for (const u of urls) {
		const t = await (await fetch(u)).text();
		const n = t.split("__vue_app__").length - 1;
		if (n) copies.push(u.replace(/^.*\//, ""));
	}
	return { scripts: urls.length, copies };
};

(async () => {
	const browser = await chromium.launch();
	const run = async (label, viewport, steps) => {
		const ctx = await browser.newContext({ viewport });
		const r = await ctx.request.post(base + "/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
		if (!r.ok()) throw new Error("login " + r.status());
		const page = await ctx.newPage();
		const errors = [];
		page.on("pageerror", (e) => { if (!/probe=1/.test(e.message)) errors.push("pageerror: " + e.message); });
		page.on("console", (m) => {
			if ((m.type() === "error" || /Vue warn|frappe\.Vue/.test(m.text())) && !/probe=1|socket\.io|status of 404/.test(m.text()))
				errors.push(m.type() + ": " + m.text().slice(0, 300));
		});
		page.on("response", (res) => { if (res.status() >= 400 && !/socket\.io/.test(res.url())) errors.push("http " + res.status() + " " + res.url()); });
		try {
			await steps(page);
		} catch (e) {
			check(label + ": steps ran", false, e.message.slice(0, 300));
		}
		const copies = await page.evaluate(COPIES_PROBE);
		const built = copies.copies.filter((c) => !/\.island\./.test(c));
		check(label + ": one Vue copy in esbuild bundles (islands listed apart)", built.length <= 1, copies);
		check(label + ": no console errors", errors.length === 0, errors);
		await ctx.close();
	};
	const apps_ok = async (page, label, min = 1) => {
		const res = await page.evaluate(APPS_PROBE);
		const ok = res.vue && res.apps.length >= min && res.apps.every((a) => a.same_inject && a.same_scope && a.tracked);
		check(label + ": apps run on frappe.Vue", ok, res);
	};
	const desk = async (page, route) => {
		await page.goto(base + route, { waitUntil: "load" });
		await page.waitForFunction(() => window.frappe?.get_current_page?.(), null, { timeout: 30000 });
	};
	const wait_app = async (page, bundle) => {
		await page.waitForFunction((b) => frappe.assets._executed.some((p) => p.includes(b)), bundle, { timeout: 30000 });
		await page.waitForTimeout(1500);
	};

	await run("desk", { width: 1280, height: 800 }, async (page) => {
		await desk(page, "/desk/todo");
		await page.waitForTimeout(1500);
		const info = await page.evaluate(() => ({
			vue_bundle_on_page: [...document.scripts].filter((s) => /vue\.bundle/.test(s.src)).length,
			requires: frappe._asset_loader.get_dependencies(frappe.assets.bundled_asset("form_builder.bundle.js")),
			full: Object.keys(frappe.Vue).length,
			has: ["createApp", "defineCustomElement", "useTemplateRef", "nodeOps", "Teleport", "TransitionGroup"].filter((n) => !frappe.Vue[n]),
		}));
		check("desk: frappe.Vue is the full runtime", info.full > 150 && info.has.length === 0, info);
		// the shim's error when a bundle runs before vue.bundle.js
		const err = await page.evaluate(async () => {
			const keep = frappe.vue_modules;
			delete frappe.vue_modules;
			const msg = new Promise((res) => {
				window.addEventListener("error", (e) => { e.preventDefault(); res(e.message); }, { once: true });
			});
			const s = document.createElement("script");
			s.src = frappe.assets.bundled_asset("build_events.bundle.js") + "?probe=1";
			document.head.appendChild(s);
			const m = await msg;
			frappe.vue_modules = keep;
			return m;
		});
		check("desk: clear error when vue.bundle.js is missing", /Desk's Vue .* is not loaded before/.test(err), err);
	});

	await run("customize form (form builder)", { width: 1280, height: 800 }, async (page) => {
		await desk(page, "/desk/customize-form?doc_type=ToDo");
		await wait_app(page, "form_builder.bundle");
		await page.waitForTimeout(1000);
		await apps_ok(page, "form builder");
	});

	await run("doctype form builder", { width: 1280, height: 800 }, async (page) => {
		await desk(page, "/desk/doctype/ToDo");
		await page.waitForTimeout(2000);
		const tab = page.locator('[data-fieldname="form_builder_tab"], a:has-text("Form")').first();
		if (await tab.count()) await tab.click().catch(() => {});
		await wait_app(page, "form_builder.bundle");
		await page.waitForTimeout(1000);
		await apps_ok(page, "doctype form builder");
	});

	await run("print format builder", { width: 1280, height: 800 }, async (page) => {
		await desk(page, "/desk/print-format-builder/Crumb%20Format");
		await wait_app(page, "print_format_builder.bundle");
		await apps_ok(page, "print format builder");
	});

	await run("workflow builder", { width: 1280, height: 800 }, async (page) => {
		await desk(page, "/desk/workflow-builder/PB1%20WF");
		await wait_app(page, "workflow_builder.bundle");
		await apps_ok(page, "workflow builder");
	});

	await run("file uploader", { width: 1280, height: 800 }, async (page) => {
		await desk(page, "/desk/todo/new");
		await page.waitForTimeout(1500);
		await page.evaluate(() => new frappe.ui.FileUploader({ doctype: "ToDo", docname: "new" }));
		await wait_app(page, "file_uploader.bundle");
		await page.waitForTimeout(800);
		await apps_ok(page, "file uploader");
		// also through an Attach control on a form
		await page.evaluate(() => cur_dialog?.hide());
		const opened = await page.evaluate(() => {
			const d = new frappe.ui.Dialog({ title: "attach", fields: [{ fieldtype: "Attach", fieldname: "file", label: "File" }] });
			d.show();
			d.fields_dict.file.$input.trigger("click");
			return !!d.fields_dict.file.file_uploader;
		});
		check("file uploader: attach control opened it", !!opened, opened);
		await page.waitForTimeout(1500);
		await apps_ok(page, "attach uploader");
	});

	await run("kanban", { width: 1280, height: 800 }, async (page) => {
		await desk(page, "/desk/todo/view/kanban/ToDo%20Kanban");
		await page.waitForTimeout(4000);
		const k = await page.evaluate(() => ({
			route: frappe.get_route(),
			cols: document.querySelectorAll(".kanban-column").length,
			loaded: frappe.assets._executed.filter((p) => /kanban|vue\.bundle/.test(p)),
		}));
		check("kanban: board drawn", k.cols > 0, k);
	});

	await run("phone (mobile nav)", { width: 390, height: 844 }, async (page) => {
		await desk(page, "/desk/todo");
		await page.waitForFunction(() => customElements.get("frappe-mobile-nav"), null, { timeout: 30000 });
		await page.waitForTimeout(1500);
		const m = await page.evaluate(() => ({
			el: !!document.querySelector("frappe-mobile-nav.desk-mobile-nav"),
			visible: !!document.querySelector("frappe-mobile-nav")?.offsetHeight,
			items: document.querySelectorAll("frappe-mobile-nav-item, frappe-mobile-nav [data-slot]").length,
			loaded: frappe.assets._executed.filter((p) => /mobile_nav|vue\.bundle/.test(p)),
		}));
		check("phone: mobile nav drawn", m.el && m.visible && m.items > 0, m);
		await apps_ok(page, "mobile nav");
	});

	await browser.close();
	console.log(`\n${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
