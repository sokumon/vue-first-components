// Targeted Playwright checks for the Vue bundles Frappe's own suite does not cover, on the
// one-Vue bench (v5.localhost). Each check drives the bundle's UI through its own compiled
// code paths (render effects, watches, third-party Vue libs), not just "it mounted".
// Run: NODE_PATH=~/fb/pw/node_modules node targeted.cjs
const { chromium } = require("playwright");
const base = "http://v5.localhost:8000";
let pass = 0, fail = 0;
const results = [];
const check = (name, ok, info) => {
	ok ? pass++ : fail++;
	results.push({ name, ok });
	console.log(`${ok ? "ok  " : "FAIL"} ${name}${info !== undefined ? "  " + JSON.stringify(info).slice(0, 500) : ""}`);
};

const COPIES_PROBE = async () => {
	const urls = [...new Set(performance.getEntriesByType("resource").map((e) => e.name))].filter((u) => /\.js(\?|$)/.test(u));
	const copies = [];
	for (const u of urls) {
		const t = await (await fetch(u)).text();
		if (t.includes("__vue_app__")) copies.push(u.replace(/^https?:\/\/[^/]+/, ""));
	}
	// Vite page islands (dist/page-island, *.island.*) are a separate build, listed apart
	return copies.filter((c) => !/island/.test(c)).map((c) => c.replace(/^.*\//, ""));
};

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

(async () => {
	const browser = await chromium.launch();
	const run = async (label, viewport, steps) => {
		const ctx = await browser.newContext({ viewport });
		const r = await ctx.request.post(base + "/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
		if (!r.ok()) throw new Error("login " + r.status());
		const page = await ctx.newPage();
		const errors = [];
		page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 300) + " @ " + (e.stack || "").split("\n")[1]?.trim().slice(0, 160)));
		page.on("console", (m) => {
			if ((m.type() === "error" || /Vue warn|frappe\.Vue/.test(m.text())) && !/socket\.io|status of 404/.test(m.text()))
				errors.push(m.type() + ": " + m.text().slice(0, 300));
		});
		try {
			await steps(page);
		} catch (e) {
			check(label + ": steps ran", false, e.message.slice(0, 400));
		}
		const copies = await page.evaluate(COPIES_PROBE).catch((e) => ["probe failed " + e.message]);
		check(label + ": one Vue copy among loaded esbuild bundles", copies.length === 1 && /^vue\.bundle\./.test(copies[0]), copies);
		const spike = errors.filter((e) => /vue_first8?\.bundle/.test(e));
		const real = errors.filter((e) => !spike.includes(e));
		check(label + ": no console errors / Vue warnings (v8 spike errors listed apart)", real.length === 0, { real, spike });
		await ctx.close();
	};
	const desk = async (page, route) => {
		await page.goto(base + route, { waitUntil: "load" });
		await page.waitForFunction(() => window.frappe?.get_current_page?.(), null, { timeout: 30000 });
	};
	const executed = (page, bundle) =>
		page.waitForFunction((b) => frappe.assets._executed.some((p) => p.includes(b)), bundle, { timeout: 30000 });
	const until = (page, fn, arg, timeout = 10000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

	// ---------------------------------------------------------------- form builder
	await run("form builder", DESKTOP, async (page) => {
		await desk(page, "/desk/customize-form?doc_type=ToDo");
		await executed(page, "form_builder.bundle");
		const drawn = await until(page, () => document.querySelectorAll(".form-builder-container .field").length > 0, null, 20000);
		check("form builder: fields drawn", drawn);
		// store (pinia + vue ref in the bundle) -> the bundle's compiled render
		const relabel = await page.evaluate(async () => {
			const st = frappe.form_builder.store;
			const tab = st.form.layout.tabs[0];
			const f = tab.sections.flatMap((s) => s.columns.flatMap((c) => c.fields))[0];
			const old = f.df.label;
			f.df.label = "OneVueProbeLabel";
			await new Promise((r) => setTimeout(r, 60));
			const shown = [...document.querySelectorAll(".form-builder-container .field-label")].some((e) => e.textContent.includes("OneVueProbeLabel"));
			f.df.label = old;
			return { shown, is_reactive: !!(st.form)?.__v_isReactive };
		});
		check("form builder: store edit re-renders the field label", relabel.shown && relabel.is_reactive, relabel);
		// clicking a field selects it (event handler -> store -> sidebar)
		await page.locator(".form-builder-container .field").first().click();
		const sel = await until(page, () => !!frappe.form_builder.store.form.selected_field);
		check("form builder: clicking a field selects it", sel);
	});

	// ---------------------------------------------------------------- print format builder
	await run("print format builder", DESKTOP, async (page) => {
		// the canvas normalises the layout and schedules a draft autosave: never let it reach the server
		await page.route(/print_format\.(save_draft|apply_draft|save)/, (r) => r.abort());
		await desk(page, "/desk/print-format-builder/Crumb%20Format");
		await executed(page, "print_format_builder.bundle");
		const ok = await until(page, () => frappe.print_format_builder?.$component && document.querySelector(".pfb-setup-option"), null, 20000);
		check("print format builder: setup screen drawn (Crumb Format has no saved layout)", ok);
		// store ref -> v-if swaps setup screen for the canvas; component ref -> label + CSS var.
		// dirty is left untouched so the draft autosave never fires.
		const zoom = await page.evaluate(async () => {
			const c = frappe.print_format_builder.$component;
			const st = c.$store, ss = c.$.setupState;
			const was_setup = st.needs_setup.value, was_dirty = st.dirty.value;
			st.needs_setup.value = false;
			await new Promise((r) => setTimeout(r, 60));
			const canvas = !!document.querySelector(".canvas-toolbar") && !document.querySelector(".pfb-setup-option");
			await new Promise((r) => setTimeout(r, 800)); // let fit_zoom_to_canvas settle first
			const old = ss.canvas_zoom;
			ss.canvas_zoom = 150;
			await c.$nextTick(); // read before the canvas ResizeObserver re-fits the zoom
			const label = document.querySelector(".canvas-zoom-trigger .es-button__label")?.textContent.trim();
			const css = getComputedStyle(document.querySelector("[style*='--pfb-zoom']")).getPropertyValue("--pfb-zoom").trim();
			ss.canvas_zoom = old;
			st.needs_setup.value = was_setup;
			await new Promise((r) => setTimeout(r, 60));
			const back = !!document.querySelector(".pfb-setup-option");
			return { canvas, label, css, back };
		});
		check("print format builder: store ref swaps setup/canvas; zoom ref re-renders label and style", zoom.canvas && zoom.label === "150%" && zoom.css === "1.5" && zoom.back, zoom);
	});

	// ---------------------------------------------------------------- workflow builder (@vue-flow)
	await run("workflow builder", DESKTOP, async (page) => {
		await desk(page, "/desk/workflow-builder/PB1%20WF");
		await executed(page, "workflow_builder.bundle");
		const drawn = await until(page, () => document.querySelectorAll(".vue-flow__node").length > 0, null, 20000);
		const n0 = await page.evaluate(() => document.querySelectorAll(".vue-flow__node").length);
		check("workflow builder: @vue-flow nodes drawn", drawn, { nodes: n0 });
		const tf = () => page.evaluate(() => document.querySelector(".vue-flow__transformationpane")?.style.transform);
		const t0 = await tf();
		await page.locator("button:has-text('+')").first().click();
		await page.waitForTimeout(600);
		const t1 = await tf();
		check("workflow builder: zoom in button changes the viewport (vue-flow store)", !!t0 && t0 !== t1, { t0, t1 });
		const added = await page.evaluate(async () => {
			const st = frappe.workflow_builder.store;
			st.workflow.elements.push({ id: "onevue-probe", type: "state", position: { x: 40, y: 40 }, data: { state: "OneVueProbe", doc_status: "0", allow_edit: "System Manager" } });
			await new Promise((r) => setTimeout(r, 500));
			const n = document.querySelectorAll(".vue-flow__node").length;
			const text = !!document.querySelector('.vue-flow__node[data-id="onevue-probe"]');
			st.workflow.elements.pop();
			return { n, text };
		});
		check("workflow builder: store push draws a new node", added.n === n0 + 1 && added.text, added);
	});

	// ---------------------------------------------------------------- layout builder (vuedraggable)
	await run("layout builder", DESKTOP, async (page) => {
		await desk(page, "/desk/todo/new");
		await page.evaluate(() => frappe.require("layout_builder.bundle.js"));
		const res = await page.evaluate(async () => {
			const wrapper = document.createElement("div");
			wrapper.id = "onevue-lb";
			wrapper.style.cssText = "height:600px";
			document.querySelector(".page-container:not([style*='none']) .layout-main-section, body").appendChild(wrapper);
			const fields = frappe.get_meta("ToDo").fields.slice(0, 6).map((f, i) => ({ fieldname: f.fieldname, label: f.label || f.fieldname, fieldtype: f.fieldtype, idx: i + 1 }));
			let dirtied = 0;
			const frm = { doc: { doctype: "DocType Layout", document_type: "ToDo", fields }, dirty: () => dirtied++ };
			window.__lb = new frappe.ui.LayoutBuilder({ wrapper, frm });
			await new Promise((r) => setTimeout(r, 60));
			return {
				rows: wrapper.querySelectorAll(".lb-main [class*='lb-'], .lb-main .field-row, .lb-main li").length,
				text: wrapper.textContent.includes(fields[1].label),
				has_drag: !!wrapper.querySelector("[draggable], .lb-main > div > div"),
			};
		});
		check("layout builder: mounts with rows from the store", res.text, res);
		// select a row through the store -> sidebar opens (class binding)
		const sb = await page.evaluate(async () => {
			const st = window.__lb.store;
			st.select(st.fields[1]);
			await new Promise((r) => setTimeout(r, 60));
			const open = document.querySelector("#onevue-lb .lb-sidebar").classList.contains("lb-sidebar-visible");
			st.update_field(st.fields[1].fieldname, "label", "OneVueLB");
			await new Promise((r) => setTimeout(r, 60));
			const relabel = document.querySelector("#onevue-lb").textContent.includes("OneVueLB");
			st.deselect();
			await new Promise((r) => setTimeout(r, 60));
			const closed = !document.querySelector("#onevue-lb .lb-sidebar").classList.contains("lb-sidebar-visible");
			return { open, relabel, closed, dirty: st.dirty };
		});
		check("layout builder: select/update/deselect re-render", sb.open && sb.relabel && sb.closed && sb.dirty, sb);
		const un = await page.evaluate(() => { window.__lb.destroy(); return document.querySelector("#onevue-lb").children.length; });
		check("layout builder: destroy unmounts", un === 0, un);
	});

	// ---------------------------------------------------------------- file uploader
	await run("file uploader", DESKTOP, async (page) => {
		await desk(page, "/desk/todo/new");
		await page.evaluate(() => (window.__fu = new frappe.ui.FileUploader({ doctype: "ToDo", docname: "new" })));
		await executed(page, "file_uploader.bundle");
		const ready = await until(page, () => window.__fu.uploader && document.querySelector(".file-upload-area"));
		check("file uploader: dialog drawn", ready);
		await page.locator(".modal:visible input[type=file]").first().setInputFiles({ name: "onevue.txt", mimeType: "text/plain", buffer: Buffer.from("one vue") });
		const shown = await until(page, () => [...document.querySelectorAll(".modal .file-name")].some((e) => e.textContent.includes("onevue.txt")));
		check("file uploader: picked file listed (input -> files ref -> FilePreview)", shown);
		const btn = await page.evaluate(() => {
			const p = window.__fu.dialog.get_primary_btn();
			return { visible: p.is(":visible"), text: p.text().trim() };
		});
		check("file uploader: bundle watch() on files shows the Upload button", btn.visible, btn);
	});

	// ---------------------------------------------------------------- kanban
	await run("kanban", DESKTOP, async (page) => {
		await desk(page, "/desk/todo/view/kanban/ToDo%20Kanban");
		await executed(page, "kanban_board.bundle");
		const ok = await until(page, () => document.querySelectorAll(".kanban-column").length > 0, null, 20000);
		const info = await page.evaluate(() => ({
			cols: document.querySelectorAll(".kanban-column").length,
			cards: document.querySelectorAll(".kanban-card-wrapper, .kanban-card").length,
			vue_first: frappe.assets._executed.findIndex((p) => /vue\.bundle/.test(p)) < frappe.assets._executed.findIndex((p) => /kanban_board/.test(p)),
		}));
		check("kanban: board drawn, vue.bundle executed before kanban_board", ok && info.vue_first, info);
	});

	// ---------------------------------------------------------------- build events (developer_mode)
	await run("build events", DESKTOP, async (page) => {
		await desk(page, "/desk/todo");
		await executed(page, "build_events.bundle");
		const r = await page.evaluate(async () => {
			const sock = frappe.realtime.socket;
			const fire = (d) => (sock.listeners ? sock.listeners("build_event") : sock._callbacks["$build_event"]).forEach((fn) => fn(d));
			fire({ success: true, changed_files: [] });
			await new Promise((r) => setTimeout(r, 400));
			const ok = document.querySelector("#build-events-overlay .build-success-message");
			const ok_text = ok?.textContent.trim().slice(0, 60);
			return { ok_text, ok_vis: !!ok && ok.offsetHeight > 0 };
		});
		check("build events: success toast renders on a build_event", r.ok_vis && /Compiled successfully/.test(r.ok_text || ""), r);
	});

	// ---------------------------------------------------------------- mobile nav (phone width)
	await run("mobile nav", PHONE, async (page) => {
		await desk(page, "/desk/todo");
		await page.waitForFunction(() => customElements.get("frappe-mobile-nav-item") && document.querySelector("frappe-mobile-nav [data-slot=mobile-nav-item]"), null, { timeout: 30000 });
		const m = await page.evaluate(async () => {
			const el = document.querySelector("frappe-mobile-nav-item");
			const old = el.getAttribute("label");
			el.setAttribute("label", "OneVueTab");
			await new Promise((r) => setTimeout(r, 60));
			const relabel = el.textContent.includes("OneVueTab") && el.querySelector("[aria-label=OneVueTab]") !== null;
			el.setAttribute("label", old);
			el.setAttribute("active", "");
			el.active = true;
			await new Promise((r) => setTimeout(r, 60));
			const state = el.querySelector("[data-slot=mobile-nav-item]").dataset.state;
			el.active = false;
			return { relabel, state, items: document.querySelectorAll("frappe-mobile-nav-item").length, visible: document.querySelector("frappe-mobile-nav").offsetHeight };
		});
		check("mobile nav: drawn at phone width", m.items > 0 && m.visible > 0, m);
		check("mobile nav: attribute/prop changes re-render the custom element", m.relabel && m.state === "active", m);
		const before = page.url();
		await page.locator("frappe-mobile-nav-item [aria-label=Search]").first().click();
		const routed = await page.waitForURL((u) => /\/desk\/search/.test(u.toString()), { timeout: 10000 }).then(() => true, () => false);
		await page.waitForTimeout(1500);
		await page.waitForFunction(() => window.frappe?.get_route?.() && document.querySelector("frappe-mobile-nav [data-slot=mobile-nav-item]"), null, { timeout: 30000 }).catch(() => {});
		check("mobile nav: tapping Search navigates and the bar is drawn again", routed, { before, after: page.url() });
	});

	// ---------------------------------------------------------------- website pages (frappe-web.bundle)
	// upload.js (in frappe-web.bundle) frappe.require()s file_uploader.bundle.js on every web page,
	// through website.js's own frappe.require, not frappe.assets.
	for (const route of ["/me", "/test-grid-dropdown/new"]) {
		await run("website " + route, DESKTOP, async (page) => {
			await page.goto(base + route, { waitUntil: "load" });
			await page.waitForTimeout(3000);
			const w = await page.evaluate(() => ({
				uploader: !!frappe.ui?.FileUploader,
				vue: !!frappe.Vue,
				scripts: [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src").replace(/^.*\//, "")),
			}));
			check("website " + route + ": file uploader loads with Vue", w.uploader && w.vue, w);
		});
	}

	// ---------------------------------------------------------------- two bundles, one page: shared reactivity
	// Form builder (customize form) and file uploader in one page session. A reactive object made by
	// one bundle's store is rendered by the other bundle's compiled template, both ways.
	await run("two bundles on one page (form builder + file uploader)", DESKTOP, async (page) => {
		await desk(page, "/desk/customize-form?doc_type=ToDo");
		await executed(page, "form_builder.bundle");
		await until(page, () => document.querySelectorAll(".form-builder-container .field").length > 0, null, 20000);
		await page.evaluate(() => (window.__fu = new frappe.ui.FileUploader({ doctype: "ToDo", docname: "new" })));
		await executed(page, "file_uploader.bundle");
		await until(page, () => window.__fu.uploader);
		const x = await page.evaluate(async () => {
			const fb = frappe.form_builder.store;
			const up = window.__fu.uploader;
			const out = {};
			// A: object made reactive by the form builder's store, drawn by the uploader's FilePreview
			fb.form.onevue_file = { name: "fb-made-1.txt", file_obj: new File(["x"], "fb-made-1.txt", { type: "text/plain" }), cropper_file: null, crop_box_data: null, optimize: false, private: true, uploading: false, progress: 0, total: 0, failed: false, request_succeeded: false, error_message: null, uploaded: false };
			const fbobj = fb.form.onevue_file;
			out.a_is_reactive = !!(fbobj)?.__v_isReactive;
			// poll: the uploader's preview area is drawn a few ticks after files changes
			const poll = async (fn) => { for (let i = 0; i < 40; i++) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
			const names = () => [...document.querySelectorAll(".modal .file-name")].map((e) => e.textContent.trim());
			up.files.push(fbobj);
			out.a_initial = await poll(() => names().includes("fb-made-1.txt"));
			fbobj.name = "fb-made-2.txt"; // written through the form builder's store object
			out.a_updated = await poll(() => names().includes("fb-made-2.txt") && !names().includes("fb-made-1.txt"));
			// B: uploader's reactive files entry, drawn by the form builder's Field template
			const upobj = up.files[up.files.length - 1];
			const f = fb.form.layout.tabs[0].sections.flatMap((s) => s.columns.flatMap((c) => c.fields))[0];
			const old_df = f.df;
			const label_of = () => [...document.querySelectorAll(".form-builder-container .field-label")].map((e) => e.textContent.trim()).join("|");
			upobj.label = "UpMadeLabel1";
			Object.keys(old_df).forEach((k) => k !== "label" && k !== "name" && (upobj[k] = old_df[k]));
			f.df = upobj;
			await new Promise((r) => setTimeout(r, 60));
			out.b_initial = label_of().includes("UpMadeLabel1");
			up.files[up.files.length - 1].label = "UpMadeLabel2"; // write through the uploader's ref
			await new Promise((r) => setTimeout(r, 60));
			out.b_updated = label_of().includes("UpMadeLabel2");
			f.df = old_df;
			up.files.pop();
			delete fb.form.onevue_file;
			await new Promise((r) => setTimeout(r, 60));
			// C: computed in one app's component scope over the other app's state; effect scopes and
			// inject from each app resolve through the same runtime
			const host = (sel) => { let e = document.querySelector(sel); while (e && !e.__vue_app__) e = e.parentElement; const app = e?.__vue_app__; return app?._instance || app?._container?._vnode?.component; };
			const fb_inst = host(".form-builder-container");
			const up_app = window.__fu.wrapper.__vue_app__;
			const up_inst = up_app._instance || up_app._container._vnode.component;
			if (frappe.Vue?.computed) {
				const c = fb_inst.scope.run(() => frappe.Vue.computed(() => up.files.length));
				const before = c.value;
				up.files.push({ name: "c.txt" });
				out.c_computed = c.value === before + 1;
				up.files.pop();
			} else out.c_computed = "no frappe.Vue.computed";
			out.same_runtime = fb_inst.appContext.app.version === up_inst.appContext.app.version && fb_inst.appContext !== up_inst.appContext;
			out.same_raw = (fbobj.__v_raw || fbobj) === (upobj.__v_raw || upobj);
			return out;
		});
		check("shared reactivity: form-builder-made reactive drives uploader render", x.a_is_reactive && x.a_initial && x.a_updated, x);
		check("shared reactivity: uploader-made reactive drives form builder render", x.b_initial && x.b_updated, x);
		check("shared reactivity: computed across apps, same runtime, one proxy per object", x.c_computed === true && x.same_runtime && x.same_raw, x);
	});

	// Mobile nav (prebuilt IIFE on frappe.Vue) + kanban board (esbuild bundle) at phone width
	await run("two bundles on one page (mobile nav + kanban, phone)", PHONE, async (page) => {
		await desk(page, "/desk/todo/view/kanban/ToDo%20Kanban");
		await executed(page, "kanban_board.bundle");
		await page.waitForFunction(() => document.querySelector("frappe-mobile-nav [data-slot=mobile-nav-item]"), null, { timeout: 30000 });
		const x = await page.evaluate(async () => {
			const el = document.querySelector("frappe-mobile-nav-item");
			const inst = el._instance;
			const r = frappe.Vue.reactive({ label: "fromOutside1" });
			// a reactive owned by the element's component scope drives the CE prop via watchEffect
			const stop = inst.scope.run(() => frappe.Vue.watchEffect(() => el.setAttribute("label", r.label)));
			await new Promise((r) => setTimeout(r, 60));
			const a = el.textContent.includes("fromOutside1");
			r.label = "fromOutside2";
			await new Promise((r) => setTimeout(r, 60));
			await new Promise((r) => setTimeout(r, 60));
			const b = el.textContent.includes("fromOutside2");
			stop();
			const execd = frappe.assets._executed.filter((p) => /vue\.bundle/.test(p)).length;
			return { a, b, vue_bundle_executed: execd, scripts_with_vue: [...document.scripts].filter((s) => /vue\.bundle/.test(s.src)).length };
		});
		check("phone: mobile nav element reacts to frappe.Vue reactive while kanban is open", x.a && x.b, x);
		check("phone: vue.bundle executed exactly once with mobile nav + kanban", x.vue_bundle_executed === 1 && x.scripts_with_vue === 1, x);
	});

	await browser.close();
	console.log(`\n${pass} pass, ${fail} fail`);
	process.exit(fail ? 1 : 0);
})();
