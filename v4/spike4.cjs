// Spike 4: frappe.ui.Sidebar and frappe.ui.sidebar_item.* with their public API, drawn by .vue files.
// Run: node spike4.cjs
const FRAPPE = process.env.FRAPPE || require("path").resolve(__dirname, "../../../frappe");
const fs = require("fs"), path = require("path"), Module = require("module");
const { JSDOM } = require(FRAPPE + "/flow/node_modules/jsdom");
const dom = new JSDOM('<!doctype html><body><div class="main-section"></div></body>', { url: "http://site.test/desk/item" });
for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "MutationObserver", "localStorage"])
	global[k] = k === "window" ? dom.window : dom.window[k];
const jq = require(FRAPPE + "/node_modules/jquery");
global.$ = jq.fn ? jq : jq(dom.window);
const sfc = require(FRAPPE + "/node_modules/vue/compiler-sfc/index.js");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
	return req === "vue" ? require.resolve(FRAPPE + "/node_modules/vue/index.js") : resolve.call(this, req, ...rest);
};
require.extensions[".vue"] = (module, filename) => {
	const { descriptor } = sfc.parse(fs.readFileSync(filename, "utf8"), { filename });
	const to_cjs = (code) =>
		code
			.replace(/import \{([^}]*)\} from "vue"/g, (_, n) => `const {${n.replace(/ as /g, ": ")}} = require("vue")`)
			.replace(/import (\w+) from "([^"]+)"/g, 'const $1 = require("$2")');
	if (descriptor.scriptSetup) {
		const { content } = sfc.compileScript(descriptor, { id: path.basename(filename), inlineTemplate: true });
		return module._compile(to_cjs(content).replace("export default", "module.exports ="), filename);
	}
	const script = to_cjs(descriptor.script.content).replace("export default", "const _sfc_main =");
	const template = descriptor.template
		? to_cjs(sfc.compileTemplate({ source: descriptor.template.content, filename, id: path.basename(filename) }).code)
			.replace("export function render", "function render") + "\n_sfc_main.render = render;\n"
		: "";
	// the one line the build adds: a .vue named frappe.ui.* also becomes that class
	const emit = 'if (_sfc_main.name?.startsWith("frappe.ui.")) frappe.ui.define(_sfc_main);\n';
	module._compile(`${script}\n${template}${emit}module.exports = _sfc_main;`, filename);
};
const Vue = require("vue");

// ------------------------------------------------ the desk globals the classes lean on
global.__ = (s) => s;
global.frappe = {
	provide: (ns) => ns.split(".").reduce((o, k) => (o[k] ||= {}), global),
	ui: { keys: { add_shortcut() {}, get_shortcut_label: (s) => s.toUpperCase() } },
	app: {},
	is_mobile: () => false,
	session: { user: "jane@example.com", user_fullname: "Jane", user_email: "jane@example.com" },
	avatar: () => '<span class="avatar">J</span>',
	utils: { icon: (name) => `<svg data-icon="${name}"></svg>`, to_title_case: (s) => s.replace(/\b\w/g, (c) => c.toUpperCase()) },
	router: { on() {} },
	boot: {
		setup_complete: 1,
		module_sidebars: {
			Stock: {
				items: [
					{ label: "Home", type: "Link", link_type: "Workspace", link_to: "stock" },
					{ label: "Stock Transactions", type: "Section Break" },
					{ label: "Item", type: "Link", link_type: "DocType", link_to: "item", child: 1 },
					{ label: "Stock Entry", type: "Link", link_type: "DocType", link_to: "stock-entry", child: 1 },
					{ label: "", type: "Spacer" },
					{ label: "No route", type: "Link" },
				],
			},
		},
	},
};
frappe.ui.Dropdown = class Dropdown {
	constructor(opts) {
		this.opts = opts;
	}
};
require("./define.js");
frappe.provide("frappe.ui.sidebar_item");
frappe.ui.sidebar_item.get_route = (item) => (item.link_to ? `/desk/${item.link_to}` : null);
for (const file of ["TypeLink", "TypeSectionBreak", "TypeSpacer", "TypeButton", "Sidebar", "Badge"]) require(`./${file}.vue`);

// ------------------------------------------------ desk.js
const app = require("./renderer.js").createApp(require("./App.vue"));
app.provide("desk", {});
Object.assign(app.config.globalProperties, { __, frappe });
app.mount($("<div data-fui-root>").appendTo("body")[0]);

let pass = 0, fail = 0;
const check = (name, ok) => (ok ? pass++ : fail++, console.log(`${ok ? "ok  " : "FAIL"} ${name}`));
const labels = ($el) => $el.find(".sidebar-item-label").map((_, s) => s.textContent).get().join(",");

(async () => {
	// opendesk-style patches, installed before the desk boots
	const add_item = frappe.ui.Sidebar.prototype.add_item;
	const added = [];
	frappe.ui.Sidebar.prototype.add_item = function (container, item) {
		added.push(item.label);
		return add_item.apply(this, arguments);
	};
	const get_path = frappe.ui.sidebar_item.TypeLink.prototype.get_path;
	frappe.ui.sidebar_item.TypeLink.prototype.get_path = function () {
		return this.item.label === "No route" ? "/desk/patched" : get_path.call(this);
	};
	let setup_event = null;
	$(document).on("sidebar_setup", (e, { sidebar }) => (setup_event = sidebar));

	frappe.app.sidebar = new frappe.ui.Sidebar();
	const sidebar = frappe.app.sidebar;
	check("new frappe.ui.Sidebar() takes no options, as before", sidebar instanceof frappe.ui.Sidebar);
	check("wrapper is .body-sidebar-container, a direct child of body", sidebar.wrapper.is(".body-sidebar-container") && sidebar.wrapper.parent().is("body"));
	check("hidden until a page allows it", sidebar.wrapper.css("display") === "none");
	check("user menu still goes through frappe.ui.Dropdown", sidebar.user_menu instanceof frappe.ui.Dropdown && sidebar.user_menu.opts.trigger.is(".sidebar-user-button"));

	sidebar.apply_page_visibility();
	check("apply_page_visibility shows it at once", sidebar.wrapper.css("display") !== "none");

	sidebar.setup("Stock");
	check("sidebar_setup event fires with the sidebar", setup_event === sidebar);
	check("$sidebar carries data-title", sidebar.$sidebar.attr("data-title") === "Stock");
	check("standard band rows, with the item's class", labels(sidebar.$standard_items_band) === "Search,Notification" &&
		sidebar.$standard_items_band.children(".sidebar-notification").length === 1);
	check("rows drawn in order, a row with no path skipped, patched get_path honoured",
		labels(sidebar.$items_container) === "Home,Stock Transactions,Item,Stock Entry,No route");
	check("section children sit in the section's .nested-container",
		labels(sidebar.$items_container.find('[data-id="Stock Transactions"] > .nested-container')) === "Item,Stock Entry");
	check("a patched add_item saw every top-level row", added.includes("Home") && added.includes("Search"));
	check("sidebar.items are the public item classes", sidebar.items.every((i) => i instanceof frappe.ui.sidebar_item.TypeLink) &&
		sidebar.get_item("Stock Transactions") instanceof frappe.ui.sidebar_item.TypeSectionBreak);
	check("item.wrapper is the row's .sidebar-item-container", sidebar.get_item("Home").wrapper.is(".sidebar-item-container"));
	check("highlight_active_item lights /desk/item", sidebar.active_item?.closest('[data-id="Item"]').length === 1 && sidebar.active_item.hasClass("active-sidebar"));
	check("a suffix's HTML is drawn", sidebar.$standard_items_band.find(".sidebar-item-suffix .notification-count").length === 1);

	const $notification = sidebar.$standard_items_band.find(".sidebar-notification");
	$notification.find(".item-anchor")[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	check("a real click on a Button row runs its onClick", sidebar.notifications_opened === 1);
	$notification.trigger("click");
	check("jQuery .trigger('click') on the row runs it too", sidebar.notifications_opened === 2);
	$notification.find(".item-anchor").trigger("click");
	check("jQuery .trigger('click') on the row's <a> bubbles to it", sidebar.notifications_opened === 3);

	const section = sidebar.get_item("Stock Transactions");
	section.close();
	check("section.close() hides its children at once", section.wrapper.children(".nested-container").css("display") === "none" &&
		section.wrapper.find(".drop-icon").attr("data-state") === "closed");
	section.open();
	check("section.open() shows them again", section.wrapper.children(".nested-container").css("display") !== "none");

	let expand_event = null;
	$(document).on("sidebar-expand", (e, data) => (expand_event = data));
	sidebar.toggle_width();
	check("toggle_width folds it, and the DOM is up to date when sidebar-expand fires",
		sidebar.sidebar_expanded === false && !sidebar.wrapper.hasClass("expanded") && expand_event?.sidebar_expand === false);
	check("body gets sidebar-collapsed", $("body").hasClass("sidebar-collapsed"));
	check("the collapse is kept in localStorage", localStorage.getItem("desk-sidebar-collapsed") === "1");
	await Vue.nextTick();
	check("rows show their label as a tooltip in the rail", sidebar.get_item("Home").wrapper.find(".item-anchor").attr("title") === "Home");
	check("the arrow says Expand", sidebar.wrapper.find(".sidebar-collapse-arrow").attr("aria-label") === "Expand sidebar");
	sidebar.toggle_width();
	await Vue.nextTick();
	check("toggle_width opens it, tooltips go", sidebar.wrapper.hasClass("expanded") && !sidebar.get_item("Home").wrapper.find(".item-anchor").attr("title"));

	// opendesk's back row: empty, add_item a Button, then move the new row to the top
	sidebar.empty();
	const $container = sidebar.$items_container;
	["Selling", "Buying"].forEach((label) => sidebar.add_item($container, { type: "Button", standard: true, label, onClick() {} }));
	sidebar.add_item($container, { type: "Button", standard: true, class: "sidebar-item-container opendesk-back-row", label: "Stock", icon: "chevron-left", onClick() {} });
	$container.children().last().attr("title", "Back to the Stock modules").prependTo($container);
	check("opendesk: back row first with its title", $container.children().first().is(".opendesk-back-row[title='Back to the Stock modules']") &&
		labels($container) === "Stock,Selling,Buying");
	sidebar.make_sidebar();
	check("make_sidebar after empty() and .html('') redraws the module", labels(sidebar.$items_container) === "Home,Stock Transactions,Item,Stock Entry,No route");
	check("only live rows are in the outlet", frappe.ui.views.size === 1 + 2 + sidebar.items.length + 2);

	sidebar.toggle(true);
	check("toggle(true) hides it", sidebar.wrapper.css("display") === "none");

	// ------------------------------------------------ the emitted classes
	const vue_files = ["TypeLink", "TypeSectionBreak", "TypeSpacer", "TypeButton", "Sidebar", "Badge"].map((f) => fs.readFileSync(`${f}.vue`, "utf8"));
	check("no .vue writes a class or assigns frappe.ui.*", vue_files.every((src) => !/\bclass\s+\w|frappe\.ui\.\w+\s*=[^=]/.test(src.slice(0, src.indexOf("</script>")))));
	check("the class has the real name, its methods on the prototype", frappe.ui.Sidebar.name === "Sidebar" && Object.hasOwn(frappe.ui.Sidebar.prototype, "add_item"));
	check("extends: in the .vue is a real prototype chain", Object.getPrototypeOf(frappe.ui.sidebar_item.TypeButton) === frappe.ui.sidebar_item.TypeLink);
	check("super in a .vue method reaches the parent", new frappe.ui.sidebar_item.TypeButton({ container: $("<div>")[0], item: { label: "x", type: "Button", standard: 1 } }).container_class().includes("sidebar-item-container"));

	const b_el = $("<div>").appendTo("body")[0];
	const badge = new frappe.ui.Badge({ parent: b_el, label: "Draft" });
	check("as a class: new frappe.ui.Badge(opts) draws at once", $(b_el).find(".badge-x").text() === "Draft (0)");
	badge.bump();
	badge.flush();
	check("as a class: methods and computed work, `this` is reactive", $(b_el).find(".badge-x").text() === "Draft (1)");
	const { bump } = frappe.ui.Badge.prototype;
	frappe.ui.Badge.prototype.bump = function () { bump.call(this); bump.call(this); };
	$(b_el).find(".badge-x").trigger("click");
	badge.flush();
	check("as a class: a later prototype patch reaches a live instance", $(b_el).find(".badge-x").text() === "Draft (3)");
	class Loud extends frappe.ui.Badge { get text() { return super.text.toUpperCase(); } }
	const l_el = $("<div>").appendTo("body")[0];
	new Loud({ parent: l_el, label: "x" });
	check("as a class: an app's `class extends` overrides a field, with super", $(l_el).find(".badge-x").text() === "X (0)");
	badge.undeclared = "set from outside";
	check("as a class: undeclared properties can be set", badge.undeclared === "set from outside");
	const $mine = $('<div class="mine">');
	badge.text = "assigned";
	badge.flush();
	check("as a class: assigning a field overrides the view (this.$input = ...)", $(b_el).find(".badge-x").text() === "assigned");

	frappe.ui.Badge.prototype.bump = bump;
	const n_el = $("<div>").appendTo("body")[0];
	const native = require("./renderer.js").createApp(require("./Badge.vue"), { label: "Plain" });
	native.config.globalProperties.__ = __;
	native.mount(n_el);
	check("as a component: the same .vue mounts as a plain Vue component", $(n_el).find(".badge-x").text() === "Plain (0)");
	$(n_el).find(".badge-x").trigger("click");
	await Vue.nextTick();
	check("as a component: its data, computed and methods work", $(n_el).find(".badge-x").text() === "Plain (1)");

	console.log(`\n${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
})().catch((e) => (console.error(e), process.exit(1)));
