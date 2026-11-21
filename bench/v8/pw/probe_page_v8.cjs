// frappe.ui.Page port (vue-first-components/v8/ui/Page.vue), in mode v8page.
// Each check builds a v8 page and, where it compares markup, a page.js page (frappe.ui.LegacyPage, kept
// by the bundle) with the same calls, and compares their DOM: tags, classes and the attributes that
// style or identify elements (whitespace and the order of attributes aside).
//   P1  new Page draws synchronously, with legacy's DOM (two column, single column, sidebar right)
//   P2  set_title / set_indicator / clear_indicator
//   P3  set_primary_action / set_secondary_action / clear_*; a button hidden from outside comes back
//   P4  add_inner_button with groups; a held $btn keeps .addClass across re-renders; remove_inner_button,
//       change_inner_button_type, add_divider_to_button_group, set_inner_btn_group_as_primary, clear_inner_toolbar
//   P5  add_menu_item / add_dropdown_item / add_divider / clear_menu; the Dropdown's rows equal legacy's
//   P6  add_action_item / clear_actions_menu; add_button; add_custom_button_group; add_action_icon; add_inner_message
//   P7  add_field draws a v8 control in the toolbar form; get_form_values; clear_fields
//   P8  jQuery .remove() / .empty() of drawn items, then further updates: no throw, state follows the DOM
//   P9  a no-op re-render writes no DOM
//   P10 the real desk: list, form, report, workspace pages are v8 pages and work
//   P11 timing: page creation and a form-refresh-like update cycle, v8 vs page.js
//   P12 regressions from the break reports (R1-R8): content replaced with .text()/textContent/innerHTML/
//       innerText/replaceChildren keeps the page working (System Console's Execute too); the user-action
//       divider after .empty() or its removal; the inner message's place; flush cost independent of the
//       page's size; add_field controls destroyed with $(parent).empty()/.html(); DOM facts legacy
//       rewrote on every call; elements a caller moved out stay; $parts does not grow
// Run with TIMING_ONLY=1 in mode legacy to time page.js alone (mode switch comparison).
const { open } = require("./session.cjs");
let pass = 0, fail = 0;
const check = (name, ok, info) => {
	ok ? pass++ : fail++;
	console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && info !== undefined ? "  " + JSON.stringify(info).slice(0, 700) : ""}`);
};
const TIMING_ONLY = process.env.TIMING_ONLY === "1";

(async () => {
	const { browser, page, errors, base } = await open();
	const q = (fn, arg) => page.evaluate(fn, arg);
	const desk = async (route) => {
		await page.goto(base + route, { waitUntil: "load" });
		await page.waitForFunction(() => frappe.get_current_page?.()?.main, null, { timeout: 30000 });
		await page.waitForTimeout(1500);
	};
	await desk("/desk/todo");

	// helpers inside the page (again after every navigation)
	const helpers = () => q(() => {
		const ATTRS = ["type", "role", "data-variant", "data-size", "data-theme", "data-icon-button", "title", "aria-label", "aria-current", "hidden", "data-testid", "data-label", "data-working-label", "href", "stroke", "tabindex", "data-fieldname", "data-fieldtype", "aria-live", "aria-hidden", "onclick", "placeholder"];
		window.__sig = (el) => {
			if (!el) return null;
			if (el.nodeType === 3) return el.data.trim() ? "#" + el.data.trim() : null;
			if (el.nodeType !== 1) return null;
			const cls = [...el.classList].sort().join(".");
			const attrs = ATTRS.filter((a) => el.hasAttribute(a) && !(a === "title" && el.getAttribute(a) === "")).map((a) => `${a}=${el.getAttribute(a)}`);
			const style = el.style.display === "none" ? ["display:none"] : [];
			const kids = [...el.childNodes].map(__sig).filter(Boolean);
			return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${attrs.length ? "[" + attrs.join(",") + "]" : ""}${style.length ? "{" + style + "}" : ""}>` + (kids.length ? "(" + kids.join(" ") + ")" : "");
		};
		window.__host = () => {
			const d = document.createElement("div");
			d.className = "probe-host";
			document.body.appendChild(d);
			return d;
		};
		window.__route_page = frappe.ui.pages[frappe.get_route_str()];
		window.__restore = () => (frappe.ui.pages[frappe.get_route_str()] = window.__route_page);
		// first difference of two signatures, for the report
		window.__diff = (a, b) => {
			if (a === b) return null;
			let i = 0;
			while (i < a.length && a[i] === b[i]) i++;
			return { at: i, v8: a.slice(Math.max(0, i - 120), i + 200), legacy: b.slice(Math.max(0, i - 120), i + 200) };
		};
	});
	await helpers();

	const mode = await q(() => ({ v8: !!frappe.ui.Page.prototype.flush, legacy: !!frappe.ui.LegacyPage }));
	if (!TIMING_ONLY && !mode.v8) {
		console.log("not in mode v8page (frappe.ui.Page is page.js's): run ~/fb/pwt/mode.sh v8page");
		process.exit(1);
	}

	if (!TIMING_ONLY) {
		// ------------------------------------------------------------------ P1
		const p1 = await q(() => {
			const out = [];
			for (const opts of [{ title: "Probe" }, { title: "Probe", single_column: true }, { title: "Probe", sidebar_position: "Right" }]) {
				const h1 = __host(), h2 = __host();
				const v = new frappe.ui.Page({ parent: h1, ...opts });
				const sync = !!(v.main && v.main[0]?.isConnected && h1.querySelector(".page-head .primary-action") && v.btn_primary[0] === h1.querySelector(".primary-action"));
				const l = new frappe.ui.LegacyPage({ parent: h2, ...opts });
				out.push({ opts, sync, same: __sig(h1) === __sig(h2), diff: __diff(__sig(h1), __sig(h2)), v8: !!v.$fui, fields: ["body", "main", "container", "sidebar", "footer", "indicator", "page_actions", "filters", "page_head", "btn_primary", "btn_primary_menu", "btn_secondary", "menu", "menu_btn_group", "actions", "actions_btn_group", "standard_actions", "custom_actions", "custom_mobile_actions", "page_form", "inner_toolbar", "icon_group", "$title_area", "$breadcrumbs"].filter((k) => !(v[k] instanceof $) || v[k].length !== l[k].length) });
				h1.remove(), h2.remove();
			}
			__restore();
			return out;
		});
		for (const r of p1) check(`P1 new Page(${JSON.stringify(r.opts)}) is drawn when new returns, with page.js's DOM and jQuery fields`, r.sync && r.same && r.v8 && !r.fields.length, r);

		// one scenario run on both classes; the DOM compared after every step
		const scenario = async (name, steps) => {
			const res = await q(
				({ steps }) => {
					const h1 = __host(), h2 = __host();
					const v = new frappe.ui.Page({ parent: h1, title: "Scenario" });
					const l = new frappe.ui.LegacyPage({ parent: h2, title: "Scenario" });
					const log = [];
					const out = { steps: [] };
					try {
						for (const src of steps) {
							const fn = new Function("page", "log", src);
							const a = fn(v, log);
							const b = fn(l, log);
							const sv = __sig(h1), sl = __sig(h2);
							out.steps.push({ src: src.slice(0, 80), same: sv === sl, diff: __diff(sv, sl), ret: a instanceof $ && b instanceof $ ? [a.length, b.length, __sig(a[0]) === __sig(b[0])] : null });
						}
					} catch (e) {
						out.error = e.stack;
					}
					out.v8_menu = v.build_dropdown_options(v.menu).map((o) => JSON.stringify(o, (k, x) => (typeof x === "function" ? "fn" : x)));
					out.legacy_menu = l.build_dropdown_options(l.menu).map((o) => JSON.stringify(o, (k, x) => (typeof x === "function" ? "fn" : x)));
					out.log = log;
					window.__last = { v, l, h1, h2 };
					h1.remove(), h2.remove();
					__restore();
					return out;
				},
				{ steps }
			);
			const bad = res.steps.filter((s) => !s.same || (s.ret && !(s.ret[0] === s.ret[1] && s.ret[2])));
			check(`${name}: same DOM as page.js after each of ${res.steps.length} steps, same returned elements`, !res.error && !bad.length, res.error || bad);
			return res;
		};

		// ------------------------------------------------------------------ P2
		await scenario("P2 set_title / set_indicator / clear_indicator", [
			`page.set_title("Hello <b>World</b>")`,
			`page.set_indicator("Draft", "red")`,
			`page.set_indicator("Paid <i>x</i>", "green")`,
			`page.indicator.addClass("caller-class"); page.clear_indicator()`,
			`page.set_indicator("Open", "orange")`,
			`page.set_breadcrumbs([{ label: "Home", href: "/desk" }, { label: "Mid", onclick() {} }, { label: "Last" }])`,
			`page.set_title("Again", "home", true, "", "Tip")`,
			`page.show_breadcrumbs = false; page.render_breadcrumbs(); page.show_breadcrumbs = true; page.render_breadcrumbs();`,
		]);

		// ------------------------------------------------------------------ P3
		await scenario("P3 primary / secondary actions", [
			`return page.set_primary_action("Save", () => log.push("save"), "add")`,
			`return page.set_secondary_action({ label: "Add Sales Order", short_label: "Add" }, () => log.push("sec"))`,
			`page.btn_primary.trigger("click"); page.btn_secondary.trigger("click")`,
			`page.set_primary_action("Submit", () => log.push("submit"), null, "Working...")`,
			`page.btn_primary.addClass("hide"); page.btn_primary.prop("disabled", true); page.set_primary_action("Save", () => log.push("save2"))`,
			`page.set_primary_action({ label: "New", options: [{ label: "A", onclick() {} }] }, () => {})`,
			`page.clear_primary_action()`,
			`page.btn_primary.trigger("click")`,
			`page.clear_secondary_action()`,
			`page.set_primary_action("Save", () => log.push("save3")); page.clear_actions()`,
		]).then((r) => check("P3 clicks reach the current handler only, cleared buttons do nothing", JSON.stringify(r.log) === JSON.stringify(["save", "sec", "save", "sec"]), r.log));

		// ------------------------------------------------------------------ P4
		await scenario("P4 inner buttons and groups", [
			`return page.add_inner_button("Refresh", () => log.push("refresh"))`,
			`return page.add_inner_button("Edit", () => log.push("edit"), "Tools")`,
			`return page.add_inner_button("Delete", () => log.push("delete"), "Tools", "default", true)`,
			`page.add_divider_to_button_group("Tools")`,
			`return page.add_inner_button("Refresh", () => log.push("dup"))`,
			`page.add_inner_button("Danger", () => {}, null, "danger")`,
			`page.change_inner_button_type("Refresh", null, "primary")`,
			`page.change_inner_button_type("Edit", "Tools", "danger")`,
			`page.set_inner_btn_group_as_primary("Tools")`,
			`page.remove_inner_button("Danger")`,
			`page.remove_inner_button("Delete", "Tools")`,
			`page.add_inner_button("X", () => {}, "Solo"); page.remove_inner_button("X", "Solo")`,
			`page.custom_actions.append('<div class="caller-thing">c</div>'); page.add_inner_button("After", () => {})`,
			`page.clear_inner_toolbar()`,
			`page.add_inner_button("Again", () => {})`,
		]);
		const p4 = await q(() => {
			const h = __host();
			const p = new frappe.ui.Page({ parent: h, title: "P4" });
			const log = [];
			const $btn = p.add_inner_button("Held", () => log.push("held"));
			$btn.addClass("caller-class");
			const $a = p.add_inner_button("Item", () => log.push("item"), "Grp");
			$a.addClass("caller-item");
			// later re-renders: more items, a type change, an indicator
			for (let i = 0; i < 5; i++) p.add_inner_button("More " + i, () => {});
			p.add_inner_button("Item 2", () => {}, "Grp");
			p.change_inner_button_type("Held", null, "danger");
			p.set_indicator("x", "blue");
			const survived = $btn[0].isConnected && $btn.hasClass("caller-class") && $btn.attr("data-theme") === "red" && $a[0].isConnected && $a.hasClass("caller-item");
			$btn.trigger("click");
			$a.trigger("click");
			// the group's Dropdown snapshot sees the held item
			const rows = p.build_inner_group_options(p.get_inner_group_button("Grp").children(".dropdown-menu")).map((r) => r.label);
			const same_el = p.custom_actions.find('button[data-label="Held"]')[0] === $btn[0];
			h.remove();
			__restore();
			return { survived, log, rows, same_el };
		});
		check("P4 a held $btn / group item keeps .addClass and stays the same element across later re-renders; clicks run", p4.survived && p4.same_el && p4.log.join() === "held,item" && p4.rows.join() === "Item,Item 2", p4);

		// ------------------------------------------------------------------ P5
		const p5 = await scenario("P5 menu items", [
			`return page.add_menu_item("Print", () => log.push("print"), true)`,
			`return page.add_menu_item("Email <b>x</b>", () => {}, false)`,
			`return page.add_menu_item("Print", () => {}, true)`,
			`page.add_divider()`,
			`return page.add_dropdown_item({ label: "Grouped", click() {}, parent: page.menu, group: "Heading", icon: "edit" })`,
			`return page.add_menu_item("User 2", () => {}, false)`,
			`page.menu.append('<li><a class="grey-link dropdown-item">Raw</a></li>')`,
			`page.hide_menu(); page.show_menu()`,
			`page.add_inner_button("Mobile", () => {}, "Grp")`,
			`page.clear_user_actions()`,
			`return page.add_menu_item("After clear", () => {}, false)`,
			`page.clear_menu()`,
			`return page.add_menu_item("Fresh", () => {}, true)`,
		]);
		check("P5 the Menu dropdown's rows equal page.js's", JSON.stringify(p5.v8_menu) === JSON.stringify(p5.legacy_menu), { v8: p5.v8_menu, legacy: p5.legacy_menu });

		// ------------------------------------------------------------------ P6
		await scenario("P6 actions menu, add_button, custom groups, icons, inner message", [
			`return page.add_action_item("Approve", () => {})`,
			`return page.add_actions_menu_item("Reject", () => {}, false, null, "x", "red")`,
			`page.hide_actions_menu(); page.show_actions_menu()`,
			`page.clear_actions_menu()`,
			`return page.add_action_item("Again", () => {}, true, "edit")`,
			`return page.add_button("Report", () => log.push("report"), { btn_class: "btn-primary", icon: "edit" })`,
			`return page.add_button("Custom", () => {}, { btn_class: "btn-custom-hook", btn_size: "btn-xs" })`,
			`const s = page.add_custom_button_group("Views", "list"); page.add_custom_menu_item(s, "One", () => {}); return page.add_custom_menu_item(s, "Two", () => {}, true)`,
			`return page.add_custom_button_group("Plain")`,
			`return page.add_action_icon("refresh", () => {}, "extra", "Reload")`,
			`return page.add_action_icon("printer", () => {})`,
			`page.hide_icon_group(); page.show_icon_group()`,
			`page.clear_icons()`,
			`return page.add_inner_message("Saved <b>2</b>")`,
			`return page.add_inner_message("Again")`,
			`page.clear_custom_actions()`,
			`page.add_custom_button_group("Mobile group", null, page.custom_mobile_actions); page.clear_mobile_custom_groups()`,
		]);

		// ------------------------------------------------------------------ P7
		const p7 = await q(() => {
			const h = __host();
			const p = new frappe.ui.Page({ parent: h, title: "P7" });
			const f = p.add_field({ fieldname: "status", label: "Status", fieldtype: "Select", options: ["", "Open", "Closed"], default: "Open" });
			const g = p.add_field({ fieldname: "subject", label: "Subject", fieldtype: "Data" });
			const c = p.add_field({ fieldname: "flag", label: "Flag", fieldtype: "Check" });
			const lab = p.add_label("Label");
			const chk = p.add_check("Tick");
			p.add_break();
			g.set_input("hello");
			const in_form = f.wrapper.parentNode === p.page_form[0] && g.$wrapper[0].parentNode === p.page_form[0];
			const order = [...p.page_form[0].children].map((el) => el.dataset.fieldname || el.className.split(" ")[0]);
			const v8 = !!(f.$fui && g.$fui && g.$fui.view?.parent);
			const values = p.get_form_values();
			const form_shown = !p.page_form.hasClass("hide");
			p.page_form.append('<div class="caller-area"></div>');
			p.clear_fields();
			const cleared = p.page_form[0].children.length === 0 && g.$fui.destroyed && f.$fui.destroyed;
			const again = p.add_field({ fieldname: "again", label: "Again", fieldtype: "Data" });
			const ok_again = again.$wrapper[0].parentNode === p.page_form[0];
			h.remove();
			__restore();
			return { in_form, v8, values, form_shown, cleared, ok_again, order, lab: lab[0]?.outerHTML, chk: chk[0]?.tagName };
		});
		check("P7 add_field draws v8 controls into the template's toolbar form, in call order with labels/checks/breaks; get_form_values; clear_fields destroys them and the caller's content", p7.in_form && p7.v8 && p7.form_shown && p7.cleared && p7.ok_again && p7.values.status === "Open" && p7.values.subject === "hello" && p7.values.flag === 0 && p7.order.join() === "status,subject,flag,col-md-1,checkbox,clearfix" && p7.chk === "INPUT", p7);

		// ------------------------------------------------------------------ P8
		const p8 = await q(() => {
			const h = __host();
			const p = new frappe.ui.Page({ parent: h, title: "P8" });
			const out = {};
			try {
				const $b = p.add_inner_button("Gone", () => {});
				const $m = p.add_menu_item("Menu gone", () => {}, true);
				const $g = p.add_inner_button("G1", () => {}, "Grp");
				p.add_inner_button("G2", () => {}, "Grp");
				const $icon = p.add_action_icon("refresh", () => {});
				$b.remove();
				$m.closest("li").remove();
				$g.remove();
				$icon.remove();
				out.state_after_remove = [p.toolbar_items.filter((e) => e.kind === "button").length, [...p.menu_store.head, ...p.menu_store.rows].filter((r) => !r.user).length, p.toolbar_items.find((e) => e.kind === "group").items.length, p.icon_items.length];
				// further updates
				p.set_indicator("y", "green");
				const $b2 = p.add_inner_button("Gone", () => {});
				const $m2 = p.add_menu_item("Menu gone", () => {}, true);
				p.add_inner_button("G3", () => {}, "Grp");
				out.recovered = $b2[0].isConnected && $b2[0] !== $b[0] && $m2[0].isConnected && p.get_inner_group_button("Grp").find(".dropdown-item").length === 2;
				// a container emptied with jQuery
				p.menu.empty();
				p.custom_actions.empty();
				out.state_after_empty = [[...p.menu_store.head, ...p.menu_store.rows].filter((r) => !r.user).length, [...p.menu_store.head, ...p.menu_store.rows].filter((r) => r.user).length, p.toolbar_items.length];
				p.add_menu_item("Back", () => {}, true);
				p.add_inner_button("Back", () => {});
				out.after_empty = [p.menu.children().length, p.custom_actions.children("button").length];
				// a breadcrumb list emptied from outside, then repainted
				p.$breadcrumbs.empty();
				p.set_title("Repainted");
				out.crumbs = p.$breadcrumbs.text().trim();
				// the primary button's children replaced with jQuery, then set again
				p.set_primary_action("Save", () => {});
				p.btn_primary.html("<b>x</b>");
				p.set_primary_action("Save 2", () => {});
				out.primary = p.btn_primary.find(".es-button__label").text();
				// the indicator's content replaced with jQuery
				p.indicator.html("");
				p.set_indicator("Back", "blue");
				out.indicator = p.indicator.text();
			} catch (e) {
				out.error = e.stack;
			}
			h.remove();
			__restore();
			return out;
		});
		check("P8 jQuery .remove()/.empty() of drawn items leave the state too; later updates do not throw and draw again", !p8.error && JSON.stringify(p8.state_after_remove) === "[0,0,1,0]" && p8.recovered && JSON.stringify(p8.state_after_empty) === "[0,0,0]" && JSON.stringify(p8.after_empty) === "[1,1]" && p8.crumbs === "Repainted" && p8.primary === "Save 2", p8);
		check("P8b indicator content cleared with jQuery: set_indicator with a new label draws it", p8.indicator === "Back", p8.indicator);

		// ------------------------------------------------------------------ P9
		const p9 = await q(async () => {
			const h = __host();
			const p = new frappe.ui.Page({ parent: h, title: "P9" });
			p.set_indicator("Draft", "red");
			p.set_primary_action("Save", () => {});
			p.add_inner_button("A", () => {});
			p.add_inner_button("B", () => {}, "G");
			p.add_menu_item("M", () => {});
			p.add_action_item("Act", () => {});
			p.add_field({ fieldname: "f", label: "F", fieldtype: "Data" });
			const records = [];
			const mo = new MutationObserver((r) => records.push(...r));
			mo.observe(h, { subtree: true, childList: true, attributes: true, characterData: true });
			const view = p.$fui.view;
			view.proxy.$forceUpdate();
			p.flush();
			view.proxy.$forceUpdate();
			await new Promise((r) => setTimeout(r, 50));
			// methods that set what is already there
			p.show_menu();
			p.flush();
			await new Promise((r) => setTimeout(r, 0));
			const list = mo.takeRecords().concat(records).map((r) => `${r.type}:${r.target.nodeName}.${r.target.className?.baseVal ?? r.target.className}:${r.attributeName || ""}`);
			mo.disconnect();
			h.remove();
			__restore();
			return list;
		});
		check("P9 a forced re-render (and a show_menu that changes nothing) writes no DOM", p9.length === 0, p9);


		// ------------------------------------------------------------------ P12 regressions (break reports)
		// each scenario runs on a v8 page and a page.js page; the host's DOM is compared after every step
		const same = async (name, steps) => {
			const r = await q((src) => {
				const steps = eval(src);
				const run = (Page) => {
					const h = __host();
					const p = new Page({ parent: h, title: "R", single_column: true });
					const sigs = [];
					const ctx = {};
					for (const [label, fn] of steps) {
						let v;
						try {
							v = fn(p, ctx, h);
							v = v && v.jquery ? v.length : v;
						} catch (e) {
							v = "THREW " + e.message;
						}
						sigs.push([label, __sig(h), JSON.stringify(v ?? null)]);
					}
					$(h).remove();
					return sigs;
				};
				const a = run(frappe.ui.Page), b = run(frappe.ui.LegacyPage);
				__restore();
				for (let i = 0; i < a.length; i++) {
					if (a[i][1] !== b[i][1]) return { step: a[i][0], ...__diff(a[i][1], b[i][1]) };
					if (a[i][2] !== b[i][2]) return { step: a[i][0], v8: a[i][2], legacy: b[i][2] };
				}
				return { ok: true, steps: a.length };
			}, steps);
			check(name, r.ok, r);
		};
		const noop = "() => {}";
		// R1: system_console.js relabels the primary button with $btn.text(); any content write on a drawn element
		await same("P12 R1 .text() on btn_primary / btn_secondary, then set_*_action again (System Console's Execute): page.js's DOM, no throw", `[
			["set", (p, c) => (c.b = p.set_primary_action("Execute", ${noop}))],
			["text", (p, c) => c.b.text("Executing...")],
			["set again", (p) => p.set_primary_action("Run", ${noop})],
			["text back", (p, c) => c.b.text("Execute")],
			["set 3", (p) => p.set_primary_action("Execute", ${noop})],
			["clear+set", (p) => (p.clear_primary_action(), p.set_primary_action("Save", ${noop}))],
			["sec", (p, c) => (c.s = p.set_secondary_action("Cancel", ${noop}))],
			["sec text", (p, c) => c.s.text("Busy")],
			["sec again", (p) => p.set_secondary_action("Back", ${noop})],
			["title", (p) => p.set_title("After")],
			["indicator", (p) => p.set_indicator("Saved", "green")],
		]`);
		await same("P12 R1 native textContent / innerHTML / innerText / replaceChildren on the buttons, toolbar, form and menus, then more calls: page.js's DOM, no throw", `[
			["build", (p) => (p.set_primary_action("A", ${noop}), p.set_secondary_action("B", ${noop}), p.add_inner_button("I1", ${noop}), p.add_inner_button("G1", ${noop}, "G"), p.add_menu_item("M1", ${noop}), p.add_menu_item("S1", ${noop}, true), p.set_indicator("Draft", "red"), p.add_label("L"))],
			["btn textContent", (p) => (p.btn_primary[0].textContent = "x")],
			["btn innerHTML", (p) => (p.btn_secondary[0].innerHTML = "<b>y</b>")],
			["set both", (p) => (p.set_primary_action("A2", ${noop}), p.set_secondary_action("B2", ${noop}))],
			["toolbar innerHTML", (p) => (p.custom_actions[0].innerHTML = "")],
			["toolbar add", (p) => p.add_inner_button("I2", ${noop})],
			["toolbar text", (p) => p.custom_actions.text("")],
			["toolbar add 2", (p) => p.add_inner_button("I3", ${noop}, "G2")],
			["clear toolbar", (p) => p.clear_inner_toolbar()],
			["toolbar add 3", (p) => p.add_inner_button("I4", ${noop})],
			["form text", (p) => p.page_form.text("")],
			["form add", (p) => p.add_label("L2")],
			["clear fields", (p) => p.clear_fields()],
			["ind innerText", (p) => (p.indicator[0].innerText = "Foo")],
			["ind set", (p) => p.set_indicator("Saved", "green")],
			["ind text", (p) => p.indicator.text("Bar")],
			["ind set 2", (p) => p.set_indicator("Saved", "green")],
			["menu replaceChildren", (p) => p.menu[0].replaceChildren()],
			["menu add", (p) => (p.add_menu_item("M2", ${noop}), p.add_menu_item("S2", ${noop}, true))],
			["menu text", (p) => p.menu.text("")],
			["menu add 2", (p) => p.add_menu_item("M3", ${noop})],
			["clear menu", (p) => p.clear_menu()],
			["title", (p) => p.set_title("T")],
		]`);
		// R2: the user-action divider
		await same("P12 R2 user-action divider after page.menu.empty() / page.actions.empty() / its removal: page.js's order", `[
			["a", (p) => p.add_menu_item("A", ${noop}, false)],
			["empty", (p) => p.menu.empty()],
			["b", (p) => (p.add_menu_item("B", ${noop}, false), p.add_menu_item("Std", ${noop}, true))],
			["act", (p) => (p.add_action_item("X", ${noop}, false), p.actions.empty(), p.add_action_item("Y", ${noop}, false))],
			["divider removed", (p) => (p.menu.find(".dropdown-divider").remove(), p.add_menu_item("U2", ${noop}))],
			["ext li first", (p) => (p.clear_menu(), p.menu.append('<li class="ext-li"><a class="grey-link dropdown-item">Ext</a></li>'), p.add_menu_item("U3", ${noop}), p.add_menu_item("U4", ${noop}), p.add_menu_item("S", ${noop}, true))],
			["clear user", (p) => (p.clear_user_actions(), p.add_menu_item("U5", ${noop}))],
		]`);
		// R3: the inner message's place
		await same("P12 R3 inner message goes first in the toolbar, also after .empty() and caller-appended content", `[
			["msg", (p) => p.add_inner_message("one")],
			["empty+append", (p) => (p.custom_actions.empty(), p.custom_actions.append('<button class="ext-btn">E</button>'))],
			["msg 2", (p) => p.add_inner_message("two")],
			["prepend", (p) => (p.custom_actions.prepend('<span class="ext-pre">P</span>'), p.add_inner_message("three"))],
			["html+button", (p) => (p.inner_toolbar.html(""), p.add_inner_button("B", ${noop}), p.add_inner_message("four"))],
		]`);
		// R6: DOM facts legacy rewrote on every call
		await same("P12 R6 change_inner_button_type, data-label, indicator text and held crumbs: rewritten as page.js did", `[
			["btn", (p, c) => (c.b = p.add_inner_button("A", ${noop}))],
			["caller attrs", (p, c) => c.b.attr("data-variant", "ghost").attr("data-theme", "red")],
			["type default", (p) => p.change_inner_button_type("A", null, "default")],
			["danger", (p) => p.change_inner_button_type("A", null, "danger")],
			["caller drops theme", (p, c) => c.b.removeAttr("data-theme")],
			["danger again", (p) => p.change_inner_button_type("A", null, "danger")],
			["primary", (p) => p.set_primary_action("Save", ${noop})],
			["data-label hacked", (p) => p.btn_primary.attr("data-label", "Hacked")],
			["primary again", (p) => p.set_primary_action("Save", ${noop})],
			["indicator text", (p) => (p.set_indicator("Draft", "red"), p.indicator.text("Foo"), p.set_indicator("Saved", "green"))],
			["crumb held", (p, c) => (p.set_title("One"), (c.li = p.$breadcrumbs.children("li").first()).addClass("held"))],
			["title again", (p, c) => (p.set_title("Two"), c.li[0].isConnected)],
		]`);
		// R7: elements a caller moved out of the page's containers
		await same("P12 R7 a menu row moved to another store survives clear_menu; a held custom group <ul> after clear_custom_actions still takes items", `[
			["move", (p, c) => { c.a = p.add_menu_item("Move me", ${noop}, true); c.a.parent().detach().appendTo(p.actions); }],
			["clear menu", (p) => (p.clear_menu(), p.actions.children("li").length)],
			["group", (p, c) => { c.st = p.add_custom_button_group("CG"); p.add_custom_menu_item(c.st, "one", ${noop}, true); }],
			["clear custom", (p) => p.clear_custom_actions()],
			["add to held", (p, c) => p.add_custom_menu_item(c.st, "two", ${noop}, true)],
			["held rows", (p, c) => c.st.children("li").length],
			["btn moved", (p, c) => { c.ib = p.add_inner_button("IB", ${noop}); c.ib.appendTo(p.page_form); p.clear_inner_toolbar(); return c.ib[0].isConnected; }],
		]`);
		// R1 in the desk: System Console's Execute
		{
			const before = errors.length;
			await desk("/desk/system-console");
			await q(() => cur_frm.set_value("console", "1"));
			await page.waitForTimeout(400);
			await page.locator(".page-head:visible .primary-action").click();
			await page.waitForTimeout(2500);
			const after = await q(() => ({ visible: cur_frm.page.btn_primary.is(":visible"), label: cur_frm.page.btn_primary.text().trim() }));
			await desk("/desk/note/new");
			await page.evaluate(() => frappe.set_route("Form", "System Console"));
			await page.waitForTimeout(2000);
			const back = await q(() => ({ visible: cur_frm.page.btn_primary.is(":visible"), label: cur_frm.page.btn_primary.text().trim() }));
			const errs = errors.slice(before).filter((e) => !/Filter missing/.test(e));
			check("P12 R1 System Console: Execute keeps its button (visible, 'Execute') after a run and after going away and back, no errors", after.visible && /Execute/.test(after.label) && back.visible && /Execute/.test(back.label) && !errs.length, { after, back, errs });
			await desk("/desk/todo");
			await helpers();
		}
		// R4, R5, R8: v8 only
		const r458 = await q(async () => {
			const out = {};
			// R4: a flush with nothing to render costs the same on a page with 300 toolbar entries
			const p = new frappe.ui.Page({ parent: __host(), title: "R4", single_column: true });
			for (let i = 0; i < 300; i++) p.add_inner_button("B" + i, () => {});
			let t = performance.now();
			for (let i = 0; i < 1000; i++) p.flush();
			out.noop_flush_1000 = performance.now() - t;
			t = performance.now();
			for (let i = 0; i < 1000; i++) p.show_menu();
			out.show_menu_1000 = performance.now() - t;
			// ...and adding the 301st..350th entry costs about what the first 50 did
			const q2 = new frappe.ui.Page({ parent: __host(), title: "R4b", single_column: true });
			t = performance.now();
			for (let i = 0; i < 50; i++) q2.add_inner_button("C" + i, () => {});
			const first = performance.now() - t;
			t = performance.now();
			for (let i = 0; i < 50; i++) p.add_inner_button("D" + i, () => {});
			out.add_ratio = (performance.now() - t) / first;
			// R5: add_field controls go with the page when its parent is emptied with jQuery
			out.destroyed = {};
			for (const how of ["empty", "html", "remove"]) {
				const h = __host();
				const r = new frappe.ui.Page({ parent: h, title: "R5" });
				const f1 = r.add_field({ fieldname: "l", label: "L", fieldtype: "Link", options: "User" });
				const f2 = r.add_field({ fieldname: "d", label: "D", fieldtype: "Date" });
				if (how === "empty") $(h).empty();
				else if (how === "html") $(h).html("<p>x</p>");
				else $(h).remove();
				out.destroyed[how] = [f1.$fui.destroyed, f2.$fui.destroyed, r.$fui.destroyed];
			}
			// R8: $parts keeps no key per removed item
			const s = new frappe.ui.Page({ parent: __host(), title: "R8", single_column: true });
			const n0 = Object.keys(s.$parts).length;
			for (let i = 0; i < 500; i++) (s.add_action_icon("refresh", () => 1, "", "R"), s.clear_icons());
			for (let i = 0; i < 500; i++) (s.add_inner_button("A", () => 1), s.remove_inner_button("A"));
			for (let i = 0; i < 500; i++) s.add_menu_item("M", () => 1).parent().remove();
			out.parts_growth = Object.keys(s.$parts).length - n0;
			document.querySelectorAll(".probe-host").forEach((e) => $(e).remove());
			__restore();
			return out;
		});
		check("P12 R4 a flush with nothing to render does not walk the page: 1000 no-op flush() / show_menu() on a 300-entry toolbar < 30 ms each; entries 301-350 cost < 2.5x the first 50", r458.noop_flush_1000 < 30 && r458.show_menu_1000 < 30 && r458.add_ratio < 2.5, r458);
		check("P12 R5 add_field controls are destroyed with the page by $(parent).empty() / .html() / .remove()", Object.values(r458.destroyed).every((v) => v.every(Boolean)), r458.destroyed);
		check("P12 R8 $parts does not grow with add/remove cycles (1500 cycles)", r458.parts_growth <= 3, r458.parts_growth);
	}
	{
		// ------------------------------------------------------------------ P10 the real desk (both modes)
		const desk_checks = [];
		for (const [route, what] of [["/desk/todo", "list"], ["/desk/todo/new", "form"], ["/desk/user/Administrator", "form"], ["/desk/todo/view/report", "report"], ["/desk/website", "workspace"], ["/desk/query-report/Permitted Documents For User", "query report"]]) {
			const before = errors.length;
			await desk(route);
			await page.waitForTimeout(1500);
			const r = await q(() => {
				const p = frappe.get_current_page();
				return {
					v8: !!p?.$fui,
					title: p?.$title_area?.find(".es-breadcrumbs__label").last().text(),
					primary: p?.btn_primary?.is(":visible") ? p.btn_primary.text() : null,
					menu_items: p?.menu?.children("li").length,
					head: !!p?.page_head?.[0]?.isConnected,
				};
			});
			// "Filter missing": the report throws for its mandatory filter; page.js pages do the same
			desk_checks.push({ route, what, ...r, errors: errors.slice(before).filter((e) => !/Filter missing/.test(e)) });
		}
		for (const d of desk_checks) check(`P10 ${d.what} page ${d.route} is a ${TIMING_ONLY ? "page.js" : "v8"} page, drawn, no console errors`, d.v8 === !TIMING_ONLY && d.head && d.title && !d.errors.length, d);
		// open the Menu dropdown on a form and run an item; inner group dropdown
		await desk("/desk/user/Administrator");
		const before_menu = errors.length;
		await page.locator(".page-head:visible .menu-btn-group:visible button.menu-more-button").first().click();
		await page.waitForTimeout(500);
		const rows = await page.locator(".es-menu__item:visible").allInnerTexts().catch(() => []);
		await page.keyboard.press("Escape");
		check("P10 form Menu dropdown opens with the store's rows", rows.length > 3 && !errors.slice(before_menu).length, { rows: rows.slice(0, 8), errors: errors.slice(before_menu) });
	}

	// ------------------------------------------------------------------ P11 timing
	await desk("/desk/todo");
	await helpers();
	const timing = await q(
		({ legacy_only }) => {
			const classes = legacy_only ? { legacy: frappe.ui.Page } : { v8: frappe.ui.Page, legacy: frappe.ui.LegacyPage };
			const median = (xs) => xs.sort((a, b) => a - b)[xs.length >> 1];
			const out = {};
			for (const [name, Page] of Object.entries(classes)) {
				// warm up
				for (let i = 0; i < 5; i++) {
					const h = __host();
					new Page({ parent: h, title: "warm" });
					h.remove();
				}
				const create = [];
				const cycle = [];
				const noop = [];
				for (let run = 0; run < 7; run++) {
					const hosts = [];
					for (let i = 0; i < 20; i++) hosts.push(__host());
					let t = performance.now();
					const pages = hosts.map((h) => new Page({ parent: h, title: "Timing", single_column: false }));
					create.push((performance.now() - t) / 20);
					// a form refresh's page calls, 10 times on one page
					const p = pages[0];
					t = performance.now();
					for (let k = 0; k < 10; k++) {
						p.clear_menu();
						p.clear_inner_toolbar();
						p.clear_actions_menu();
						p.set_title("Doc " + k);
						p.set_indicator(k % 2 ? "Draft" : "Saved", k % 2 ? "red" : "green");
						p.set_primary_action("Save", () => {});
						for (let m = 0; m < 12; m++) p.add_menu_item("Item " + m, () => {}, m % 3 === 0);
						p.add_inner_button("View", () => {});
						for (let m = 0; m < 3; m++) p.add_inner_button("Create " + m, () => {}, "Create");
						p.add_action_item("Approve", () => {});
					}
					cycle.push((performance.now() - t) / 10);
					// the same calls again, nothing new: set_title/set_indicator/set_primary_action to what is there
					t = performance.now();
					for (let k = 0; k < 10; k++) {
						p.set_title("Doc 9");
						p.set_indicator("Draft", "red");
						p.show_menu();
					}
					noop.push((performance.now() - t) / 10);
					hosts.forEach((h) => h.remove());
				}
				out[name] = { create_ms: +median(create).toFixed(3), refresh_cycle_ms: +median(cycle).toFixed(3), same_again_ms: +median(noop).toFixed(3) };
			}
			__restore();
			return out;
		},
		{ legacy_only: TIMING_ONLY }
	);
	console.log("P11 timing (median of 7, ms):", JSON.stringify(timing));

	const late = errors.filter((e) => !/favicon|socket\.io|Queue Overloaded|Filter missing/.test(e));
	check("no console errors or Vue warnings over the run", late.length === 0, late.slice(0, 6));
	console.log(`\n${pass} passed, ${fail} failed`);
	await browser.close();
	process.exit(fail ? 1 : 0);
})().catch((e) => {
	console.error(e);
	process.exit(2);
});
