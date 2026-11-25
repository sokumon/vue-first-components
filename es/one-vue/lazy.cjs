// Checks for the follow-up fixes on one-vue: website pages, web form Attach upload, print page,
// lazy FileUploader on Desk. Run: NODE_PATH=~/fb/pw/node_modules node lazy.cjs
const { chromium } = require("playwright");
const base = "http://v5.localhost:8000";
let pass = 0, fail = 0;
const check = (name, ok, info) => {
	ok ? pass++ : fail++;
	console.log(`${ok ? "ok  " : "FAIL"} ${name}${info !== undefined ? "  " + JSON.stringify(info).slice(0, 600) : ""}`);
};
const STATE = () => ({
	vue: !!window.frappe?.Vue,
	uploader_class: typeof window.frappe?.ui?.FileUploader,
	component: !!window.frappe?.ui?.file_uploader_component,
	scripts: [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src").replace(/^.*\//, "")),
});
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

(async () => {
	const browser = await chromium.launch();
	const run = async (label, user, steps, { allow = [] } = {}) => {
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
		if (user) {
			const r = await ctx.request.post(base + "/api/method/login", { form: { usr: user, pwd: "admin" } });
			if (!r.ok()) throw new Error("login " + r.status());
		}
		const page = await ctx.newPage();
		const errors = [];
		const requested = [];
		page.on("request", (r) => requested.push(r.url().replace(/^.*\//, "")));
		page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 300) + " @ " + (e.stack || "").split("\n")[1]?.trim().slice(0, 160)));
		page.on("console", (m) => {
			if ((m.type() === "error" || /Vue warn|frappe\.Vue/.test(m.text())) && !/socket\.io|status of 4\d\d/.test(m.text()))
				errors.push(m.type() + ": " + m.text().slice(0, 300));
		});
		try {
			await steps(page, ctx, requested);
		} catch (e) {
			check(label + ": steps ran", false, e.message.slice(0, 400));
		}
		const spike = errors.filter((e) => /vue_first8?\.bundle/.test(e) || /Class extends value undefined/.test(e));
		const real = errors.filter((e) => !spike.includes(e) && !allow.some((re) => re.test(e)));
		check(label + ": no console errors (v8 spike errors listed apart)", real.length === 0, { real, spike });
		await ctx.close();
	};
	const vue_bundles = (requested) => requested.filter((u) => /^(vue|file_uploader)\.bundle\./.test(u));

	// ------------------------------------------------------------------ website pages
	for (const [route, user] of [["/login", null], ["/me", "Administrator"]]) {
		await run("website " + route, user, async (page, ctx, requested) => {
			await page.goto(base + route, { waitUntil: "load" });
			await page.waitForTimeout(1500);
			const s = await page.evaluate(STATE);
			check(`website ${route}: FileUploader defined, Vue not downloaded at startup`, s.uploader_class === "function" && !s.vue && vue_bundles(requested).length === 0, { ...s, fetched: vue_bundles(requested) });
			await page.evaluate(() => {
				window.__fu = new frappe.ui.FileUploader({ allow_multiple: false, as_dataurl: true });
			});
			const ok = await until(page, () => window.__fu?.uploader && document.querySelector(".file-upload-area"));
			const s2 = await page.evaluate(STATE);
			check(`website ${route}: new FileUploader loads vue.bundle then the uploader and mounts`, ok && s2.vue, { ...s2, fetched: vue_bundles(requested) });
			const order = vue_bundles(requested);
			check(`website ${route}: vue.bundle requested before file_uploader.bundle`, order.length === 2 && /^vue/.test(order[0]), order);
		});
	}

	// ------------------------------------------------------------------ web form with an Attach Image field
	await run("web form /update-profile (Attach Image)", "frappe@example.com", async (page, ctx, requested) => {
		await page.goto(base + "/update-profile/frappe@example.com/edit", { waitUntil: "load" });
		await until(page, () => window.frappe?.web_form?.fields_dict?.user_image, null, 20000);
		const s = await page.evaluate(STATE);
		check("web form: FileUploader defined, Vue not downloaded at startup", s.uploader_class === "function" && !s.vue, { ...s, fetched: vue_bundles(requested) });
		await page.locator('[data-fieldname="user_image"] button.btn-attach, [data-fieldname="user_image"] .btn-attach').first().click();
		const drawn = await until(page, () => document.querySelector(".modal .file-upload-area"));
		check("web form: Attach button opens the uploader (lazy load)", drawn, { fetched: vue_bundles(requested) });
		await page.locator(".modal:visible input[type=file]").first().setInputFiles({ name: "onevue-webform.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
		const listed = await until(page, () => [...document.querySelectorAll(".modal .file-name")].some((e) => e.textContent.includes("onevue-webform")));
		const modal = await page.evaluate(() => {
			const m = [...document.querySelectorAll(".modal")].find((m) => m.querySelector(".file-upload-area"));
			return { listed: !!m?.querySelector(".file-name"), primary: m?.querySelector(".btn-modal-primary")?.outerHTML.slice(0, 200), footer_hidden: m?.querySelector(".modal-footer")?.classList.contains("hide"), text: m?.innerText.slice(0, 300) };
		});
		if (!listed) console.log("modal state", JSON.stringify(modal));
		const upload = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("upload_file"), { timeout: 20000 }).catch((e) => ({ error: e.message }));
		await page.locator(".modal", { has: page.locator(".file-upload-area") }).locator(".modal-footer").getByRole("button", { name: "Upload", exact: true }).click({ timeout: 10000 }).catch(async (e) => console.log("click failed", e.message.slice(0, 300), await page.evaluate(() => [...document.querySelectorAll(".modal")].find((m) => m.querySelector(".file-upload-area"))?.querySelector(".modal-footer")?.outerHTML.slice(0, 800))));
		const res = await upload.then((r) => (r.error ? r : r.json().then((j) => ({ status: r.status(), file_url: j.message?.file_url, name: j.message?.name }))));
		const value = await until(page, () => /onevue-webform/.test(frappe.web_form.get_value("user_image") || ""), null, 10000);
		check("web form: file uploads and the Attach field gets its URL", res.status === 200 && value, res);
		if (res.name) await ctx.request.post(base + "/api/method/frappe.client.delete", { form: { doctype: "File", name: res.name } });
	});

	// ------------------------------------------------------------------ print page
	await run("print page", "Administrator", async (page, ctx, requested) => {
		await page.goto(base + "/printview?doctype=ToDo&name=1001&format=Standard", { waitUntil: "load" });
		await page.waitForTimeout(1500);
		const p = await page.evaluate(() => ({ body: document.querySelector(".print-format-doc, .print-format")?.innerText.length || 0, vue: !!window.frappe?.Vue }));
		check("print page /printview: renders", p.body > 0, { ...p, fetched: vue_bundles(requested) });
		await page.goto(base + "/desk/print/ToDo/1001", { waitUntil: "load" });
		const shown = await until(page, () => frappe.get_route()[0] === "print" && [...document.querySelectorAll(".print-preview-wrapper iframe, .print-preview iframe, iframe")].some((f) => (f.contentDocument?.body?.innerText || "").trim().length > 0), null, 30000);
		check("print page /desk/print: preview renders", shown, { fetched: vue_bundles(requested) });
	});

	// ------------------------------------------------------------------ desk: lazy uploader
	await run("desk lazy uploader", "Administrator", async (page, ctx, requested) => {
		await page.goto(base + "/desk/todo/1001", { waitUntil: "load" });
		await page.waitForFunction(() => window.cur_frm?.doc?.name === "1001", null, { timeout: 30000 });
		await page.waitForTimeout(1500);
		const s = await page.evaluate(STATE);
		check("desk: FileUploader is the eager class, uploader bundle not downloaded at startup", s.uploader_class === "function" && !s.component && !requested.some((u) => /^file_uploader\.bundle/.test(u)), { ...s, fetched: vue_bundles(requested) });
		// sidebar "Attach File" -> attachments.js -> new frappe.ui.FileUploader
		const opened = await page.evaluate(() => {
			const shown = [];
			const show = frappe.ui.Dialog.prototype.show;
			frappe.ui.Dialog.prototype.show = function () {
				shown.push(this.title);
				return show.apply(this, arguments);
			};
			cur_frm.attachments.new_attachment();
			frappe.ui.Dialog.prototype.show = show;
			return { dialog_now: shown.includes(__("Upload")), shown, uploader_now: !!document.querySelector(".file-upload-area") };
		});
		check("desk: dialog shows synchronously on the first new FileUploader", opened.dialog_now, opened);
		const drawn = await until(page, () => document.querySelector(".modal .file-upload-area"));
		check("desk: component mounts after the lazy load", drawn, { fetched: vue_bundles(requested) });
		await page.locator(".modal:visible input[type=file]").first().setInputFiles({ name: "onevue-desk.txt", mimeType: "text/plain", buffer: Buffer.from("one vue lazy") });
		await until(page, () => [...document.querySelectorAll(".modal .file-name")].some((e) => e.textContent.includes("onevue-desk")));
		const upload = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("upload_file"), { timeout: 20000 }).catch((e) => ({ error: e.message }));
		await page.locator(".modal:visible .btn-modal-primary").click({ timeout: 10000 });
		const res = await upload.then((r) => (r.error ? r : r.json().then((j) => ({ status: r.status(), name: j.message?.name, attached_to: j.message?.attached_to_name }))));
		check("desk: upload attaches the file to the ToDo", res.status === 200 && res.attached_to === "1001", res);
		if (res.name) await ctx.request.post(base + "/api/method/frappe.client.delete", { form: { doctype: "File", name: res.name } });
		await page.keyboard.press("Escape");
		await until(page, () => !window.cur_dialog?.display, null, 5000);
		// second uploader: mounts synchronously now that the bundle is here
		const second = await page.evaluate(() => {
			const fu = new frappe.ui.FileUploader({ doctype: "ToDo", docname: "1001" });
			const sync = !!fu.uploader;
			fu.dialog.hide();
			return { sync, instanceof: fu instanceof frappe.ui.FileUploader, ready: fu.ready instanceof Promise };
		});
		check("desk: a later FileUploader mounts synchronously (uploader set in the constructor)", second.sync && second.instanceof && second.ready, second);
		const once = await page.evaluate(() => ({
			vue: frappe.assets._executed.filter((p) => /vue\.bundle/.test(p)).length,
			fu: frappe.assets._executed.filter((p) => /file_uploader\.bundle/.test(p)).length,
			scripts: [...document.scripts].filter((s) => /(vue|file_uploader)\.bundle/.test(s.src)).length,
		}));
		check("desk: vue.bundle and file_uploader.bundle each ran once", once.vue <= 1 && once.fu === 1 && once.scripts === 2, once);
		// concurrent first uses share one in-flight load
	});
	await run("desk concurrent first uses", "Administrator", async (page, ctx, requested) => {
		await page.goto(base + "/desk/todo", { waitUntil: "load" });
		await page.waitForFunction(() => window.frappe?.get_current_page?.(), null, { timeout: 30000 });
		await page.waitForTimeout(1000);
		const r = await page.evaluate(async () => {
			const wrappers = [1, 2, 3].map(() => {
				const d = document.createElement("div");
				document.body.append(d);
				return d;
			});
			const fus = wrappers.map((wrapper) => new frappe.ui.FileUploader({ wrapper, as_dataurl: true }));
			await Promise.all(fus.map((f) => f.ready));
			return {
				mounted: fus.every((f) => f.uploader && f.wrapper.querySelector(".file-upload-area")),
				wrapper_ready: fus.every((f) => f.uploader.wrapper_ready),
				scripts: [...document.scripts].filter((s) => /(vue|file_uploader)\.bundle/.test(s.src)).length,
			};
		});
		check("desk: three concurrent first FileUploaders share one load and all mount", r.mounted && r.wrapper_ready && r.scripts <= 2, { ...r, fetched: vue_bundles(requested) });
	});

	// ------------------------------------------------------------------ scratch jsx-runtime + compiler-build bundle
	await run("scratch jsx bundle", "Administrator", async (page) => {
		await page.goto(base + "/desk/todo", { waitUntil: "load" });
		await page.waitForFunction(() => window.frappe?.get_current_page?.(), null, { timeout: 30000 });
		await page.evaluate(() => frappe.require("vue.bundle.js"));
		await page.addScriptTag({ content: require("fs").readFileSync(__dirname + "/jsx-test.bundle.js", "utf8") });
		const r = await page.evaluate(async () => {
			const t = window.__jsx_test;
			const el = document.createElement("div");
			document.body.append(el);
			const n = window.__jsx_mount(el);
			const first = el.textContent;
			n.value++;
			await frappe.Vue.nextTick();
			return {
				same_createApp: t.createApp === frappe.Vue.createApp,
				same_fragment: t.Fragment === frappe.Vue.Fragment,
				full_is_shared: t.full_createApp === frappe.Vue.createApp && t.full_ref === frappe.Vue.ref,
				rendered: first,
				rerendered: el.textContent,
			};
		});
		check("scratch: vue/jsx-runtime and vue.esm-bundler.js use frappe.Vue; jsx renders and re-renders", r.same_createApp && r.same_fragment && r.full_is_shared && r.rendered === "jsx 1" && r.rerendered === "jsx 2", r);
	});

	await browser.close();
	console.log(`\n${pass} pass, ${fail} fail`);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
