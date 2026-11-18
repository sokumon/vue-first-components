// Vue-first legacy classes: the class is the controller, a template is the view, one createApp.
// Run: node spike.cjs
const FRAPPE = process.env.FRAPPE || require("path").resolve(__dirname, "../../frappe");
const { JSDOM } = require(FRAPPE + "/flow/node_modules/jsdom");
const dom = new JSDOM('<!doctype html><body><div id="body"></div></body>');
for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "MutationObserver"])
	global[k] = k === "window" ? dom.window : dom.window[k];
const jq = require(FRAPPE + "/node_modules/jquery");
const $ = jq.fn ? jq : jq(dom.window);
const Vue = require(FRAPPE + "/node_modules/vue/dist/vue.cjs.js");
const { createApp, h, render, shallowReactive, inject, ref, onMounted, nextTick, effectScope } = Vue;

let pass = 0, fail = 0;
const check = (name, ok) => (ok ? pass++ : fail++, console.log(`${ok ? "ok  " : "FAIL"} ${name}`));

// ---------------------------------------------------------------- desk.js: the one app
const frappe = { ui: { pages: {} } };
const app = createApp({ template: `<div id="fui-overlays"></div>` });
app.provide("desk", { theme: "light" });
app.mount($("<div data-fui-root>").appendTo("body")[0]);
frappe.ui.app = app;

// ---------------------------------------------------------------- the base class
frappe.ui.Component = class Component {
	static view = null;
	constructor(opts = {}) {
		Object.assign(this, opts);
		const self = shallowReactive(this); // every `this.x = y` in any method now re-renders
		self.scope = effectScope();
		self.scope.run(() => self.make());
		self.mount();
		return self;
	}
	make() {}
	// the element the view renders into; Page overrides it to be its parent
	get host() {
		return this.parent ? $(this.parent)[0] : document.createElement("div");
	}
	mount() {
		const View = this.constructor.view;
		if (!View) return;
		this.el = this.host;
		const vnode = h(View, { [this.constructor.prop || "controller"]: this });
		vnode.appContext = frappe.ui.app._context;
		render(vnode, this.el);
		this._root = vnode.component;
		this.el.__component = this;
	}
	// a legacy caller that reads the DOM right after a setter
	flush() {
		this._root?.update();
	}
	destroy() {
		if (!this.el) return;
		render(null, this.el);
		this.scope.stop();
		this.el = null;
	}
};

// an element the controller owns and jQuery fills; Vue only places it
const Region = {
	props: ["el"],
	setup(props) {
		const host = ref();
		onMounted(() => host.value.appendChild(props.el));
		return () => h("div", { ref: host, style: "display: contents" });
	},
};
app.component("Region", Region);

// ---------------------------------------------------------------- frappe.ui.Page
const PageView = {
	props: ["page"],
	setup: () => ({ desk: inject("desk") }),
	template: `
	<div class="page-head" :data-theme="desk.theme">
		<h3 class="title-text">{{ page.title_label() }}</h3>
		<span v-if="page.indicator" class="indicator-pill" :class="page.indicator.color">{{ page.indicator.label }}</span>
		<div class="inner-group-button">
			<button v-for="b in page.inner_buttons" :key="b.label" class="btn btn-default btn-xs"
				:data-label="b.label" @click="b.action">{{ b.label }}</button>
		</div>
		<button v-if="page.primary" class="btn btn-primary primary-action" @click="page.primary.click">{{ page.primary.label }}</button>
	</div>
	<div class="page-body">
		<Region :el="page.sidebar[0]" />
		<Region :el="page.main[0]" />
	</div>`,
};

frappe.ui.Page = class Page extends frappe.ui.Component {
	static view = PageView;
	static prop = "page";
	make() {
		this.wrapper = $(this.parent); // same element as before
		this.$wrapper = this.wrapper;
		this.inner_buttons = [];
		this.sidebar = $('<div class="layout-side-section">');
		this.main = $('<div class="layout-main-section">');
		this.body = this.main;
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
	set_primary_action(label, click) {
		this.primary = { label, click };
	}
	add_inner_button(label, action) {
		this.inner_buttons = [...this.inner_buttons.filter((b) => b.label !== label), { label, action }];
		this.flush(); // callers chain on the returned element
		return this.wrapper.find(`.inner-group-button [data-label="${label}"]`);
	}
};

// ================================================================ checks
(async () => {
	const container = $("#body");
	const page_el = $('<div class="page-container">').appendTo(container)[0];
	const page = new frappe.ui.Page({ parent: page_el, title: "Item" });

	check("$wrapper is the parent the container made", page.$wrapper[0] === page_el);
	check("head renders synchronously in the constructor", page.wrapper.find(".title-text").text() === "Item");
	check("view got the app's provides (one createApp)", page.wrapper.find(".page-head").attr("data-theme") === "light");
	check("legacy regions are in place synchronously", page.wrapper.find(".page-body .layout-main-section").length === 1);

	page.main.html("<p class='report'>legacy jQuery content</p>");
	page.set_title("Item 2");
	check("a setter is async (Vue's scheduler)", page.wrapper.find(".title-text").text() === "Item");
	await nextTick();
	check("...and lands on the next tick", page.wrapper.find(".title-text").text() === "Item 2");
	check("jQuery content in a region survives a re-render", page.main.find(".report").length === 1);

	let clicked = 0;
	const $btn = page.add_inner_button("Refresh", () => clicked++);
	check("add_inner_button returns the real element synchronously", $btn.length === 1 && $btn.is("button"));
	$btn.addClass("btn-danger");
	page.set_indicator("Draft", "red");
	page.add_inner_button("Export", () => {});
	await nextTick();
	check("a class a caller added survives other re-renders", $btn.hasClass("btn-danger"));
	$btn.trigger("click");
	check("jQuery .trigger('click') reaches the Vue handler", clicked === 1);

	frappe.ui.Page.prototype.title_label = function () {
		return `[${this.title}]`;
	};
	page.set_title("Patched");
	await nextTick();
	check("a prototype patch made after construction is honoured", page.wrapper.find(".title-text").text() === "[Patched]");

	class ReportPage extends frappe.ui.Page {
		constructor(opts) {
			super(opts);
			this.report_name = opts.title;
		}
		set_title(title) {
			super.set_title(title.toUpperCase());
		}
	}
	const rp_el = $("<div>").appendTo(container)[0];
	const rp = new ReportPage({ parent: rp_el, title: "sales" });
	check("subclass constructor `this` is the reactive instance", rp.report_name === "sales");
	rp.set_title("ledger");
	await nextTick();
	check("subclass override + super() still render", rp.wrapper.find(".title-text").text() === "[LEDGER]");
	rp.score = 5; // a property set from outside, as client scripts do
	check("outside property writes don't throw", rp.score === 5);
	check("instanceof still works", rp instanceof frappe.ui.Page && rp instanceof ReportPage);

	frappe.ui.pages["item"] = page;
	check("identity: registry holds the same object callers have", frappe.ui.pages["item"] === page);


	// ------------------------------------------------------------ Sidebar, the opendesk way
	const SidebarView = {
		props: ["sidebar"],
		template: `
		<div class="body-sidebar" :class="{ expanded: sidebar.expanded }">
			<div class="sidebar-header">{{ sidebar.header_title() }}
				<ul class="menu"><li v-for="m in sidebar.menu_items()" :key="m.label">{{ m.label }}</li></ul>
			</div>
			<Region v-if="sidebar.current_module" :el="sidebar.$items_container[0]" />
			<button class="collapse" @click="sidebar.toggle_width()">c</button>
		</div>`,
	};
	frappe.ui.Sidebar = class Sidebar extends frappe.ui.Component {
		static view = SidebarView;
		static prop = "sidebar";
		make() {
			this.expanded = true;
			this.$items_container = $('<div class="sidebar-items">');
		}
		header_title() { return this.current_module || "Home"; }
		menu_items() { return [{ label: "Edit Sidebar" }]; }
		setup(module) { this.current_module = module; this.make_sidebar(); }
		make_sidebar() {
			this.empty();
			for (const item of ["Item", "Stock Entry"]) this.add_item(this.$items_container, { label: item });
		}
		empty() { this.$items_container.empty(); }
		add_item(container, item) { container.append(`<a class="sidebar-item">${item.label}</a>`); }
		toggle_width() { this.expanded = !this.expanded; }
	};
	const sb_el = $("<div>").appendTo("body")[0];
	const sidebar = new frappe.ui.Sidebar({ parent: sb_el });
	const { menu_items } = frappe.ui.Sidebar.prototype;
	frappe.ui.Sidebar.prototype.menu_items = function () {
		return [...menu_items.call(this), { label: "Open Desk" }];
	};
	sidebar.setup("Stock");
	sidebar.add_item(sidebar.$items_container, { label: "Back" });
	sidebar.$items_container.children().last().prependTo(sidebar.$items_container);
	check("add_item then children().last() works synchronously", sidebar.$items_container.children().first().text() === "Back");
	await nextTick();
	check("the region is placed once current_module is set", $(sb_el).find(".body-sidebar .sidebar-items a").length === 3);
	check("a patched data method (menu_items) shows in the template", $(sb_el).find(".menu li").last().text() === "Open Desk");
	$(sb_el).find(".collapse").trigger("click");
	await nextTick();
	check("a click toggles state and the class follows", !$(sb_el).find(".body-sidebar").hasClass("expanded"));
	sidebar.current_module = null;
	await nextTick();
	check("v-if off takes the region out", $(sb_el).find(".sidebar-items").length === 0);
	sidebar.current_module = "Selling";
	await nextTick();
	check("v-if on puts the same element back, jQuery rows kept", $(sb_el).find(".sidebar-items a").length === 3);

	// ------------------------------------------------------------ the shallow trap
	page.inner_buttons.push({ label: "Pushed", action() {} });
	await nextTick();
	check("TRAP: an in-place push does not re-render (shallow)", page.wrapper.find('[data-label="Pushed"]').length === 0);

	page.destroy();
	check("destroy unmounts the view", $(page_el).find(".page-head").length === 0);

	console.log(`\n${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
})();
