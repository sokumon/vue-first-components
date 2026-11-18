// Spike 2: no render() and no mount in the class. Views are .vue files the app's own tree teleports.
// Run: node spike2.cjs
const FRAPPE = process.env.FRAPPE || require("path").resolve(__dirname, "../../../frappe");
const fs = require("fs"), path = require("path"), Module = require("module");
const { JSDOM } = require(FRAPPE + "/flow/node_modules/jsdom");
const dom = new JSDOM('<!doctype html><body><div id="body"></div></body>');
for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "MutationObserver"])
	global[k] = k === "window" ? dom.window : dom.window[k];
const jq = require(FRAPPE + "/node_modules/jquery");
global.$ = jq.fn ? jq : jq(dom.window);
const Vue = require(FRAPPE + "/node_modules/vue/index.js");
const sfc = require(FRAPPE + "/node_modules/vue/compiler-sfc/index.js");

// .vue and require("vue") for this spike, the way the desk bundler would resolve them
const resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
	return req === "vue" ? require.resolve(FRAPPE + "/node_modules/vue/index.js") : resolve.call(this, req, ...rest);
};
require.extensions[".vue"] = (module, filename) => {
	const { descriptor } = sfc.parse(fs.readFileSync(filename, "utf8"), { filename });
	const { content } = sfc.compileScript(descriptor, { id: path.basename(filename), inlineTemplate: true });
	const cjs = content
		.replace(/import \{([^}]*)\} from "vue"/g, (_, names) => `const {${names.replace(/ as /g, ": ")}} = require("vue")`)
		.replace(/import (\w+) from "([^"]+)"/g, 'const $1 = require("$2")')
		.replace("export default", "module.exports =");
	module._compile(cjs, filename);
};

let pass = 0, fail = 0;
const check = (name, ok) => (ok ? pass++ : fail++, console.log(`${ok ? "ok  " : "FAIL"} ${name}`));
const { nextTick, createApp } = Vue;

global.frappe = { ui: { pages: {} } };
require("./component.js");

// ------------------------------------------------ desk.js: the one app, mounted before any class
const app = createApp(require("./App.vue"));
app.provide("desk", { theme: "light" });
app.mount($("<div data-fui-root>").appendTo("body")[0]);
frappe.ui.app = app;

// ------------------------------------------------ classes: state and methods, no rendering
frappe.ui.Page = class Page extends frappe.ui.Component {
	static view = require("./PageView.vue");
	static prop = "page";
	make() {
		this.wrapper = this.$wrapper = $(this.parent);
		this.inner_buttons = [];
	}
	get main() {
		return this.wrapper.find(".layout-main-section");
	}
	get body() {
		return this.main;
	}
	title_label() {
		return this.title || "";
	}
	set_title(title) {
		this.title = title;
	}
	set_indicator(label, color) {
		this.indicator = { label, color };
	}
	add_inner_button(label, action) {
		this.inner_buttons = [...this.inner_buttons.filter((b) => b.label !== label), { label, action }];
		this.flush();
		return this.wrapper.find(`.inner-group-button [data-label="${label}"]`);
	}
};

frappe.ui.Sidebar = class Sidebar extends frappe.ui.Component {
	static view = require("./SidebarView.vue");
	static prop = "sidebar";
	make() {
		this.expanded = true;
		this.items = [];
	}
	get $items_container() {
		return this.wrapper.find(".sidebar-items");
	}
	get wrapper() {
		return $(this.host);
	}
	header_title() { return this.current_module || "Home"; }
	menu_items() { return [{ label: "Edit Sidebar" }]; }
	setup(module) { this.current_module = module; this.make_sidebar(); }
	make_sidebar() {
		this.empty();
		for (const label of ["Item", "Stock Entry"]) this.add_item(this.$items_container, { label });
	}
	empty() { this.items = []; }
	add_item(container, item) {
		this.items = [...this.items, item];
		this.flush();
	}
	toggle_width() { this.expanded = !this.expanded; }
};

(async () => {
	const src = ["component.js", "ViewOutlet.vue", "PageView.vue", "SidebarView.vue"].map((f) => fs.readFileSync(f, "utf8")).join("");
	check("the base class and views call no render(), mount() or createApp()", !/\b(render|mount|createApp)\(/.test(src));
	check("no region construct anywhere", !/region/i.test(src));

	const page_el = $('<div class="page-container">').appendTo("#body")[0];
	const page = new frappe.ui.Page({ parent: page_el, title: "Item" });
	check("$wrapper is the parent the container made", page.$wrapper[0] === page_el);
	check("head is drawn when the constructor returns", page.wrapper.find(".title-text").text() === "Item");
	check("the view sits in App's tree: it gets App's provides", page.wrapper.find(".page-head").attr("data-theme") === "light");
	check("page.main is the real .layout-main-section, legacy nesting kept",
		page.main.length === 1 && page.main.parent().hasClass("layout-main-section-wrapper"));
	check("the view's component has App's root as an ancestor", (() => {
		let i = frappe.ui.outlet; while (i.parent) i = i.parent; return i === app._instance;
	})());

	page.main.html("<p class='report'>legacy jQuery content</p>");
	page.set_title("Item 2");
	await nextTick();
	check("a setter lands on the next tick", page.wrapper.find(".title-text").text() === "Item 2");
	check("jQuery children of a Vue element with no children survive", page.main.find(".report").length === 1);

	let clicked = 0;
	const $btn = page.add_inner_button("Refresh", () => clicked++);
	check("add_inner_button returns the real element synchronously", $btn.length === 1 && $btn.is("button"));
	$btn.addClass("btn-primary");
	page.set_indicator("Draft", "red");
	page.add_inner_button("Export", () => {});
	await nextTick();
	check("a class a caller added survives re-renders", $btn.hasClass("btn-primary"));
	$btn.trigger("click");
	check("jQuery .trigger('click') reaches the Vue handler", clicked === 1);

	frappe.ui.Page.prototype.title_label = function () { return `[${this.title}]`; };
	page.set_title("Patched");
	await nextTick();
	check("a prototype patch after construction is honoured", page.wrapper.find(".title-text").text() === "[Patched]");

	class ReportPage extends frappe.ui.Page {
		set_title(title) { super.set_title(title.toUpperCase()); }
	}
	const rp = new ReportPage({ parent: $("<div>").appendTo("#body")[0], title: "x" });
	rp.set_title("ledger");
	await nextTick();
	check("a subclass keeps the parent's .vue and its overrides", rp.wrapper.find(".title-text").text() === "[LEDGER]");
	check("two pages, one outlet: both drawn", $("#body .page-head").length === 2);

	const sb_el = $("<div>").appendTo("body")[0];
	const sidebar = new frappe.ui.Sidebar({ parent: sb_el });
	const { menu_items } = frappe.ui.Sidebar.prototype;
	frappe.ui.Sidebar.prototype.menu_items = function () { return [...menu_items.call(this), { label: "Open Desk" }]; };
	sidebar.setup("Stock");
	sidebar.add_item(sidebar.$items_container, { label: "Back" });
	sidebar.$items_container.children().last().prependTo(sidebar.$items_container);
	check("opendesk: add_item then children().last() works synchronously", sidebar.$items_container.children().first().text() === "Back");
	sidebar.$items_container.children().first().attr("title", "Back to Stock");
	sidebar.add_item(sidebar.$items_container, { label: "Delivery Note" });
	check("opendesk's move and title survive Vue appending a row",
		sidebar.$items_container.children().first().attr("title") === "Back to Stock" && sidebar.$items_container.children().length === 4);
	await nextTick();
	check("rows drawn from state by the .vue", $(sb_el).find(".body-sidebar .sidebar-items a").length === 4);
	check("a patched data method (menu_items) shows", $(sb_el).find(".menu li").last().text() === "Open Desk");
	$(sb_el).find(".collapse").trigger("click");
	await nextTick();
	check("a click toggles state and the class follows", !$(sb_el).find(".body-sidebar").hasClass("expanded"));
	sidebar.current_module = null;
	await nextTick();
	check("v-show off hides the rows", $(sb_el).find(".sidebar-items").css("display") === "none");
	sidebar.current_module = "Selling";
	await nextTick();
	check("v-show on shows them again, rows kept", $(sb_el).find(".sidebar-items a").length === 4);

	rp.destroy();
	check("destroy takes the view out of the outlet", $("#body .page-head").length === 1);

	console.log(`\n${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
})().catch((e) => (console.error(e), process.exit(1)));
