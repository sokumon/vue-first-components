frappe.provide("frappe.ui.sidebar_item");

frappe.ui.sidebar_item.TypeLink = class SidebarItem extends frappe.ui.Component {
	static view = require("./SidebarItem.vue");
	static prop = "row";

	make(opts) {
		this.nested_items = opts.item.nested_items || [];
		this.current_module = frappe.app.sidebar.current_module;
		this.prepare(opts);
		this.path = this.get_path();
		this.set_suffix();
		this.hide_icon = !!(this.item.child && this.item.parent?.indent);
		if (!this.item.icon && !this.hide_icon) this.item.icon = "list";
	}

	renders() {
		return !!this.path || !!this.item.standard;
	}

	get wrapper() {
		return $(this.el);
	}

	get_path() {
		return frappe.ui.sidebar_item.get_route(this.item, false, this.current_module);
	}

	prepare() {}

	container_class() {
		return ["sidebar-item-container", this.item.is_editable && "is-draggable"];
	}

	rail_label() {
		return frappe.app.sidebar.is_rail() ? this.item.label : undefined;
	}

	click() {
		if (this.path && frappe.is_mobile()) frappe.app.sidebar.close();
	}

	container_click() {}

	set_suffix() {
		if (this.item.suffix?.keyboard_shortcut) {
			this.item.suffix = this.get_shortcut_html(this.item.suffix.keyboard_shortcut);
		}
	}

	get_shortcut_html(shortcut) {
		return `<span class="keyboard-shortcut">${frappe.ui.keys.get_shortcut_label(shortcut)}</span>`;
	}
};

frappe.ui.sidebar_item.TypeSectionBreak = class SectionBreakSidebarItem extends frappe.ui.sidebar_item.TypeLink {
	prepare(opts) {
		this.collapsed = false;
		this.items = [];
		this.$items = [];
	}

	renders() {
		return this.nested_items.length > 0;
	}

	rendered() {
		this.add_items();
	}

	container_class() {
		return ["sidebar-item-container", "section-item"];
	}

	add_items() {
		this.$nested_items = this.wrapper.find(".nested-container").first();
		this.nested_items.forEach((f) => {
			this.items.push(frappe.app.sidebar.make_sidebar_item({ container: this.$nested_items, item: f }));
		});
	}

	open() {
		this.collapsed = false;
		this.toggle();
	}

	close() {
		this.collapsed = true;
		this.toggle();
	}

	toggle() {
		this.flush();
	}

	destroy() {
		this.items.forEach((item) => item.destroy());
		super.destroy();
	}
};

frappe.ui.sidebar_item.TypeSpacer = class SpacerSidebarItem extends frappe.ui.sidebar_item.TypeLink {
	renders() {
		return true;
	}
};

frappe.ui.sidebar_item.TypeButton = class SidebarButton extends frappe.ui.sidebar_item.TypeLink {
	container_class() {
		return this.item.class || super.container_class();
	}

	container_click() {
		this.item.onClick && this.item.onClick();
	}
};
