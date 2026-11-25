// Shared harness code: sessions, the in-page probe (window.__tw), request capture, generic UI helpers.
// Everything here is variant-agnostic: it reads the public control API (get_value, $input, df, ...) and
// visible semantics (role=option rows, input values, display text), never legacy class names, so the
// same flow runs on legacy, Vue-components (A) and es-* tags (B). Legacy-only structure is recorded
// separately under `structure` so a differ can tell "looks/behaves different" from "markup differs".
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SITES = {
	v5: "http://v5.localhost:8000",
	erp: "http://erp.localhost:8001",
};

// Runs in the page before any script. Defines window.__tw.
function probe() {
	const tw = (window.__tw = { events: [], marks: {} });
	const vis = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
	const text = (el) => (el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : null);
	tw.vis = vis;
	tw.text = text;
	// visible listbox rows anywhere in the page: [role=option] (desk awesomplete, frappe-ui ComboboxItem, ...)
	// or plain <li> rows of a [role=listbox] (web-form awesomplete). Outermost match only.
	const rows = () => {
		const all = [...document.querySelectorAll('[role="option"], [role="listbox"] > li')].filter(vis);
		return all.filter((el) => !all.some((o) => o !== el && o.contains(el)));
	};
	tw.options = () => rows().map((el) => text(el)).filter((t) => t !== null);
	tw.active_option = () => {
		const el = rows().find(
			(o) => o.getAttribute("aria-selected") === "true" || o.hasAttribute("data-highlighted") ||
				!!o.querySelector('[aria-selected="true"]') || o.parentElement?.getAttribute("aria-selected") === "true"
		);
		return el ? text(el) : null;
	};
	tw.listbox_open = () => tw.options().length > 0;
	const EVENTS =
		"focus blur change input awesomplete-open awesomplete-close awesomplete-select awesomplete-selectcomplete select-change";
	tw.watch = (ctl, label) => {
		if (!ctl) return "no control";
		if (!ctl.$input || !ctl.$input.on) return "no $input";
		ctl.$input.on(EVENTS, (e) => tw.events.push(`${label}:${e.type}`));
		return "ok";
	};
	tw.drain = () => tw.events.splice(0);
	tw.safe = (fn) => {
		try {
			const v = fn();
			return v instanceof Promise ? "<promise>" : v === undefined ? "<undefined>" : v;
		} catch (e) {
			return "<throws: " + e.message + ">";
		}
	};
	// Public surface a control must keep (compat/CONTRACT.md 2.3 + wc/three-ways/contract/CONTRACT.md)
	const METHODS = [
		"set_value", "get_value", "refresh", "refresh_input", "set_input", "set_focus", "toggle_label",
		"toggle_description", "set_label", "set_description", "get_input_value", "get_label_value",
		"set_formatted_input", "validate", "parse", "format_for_input", "new_doc", "open_advanced_search",
		"get_options", "set_options", "set_custom_query", "get_search_args", "set_link_title",
		"is_translatable", "is_title_link", "toggle", "set_mandatory", "set_invalid",
	];
	tw.api = (ctl) => {
		if (!ctl) return null;
		const chain = [];
		// production builds minify class names: name each class by its frappe.ui.form key
		const names = new Map(Object.entries(frappe.ui.form).filter(([, v]) => typeof v === "function").map(([k, v]) => [v, k]));
		for (let p = Object.getPrototypeOf(ctl); p && p.constructor && p.constructor !== Object; p = Object.getPrototypeOf(p))
			chain.push(names.get(p.constructor) || p.constructor.name || "?");
		const j = (x) => !!x && x instanceof jQuery;
		const el = (x) => x instanceof HTMLElement;
		return {
			chain: chain.slice(0, 6),
			methods: METHODS.filter((m) => typeof ctl[m] === "function"),
			$input: j(ctl.$input) && ctl.$input.length === 1,
			input_el: el(ctl.input),
			input_is_$input: !!ctl.$input && ctl.$input[0] === ctl.input,
			input_tag: ctl.input ? ctl.input.tagName.toLowerCase() + (ctl.input.type ? ":" + ctl.input.type : "") : null,
			$wrapper: j(ctl.$wrapper),
			wrapper_el: el(ctl.wrapper),
			wrapper_fieldobj: !!ctl.wrapper && ctl.wrapper.fieldobj === ctl,
			disp_area_el: el(ctl.disp_area),
			input_area_el: el(ctl.input_area),
			awesomplete: !!ctl.awesomplete,
			awesomplete_ul_el: !!ctl.awesomplete && el(ctl.awesomplete.ul),
			awesomplete_close_fn: !!ctl.awesomplete && typeof ctl.awesomplete.close === "function",
			awesomplete_list_prop: !!ctl.awesomplete && "list" in ctl.awesomplete,
			awesomplete_isOpened_prop: !!ctl.awesomplete && "isOpened" in ctl.awesomplete,
			$link: j(ctl.$link),
			$link_open: j(ctl.$link_open),
			df_is_object: !!ctl.df && typeof ctl.df === "object",
			data_target: ctl.$input && ctl.$input.attr ? ctl.$input.attr("data-target") || null : null,
			data_fieldname: ctl.$input && ctl.$input.attr ? ctl.$input.attr("data-fieldname") || null : null,
		};
	};
	// Markup apps reach into (contract §DOM). Legacy-specific; a variant may differ here and still pass if
	// it keeps the selectors working.
	tw.structure = (ctl) => {
		if (!ctl || !ctl.$wrapper) return null;
		const w = ctl.$wrapper;
		return {
			frappe_control: w.hasClass("frappe-control"),
			data_fieldtype: w.attr("data-fieldtype") || null,
			data_fieldname: w.attr("data-fieldname") || null,
			control_input: w.find(".control-input").length,
			control_value: w.find(".control-value").length,
			link_field: w.find(".link-field").length,
			link_btn: w.find(".link-btn").length,
			btn_open: w.find(".btn-open").length,
			btn_clear: w.find(".btn-clear").length,
			awesomplete_div: w.find(".awesomplete").length,
			select_el: w.find("select").length,
			select_icon: w.find(".select-icon").length,
			input_with_feedback: w.find(".input-with-feedback").length,
		};
	};
	tw.state = (ctl) => {
		if (!ctl) return null;
		const $i = ctl.$input;
		const s = {
			get_value: tw.safe(() => ctl.get_value()),
			model: ctl.doc && ctl.df ? (ctl.doc[ctl.df.fieldname] ?? null) : "<no doc>",
			input_value: $i && $i.val ? $i.val() : null,
			input_visible: !!$i && $i.length > 0 && vis($i[0]),
			input_disabled: !!$i && $i.prop && !!$i.prop("disabled"),
			wrapper_visible: !!ctl.$wrapper && ctl.$wrapper.length > 0 && vis(ctl.$wrapper[0]),
			disp_visible: vis(ctl.disp_area),
			disp_text: ctl.disp_area && vis(ctl.disp_area) ? text(ctl.disp_area) : null,
			disp_href: ctl.disp_area ? ($(ctl.disp_area).find("a").attr("href") || null) : null,
			label: ctl.$wrapper ? text(ctl.$wrapper.find("label")[0]) : null,
		};
		if ($i && $i.is && $i.is("select")) {
			s.select_options = $i.find("option").toArray().map((o) => [o.value, text(o)]);
			s.selected_text = text($i.find("option:selected")[0]);
		}
		return s;
	};
}

async function open(site = "v5", { viewport = { width: 1400, height: 900 }, browser: shared } = {}) {
	const base = SITES[site];
	const browser = shared || (await chromium.launch());
	const ctx = await browser.newContext({ viewport });
	const r = await ctx.request.post(base + "/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	if (!r.ok()) throw new Error("login " + site + " " + r.status());
	await ctx.addInitScript(probe);
	const page = await ctx.newPage();
	const rec = { errors: [], requests: [], pending: 0 };
	page.on("pageerror", (e) => rec.errors.push("pageerror: " + e.message.slice(0, 300)));
	page.on("console", (m) => {
		const t = m.text();
		if ((m.type() === "error" || /Vue warn/.test(t)) && !/socket\.io|ERR_CONNECTION|favicon/.test(t))
			rec.errors.push(m.type() + ": " + t.slice(0, 300));
	});
	const WATCH = /search_link|validate_link|get_link_title|frappe\.client\.get_list|search_widget/;
	page.on("request", (req) => {
		const u = req.url();
		if (!WATCH.test(u)) return;
		rec.pending++;
		const url = new URL(u);
		const params = Object.fromEntries(url.searchParams);
		let body = {};
		try {
			const pd = req.postData();
			if (pd) body = pd.trim().startsWith("{") ? JSON.parse(pd) : Object.fromEntries(new URLSearchParams(pd));
		} catch {}
		const a = { ...params, ...body };
		const method = (url.pathname.match(/api\/method\/(.+)$/) || [])[1] || url.pathname;
		const parse = (x) => {
			try { return typeof x === "string" && /^[[{]/.test(x) ? JSON.parse(x) : x; } catch { return x; }
		};
		rec.requests.push({
			method: method.replace(/^frappe\.desk\.search\.|^frappe\.client\./, ""),
			http: req.method(),
			doctype: a.doctype ?? null,
			txt: a.txt ?? a.docname ?? null,
			query: a.query ?? null,
			filters: parse(a.filters) ?? null,
			reference_doctype: a.reference_doctype ?? null,
			link_fieldname: a.link_fieldname ?? null,
		});
	});
	const done = (req) => WATCH.test(req.url()) && rec.pending--;
	page.on("requestfinished", done);
	page.on("requestfailed", done);
	return { browser, ctx, page, rec, base, site, own: !shared };
}

// wait until watched requests are done and the visible option list is stable for `quiet` ms
async function settle(page, rec, { quiet = 350, max = 6000 } = {}) {
	const t0 = Date.now();
	let last = null, since = Date.now();
	while (Date.now() - t0 < max) {
		const cur = JSON.stringify(await page.evaluate(() => window.__tw.options()).catch(() => null));
		if (cur !== last || rec.pending > 0) { last = cur; since = Date.now(); }
		else if (Date.now() - since >= quiet) return;
		await page.waitForTimeout(60);
	}
}

async function wait_form(page, doctype, timeout = 60000) {
	await page.waitForFunction(
		(dt) => window.cur_frm && cur_frm.doctype === dt && cur_frm.layout && cur_frm.layout.wrapper && cur_frm.layout.wrapper.is(":visible"),
		doctype,
		{ timeout }
	);
	await page.waitForTimeout(400);
}

// A flow is a list of named steps; each returns an observation object (JSON). A step that throws is
// recorded as {error} and the flow continues with the next step.
function recorder(page, rec, flow, outdir) {
	const steps = [];
	let req_mark = 0, err_mark = 0;
	return {
		steps,
		async step(name, fn) {
			const t0 = Date.now();
			req_mark = rec.requests.length;
			err_mark = rec.errors.length;
			let obs;
			try {
				obs = await fn();
			} catch (e) {
				obs = { error: (e.message || String(e)).split("\n")[0].slice(0, 300) };
			}
			const events = await page.evaluate(() => window.__tw && window.__tw.drain()).catch(() => []);
			const fallbacks = await page.evaluate(() => (window.__tw && window.__tw.fallbacks ? window.__tw.fallbacks.splice(0) : [])).catch(() => []);
			steps.push({
				name,
				obs,
				events,
				fallbacks,
				requests: rec.requests.slice(req_mark),
				errors: rec.errors.slice(err_mark),
				ms: Date.now() - t0,
			});
			return obs;
		},
		async shot(name) {
			if (!outdir) return;
			fs.mkdirSync(path.join(outdir, "shots"), { recursive: true });
			await page.screenshot({ path: path.join(outdir, "shots", `${flow}--${name}.png`) }).catch(() => {});
		},
	};
}

module.exports = { SITES, open, settle, wait_form, recorder, probe };
