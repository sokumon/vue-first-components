frappe.ui.Sidebar = class Sidebar extends frappe.ui.Component {
	static view = require("./Sidebar.vue");
	static prop = "sidebar";

	make() {
		this.load_expanded_state();
		this.visible = false;
		this.all_sidebar_items = frappe.boot.module_sidebars;
		this.$items = [];
		this.fields_for_dialog = [];
		this.sidebar_items = [];
		this.items = [];
		this.cards = [];
		this.standard_items_setup = false;
	}

	renders() {
		return !!frappe.boot.setup_complete;
	}

	rendered() {
		this.setup_events();
		this.setup_click_away();
		this.setup_user_menu();
	}

	get host() {
		return document.body;
	}

	get wrapper() {
		return $(this.el);
	}

	get $sidebar() {
		return this.wrapper.find(".body-sidebar");
	}

	get $standard_items_sections() {
		return this.$sidebar;
	}

	get $items_container() {
		return this.wrapper.find(".sidebar-items");
	}

	get $standard_items_band() {
		return this.wrapper.find(".standard-items-band");
	}

	is_hidden() {
		return !this.sidebar_expanded && this.hides_when_collapsed();
	}

	is_rail() {
		return !this.sidebar_expanded && !this.is_hidden();
	}

	arrow_label() {
		return this.sidebar_expanded ? __("Collapse sidebar") : __("Expand sidebar");
	}

	load_sidebar_data() {
		this.add_standard_items();
		this.sidebar_data = frappe.boot.module_sidebars[this.current_module];
		this.sidebar_items = this.sidebar_data.items;
		this.all_sidebar_items = frappe.boot.module_sidebars;
		this.nest_section_items();
	}

	nest_section_items() {
		let currentSection = null;
		const updated_items = [];
		this.sidebar_items.forEach((item) => {
			item.nested_items = [];
			if (item.type === "Section Break") {
				currentSection = item;
				updated_items.push(item);
			} else if (currentSection && item.child) {
				item.parent = currentSection;
				currentSection.nested_items.push(item);
			} else {
				updated_items.push(item);
			}
		});
		this.sidebar_items = updated_items;
	}

	setup(current_module) {
		$(document).trigger("sidebar_setup", { sidebar: this });
		this.current_module = current_module;
		this.load_sidebar_data();
		this.make_sidebar();
	}

	setup_events() {
		frappe.router.on("change", () => this.set_workspace_sidebar());
		frappe.ui.keys.add_shortcut({ shortcut: "ctrl+/", action: () => this.toggle_width() });
	}

	apply_page_visibility() {
		this.visible = this.page_allows_sidebar();
		this.flush();
	}

	page_allows_sidebar() {
		return true;
	}

	toggle(hide) {
		this.visible = !hide;
		this.flush();
	}

	setup_user_menu() {
		this.create_user_menu({
			parent: this.wrapper.find(".dropdown-navbar-user"),
			button: this.wrapper.find(".sidebar-user-button"),
		});
	}

	create_user_menu({ parent, button }) {
		this.user_menu = new frappe.ui.Dropdown({ trigger: button, options: this.user_menu_options() });
	}

	user_menu_options() {
		return [{ label: __("My Settings") }, { label: __("Log out") }];
	}

	highlight_active_item() {
		if (this.find_active_item()) {
			this.active_item.addClass("active-sidebar");
			this.expand_parent_section();
		}
	}

	expand_parent_section() {
		if (!this.active_item) return;
		let active_section;
		$(".section-item").each((index, element) => {
			if (element.contains(this.active_item.get(0))) active_section = element.dataset.id;
		});
		const section = active_section && this.get_item(active_section);
		if (section && this.sidebar_expanded && section.collapsed) section.open();
	}

	get_item(name) {
		for (let item of this.items) {
			if (item.item.label === name) return item;
		}
	}

	find_active_item() {
		const path = decodeURIComponent(window.location.pathname).replace(/\/$/, "");
		let best = null;
		$(".item-anchor[href]").each(function () {
			if (this.getAttribute("href") === path) best = $(this).parent();
		});
		if (this.active_item) this.active_item.removeClass("active-sidebar");
		this.active_item = best;
		return !!best;
	}

	restore_expanded_state() {
		this.load_expanded_state();
		if (this.sidebar_items.length === 0) this.sidebar_expanded = true;
		this.apply_expanded_state();
	}

	load_expanded_state() {
		this.sidebar_expanded = !this.panel_can_close() && !this.saved_collapsed_state() && !this.folded_for_page;
	}

	panel_can_close() {
		return frappe.is_mobile();
	}

	saved_collapsed_state() {
		try {
			return localStorage.getItem("desk-sidebar-collapsed") === "1";
		} catch {
			return false;
		}
	}

	save_collapsed_state(collapsed) {
		if (this.panel_can_close()) return;
		try {
			localStorage.setItem("desk-sidebar-collapsed", collapsed ? "1" : "0");
		} catch {}
	}

	empty() {
		const container = this.$items_container[0];
		this.items.filter((item) => container.contains(item.host)).forEach((item) => item.destroy());
		this.$items_container.html("");
		this.items = [];
	}

	make_sidebar() {
		this.empty();
		this.create_sidebar(this.sidebar_items);
		this.highlight_active_item();
		this.restore_expanded_state();
	}

	create_sidebar(items) {
		this.empty();
		if (items && items.length > 0) {
			items.forEach((w) => this.add_item(this.$items_container, w));
		} else {
			this.$items_container.append($("<div class='flex' style='padding: 30px'> No Sidebar Items </div>"));
		}
	}

	add_standard_items() {
		if (this.standard_items_setup) return;
		this.standard_items = [
			{ label: __("Search"), icon: "search", standard: true, type: "Button", class: "navbar-modal-search-mobile" },
			{
				label: __("Notification"),
				icon: "bell",
				standard: true,
				type: "Button",
				class: "sidebar-notification",
				suffix: "<span class='notification-count es-badge hidden'></span>",
				onClick: () => (this.notifications_opened = (this.notifications_opened || 0) + 1),
			},
		];
		this.standard_items.forEach((w) => this.add_item(this.$standard_items_band, w));
		this.standard_items_setup = true;
	}

	add_item(container, item) {
		this.items.push(this.make_sidebar_item({ container: container, item: item }));
	}

	make_sidebar_item(opts) {
		let class_name = `Type${frappe.utils.to_title_case(opts.item.type).replace(/ /g, "")}`;
		return new frappe.ui.sidebar_item[class_name](opts);
	}

	setup_click_away() {
		$(document)
			.off(".sidebar-click-away")
			.on("click.sidebar-click-away", (e) => {
				if (!this.sidebar_expanded || !this.panel_can_close()) return;
				if ($(e.target).closest(".body-sidebar, .dock, .sidebar-collapse-arrow").length) return;
				this.close();
			});
	}

	toggle_width() {
		if (!this.sidebar_expanded) this.open();
		else this.close();
	}

	hides_when_collapsed() {
		return false;
	}

	apply_expanded_state() {
		this.flush();
		$("body").toggleClass("sidebar-collapsed", !this.sidebar_expanded);
		$(document).trigger("sidebar-expand", { sidebar_expand: !this.is_rail() });
	}

	label_rail_rows() {
		this.flush();
	}

	close() {
		this.sidebar_expanded = false;
		this.save_collapsed_state(true);
		this.apply_expanded_state();
	}

	open() {
		this.sidebar_expanded = true;
		this.save_collapsed_state(false);
		this.apply_expanded_state();
		this.highlight_active_item();
	}

	set_workspace_sidebar() {
		this.highlight_active_item();
	}
};
