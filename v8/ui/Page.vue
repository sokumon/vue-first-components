<!--
frappe.ui.Page, template-first. A port of frappe's ui/page.js + ui/page.html; public API unchanged.

The legacy constructor was `$.extend(this, opts); ...; this.make(); ...`. Here `new` assigns the
options and mounts the view at `opts.parent` (a placeholder), and mounted() runs the rest of the
constructor. make() -> add_main_section() switches the template on (draw_page) and reads its parts:
every element page.html had, plus the main view, the sidebar's skip link and the toolbar form
(page_form), is in the <template> below. page.html's frappe.ui.button.html() calls are <EsButton>
(the same markup as a template) and its frappe.utils.icon() calls are <Icon>.

Every call renders only what it changed. The regions that page methods change are child components
with their own render: <PageMenuStore> (a hidden menu store's <ul>), <PageToolbar> (.custom-actions /
.custom-mobile-actions, one <PageToolbarEntry> per button or group) and <PageRegion> around the
breadcrumbs, the indicator, the icon group, each action button group and the toolbar form. A
PageRegion only renders its slot, so its markup stays here, but the state it reads is tracked by the
region: set_title renders the breadcrumbs, not the page. Their v-parts record into this page.

What the legacy methods built with jQuery is state the template draws:

	set_indicator / clear_indicator         ind {shown, label, color, mobile}
	set_primary_action / set_secondary_action / clear_*   primary_btn, secondary_btn (set_action, clear_action_of)
	set_primary_action_options              primary_menu_hidden
	add_menu_item / add_action_item / add_dropdown_item / add_divider / add_custom_menu_item
	                                        a store {head, rows, udiv, hidden, hidden_xl} per menu:
	                                        menu_store, actions_store, and one per custom button group
	clear_menu / clear_actions_menu / clear_btn_group / clear_user_actions
	show_menu / hide_menu / show_actions_menu / hide_actions_menu      the store's hidden flags
	add_inner_button / add_button / get_or_add_inner_group_button / add_divider_to_button_group
	add_custom_button_group / add_inner_message                       toolbar_items, mobile_groups, inner_message
	remove_inner_button / change_inner_button_type / set_inner_btn_group_as_primary
	clear_inner_toolbar / clear_custom_actions / clear_mobile_custom_groups
	add_action_icon / clear_icons / show_icon_group / hide_icon_group  icon_items, icon_group_shown
	set_title / set_breadcrumbs / render_breadcrumbs                   crumb_items (the es-breadcrumbs markup)
	add_label / add_check / add_break        form_items; add_field draws a v8 control into the
	show_form / hide_form / clear_fields     template's page_form part (`new` mounts it there)

Every method that made an element returns the jQuery object of the element the template drew for it
(read with v-part, a per-item part name), so callers' later .addClass / .toggle / .on / .remove keep
working. Rules that keep the state and the DOM together:

	- Items removed with jQuery (.remove(), .empty(), .html() on a container) leave the state too:
	  a $.cleanData hook drops the item that drew the element. Removing methods (remove_inner_button,
	  clear_user_actions, ...) select elements the legacy way and remove template-drawn ones from the
	  state, anything else with jQuery.
	- Clearing methods that were `.empty()` also remove what callers appended into that container
	  (the list view's view switcher, query report's filter area, raw <li>s), as .empty() did.
	- Where legacy wrote a class or attribute every time (removeClass("hide"), prop("disabled", false),
	  clear_indicator's removeClass()), the method puts that DOM fact back after the render too:
	  callers change these from outside (workflow.js hides btn_primary with addClass("hide")).
	- Lists whose containers callers also append to (custom actions, menus, the toolbar form) are
	  `v-tail`: their new items go to the end of the container, as legacy appends did, not before
	  content a caller appended.
	- Content replaced on an element Vue draws into (v-tail, v-keep: menus, toolbar, breadcrumbs, the
	  indicator, the toolbar form, every EsButton), with jQuery's .empty() / .html(x) / .text(x) or the
	  native textContent / innerHTML / innerText / replaceChildren(), keeps Vue's list anchors and
	  v-if placeholders (anchors.js), and what it removed is cleaned as .empty() cleans it; a primary
	  button or indicator whose content a caller replaced is drawn anew by the next set_*
	  (system_console.js relabels btn_primary with $btn.text()).
	- An item's element a caller moved out of its container stays where the caller put it when the
	  container is cleared (release()), as legacy .empty() of the container left it.

Still jQuery, by design:
	- frappe.ui.Dropdown (the espresso menus over the hidden stores), bootstrap .tooltip(),
	  frappe.ui.keys shortcut groups: frappe's own components and a plugin, called as before.
	- caller callbacks bound with .on("click") (set_action, add_button, add_inner_button, add_action_icon):
	  callers .off()/.unbind() them, and clear_action_of unbinds every click handler.
	- add_view(name, html) for any view but "main", set_view's .toggle(): the caller's markup.
	- set_title_sub / get_main_icon: they act on elements a caller may have put in the page (h6,
	  .title-icon); page.html has none.
	- get_empty_state / get_icon_label: markup handed to the caller, not part of the page.
	- the `else` branches for a parent that is not one of this page's stores or containers
	  (add_dropdown_item with a caller's own <ul>, set_action on a caller's button).
-->
<script>
import { reactive, shallowReactive, markRaw } from "vue";
import EsButton from "./EsButton.vue";
import Icon from "./Icon.vue";
import PageMenuStore from "./PageMenuStore.vue";
import PageToolbar from "./PageToolbar.vue";
import PageRegion from "./PageRegion.vue";
import { safe_href } from "../../frappe/ui/components/utils.js";
import { tail, keep, drop_before_anchors } from "./anchors.js";
import renderer from "../renderer.js";

// bootstrap button types (the public add_inner_button/add_button vocabulary)
// mapped onto the es-button contract; unknown types fall back to subtle
const BTN_TYPE_TO_ES = {
	default: { variant: "subtle" },
	secondary: { variant: "subtle" },
	light: { variant: "subtle" },
	primary: { variant: "solid" },
	danger: { variant: "solid", theme: "red" },
	ghost: { variant: "ghost" },
};

function es_opts_for_btn_type(type) {
	return BTN_TYPE_TO_ES[type] || BTN_TYPE_TO_ES.default;
}

let next_key = 0;
const new_key = (prefix) => `${prefix}${++next_key}`;
// a menu store: its lists are shallow (a row is drawn once; what callers change on it afterwards
// they change on its element, as before), its flags are state
const new_store = (hidden) =>
	shallowReactive({
		key: new_key("store"),
		// The <ul>'s rows in legacy order, in two parts: `head`, where user items go (before the
		// user-action divider, which a new one makes first), and `rows`, where standard items and
		// add_divider()'s dividers are appended. Two parts so that neither insert moves the other's
		// rows (Vue's v-memo cache in a v-for is by position). Plain arrays changed only through
		// change_rows(), which counts `rev`: <PageMenuStore> tracks `rev`, not every index.
		head: markRaw([]),
		rows: markRaw([]),
		rev: 0,
		udiv: null, // the user-action divider's row, while drawn
		hidden,
		hidden_xl: false,
	});

// element drawn for a list entry -> { item, drop() }. jQuery removing the element drops the entry
// from the page's state ($.cleanData below), so the next render agrees with the DOM.
const owned = new WeakMap();
function own(el, item, drop) {
	if (el) owned.set(el, { item, drop });
	return el;
}
function change_rows(store, change) {
	change();
	store.rev++;
}
// a row leaves its store (jQuery removed its element, or a removing method did)
function drop_row(store, item) {
	change_rows(store, () => {
		drop_from(store.head, item);
		drop_from(store.rows, item);
	});
	if (store.udiv === item) store.udiv = null;
}
function drop_from(list, item) {
	const i = list.findIndex((x) => x.key === item.key);
	if (i >= 0) list.splice(i, 1);
}
const clean = $.cleanData;
$.cleanData = function (elems) {
	for (let i = 0, el; (el = elems[i]) != null; i++) {
		const rec = owned.get(el);
		if (rec) {
			owned.delete(el);
			rec.drop();
		}
	}
	return clean.apply(this, arguments);
};


export default {
	name: "frappe.ui.Page",
	components: { EsButton, Icon, PageMenuStore, PageToolbar, PageRegion },
	directives: { tail, keep },
	data() {
		return {
			draw_page: false, // add_main_section() switches the template on
			ind: reactive({ shown: false, label: null, color: undefined, mobile: false, gen: 0 }),
			primary_btn: reactive({ shown: false, gen: 0 }),
			secondary_btn: reactive({ shown: false, gen: 0 }),
			primary_menu_hidden: true,
			menu_store: new_store(true),
			actions_store: new_store(true),
			toolbar_items: reactive([]), // .custom-actions: inner buttons, inner groups, add_button, custom groups
			toolbar_shown: false,
			inner_message: null,
			inner_message_gen: 0,
			mobile_groups: reactive([]), // .custom-mobile-actions
			icon_items: reactive([]),
			icon_group_shown: false,
			form_items: reactive([]), // add_label / add_check / add_break
			form_shown: false,
			crumb_items: [],
			crumbs_gen: 0,
			crumbs_ol_gen: 0,
			crumbs_mobile: false,
		};
	},
	computed: {
		// the page itself, for the regions drawn by child components (PageToolbar reads its state)
		this_page() {
			return this;
		},
	},
	// the legacy constructor's lines before make()
	created() {
		this.set_document_title = true;
		this.buttons = {};
		this.fields_dict = {};
		this.views = {};
		this.mobile_at_make = !!frappe.is_mobile();
		this.crumbs_mobile = this.mobile_at_make;
	},
	// ...and the rest of it
	mounted() {
		this.make();
		if (!Object.hasOwn(this, "hide_sidebar")) this.hide_sidebar = false;
		// pages can hide just the dock (while keeping the body sidebar) via this option;
		// the two are independent, and `hide_sidebar` takes the panel away on a desktop and merely
		// closes the drawer on a narrow screen (see Sidebar.page_allows_sidebar)
		if (!Object.hasOwn(this, "hide_dock")) this.hide_dock = false;
		// and the phone tab bar, the same way (see MobileNav.apply_page_visibility)
		if (!Object.hasOwn(this, "hide_mobile_nav")) this.hide_mobile_nav = false;
		frappe.ui.pages[frappe.get_route_str()] = this;
	},
	methods: {
		make() {
			this.wrapper = $(this.parent);
			this.add_main_section();
			this.setup_awesomebar();
		},

		setup_awesomebar() {
			if (frappe.boot.desk_settings.search_bar && !frappe.app.awesome_bar) {
				let awesome_bar = new frappe.search.AwesomeBar();
				awesome_bar.setup(".navbar-modal-search-mobile");
				frappe.app.awesome_bar = awesome_bar;
				frappe.search.utils.make_function_searchable(
					frappe.utils.generate_tracking_url,
					__("Generate Tracking URL")
				);
				if (frappe.model.can_read("RQ Job")) {
					frappe.search.utils.make_function_searchable(function () {
						frappe.set_route("List", "RQ Job");
					}, __("Background Jobs"));
				}
			}
		},

		// markup handed to the caller to place (not part of the page): stays a string
		get_empty_state(title, message, primary_action) {
			return $(`<div class="page-card-container">
	  			<div class="page-card">
	  				<div class="page-card-head">
	  					<span class="indicator blue">
	  						${title}</span>
	  				</div>
	  				<p>${message}</p>
	  				<div>
	  					<button class="btn btn-primary btn-sm">${primary_action}</button>
	  				</div>
	  			</div>
	  		</div>`);
		},

		load_lib(callback) {
			frappe.require(this.required_libs, callback);
		},

		// page.html and the main view (single column, or with the sidebar left or right) are the template
		add_main_section() {
			this.draw_page = true;
			this.flush();
			this.add_view("main", $(this.$parts.main_view));
			this.setup_page();
		},

		setup_page() {
			const parts = this.$parts;
			this.$title_area = $(parts.title_area);

			// page.html has no h6: legacy found whatever the wrapper already held
			this.$sub_title_area = this.wrapper.find("h6");

			if (this.title) this.set_title(this.title);

			if (this.icon) this.get_main_icon(this.icon);

			this.body = this.main = $(parts.main);
			this.container = $(parts.container);
			this.sidebar = $(parts.sidebar); // none in a single column page
			this.footer = $(parts.footer);
			this.indicator = $(parts.indicator);

			this.page_actions = $(parts.page_actions);
			this.filters = $(parts.filters);
			this.page_head = $(parts.page_head);
			this.btn_primary = $(parts.btn_primary);
			this.btn_primary_menu = $(parts.btn_primary_menu);
			this.btn_secondary = $(parts.btn_secondary);

			this.menu = $(parts[this.menu_store.key]);
			this.menu_btn_group = $(parts.menu_btn_group);

			this.actions = $(parts[this.actions_store.key]);
			this.actions_btn_group = $(parts.actions_btn_group);

			this.standard_actions = $(parts.standard_actions);
			this.custom_actions = $(parts.custom_actions);
			this.custom_mobile_actions = $(parts.custom_mobile_actions);

			this.page_form = $(parts.page_form);
			this.inner_toolbar = this.custom_actions;
			this.icon_group = $(parts.icon_group);

			// the stores add_dropdown_item writes to, by element
			this.$stores = new WeakMap([
				[this.menu[0], this.menu_store],
				[this.actions[0], this.actions_store],
			]);
			this.menu_store.group_part = "menu_btn_group";
			this.actions_store.group_part = "actions_btn_group";

			if (this.make_page) {
				this.make_page();
			}

			// keyboard shortcuts
			let menu_btn = $(parts.menu_btn);
			menu_btn
				.attr("title", __("Menu"))
				.tooltip({ delay: { show: 600, hide: 100 }, trigger: "hover" })
				.on("click mousedown", function () {
					$(this).tooltip("hide");
				});
			frappe.ui.keys.get_shortcut_group(this.page_actions[0]).add(menu_btn);

			// The Menu / Actions dropdowns are espresso menus over the hidden stores the template
			// draws: every open snapshots the store into rows (build_dropdown_options), so
			// .text() / .toggle() / .addClass("disabled") on a held item all keep working.
			this.menu_dropdown = new frappe.ui.Dropdown({
				trigger: menu_btn,
				align: "end",
				options: () => this.build_dropdown_options(this.menu),
			});
			this.actions_dropdown = new frappe.ui.Dropdown({
				trigger: $(parts.actions_btn),
				align: "end",
				options: () => this.build_dropdown_options(this.actions),
				sheet_on_mobile: true,
				sheet_title: () => this.actions_sheet_title?.() || __("Actions"),
			});
			// the menus body-portal, so one left open would float over the next
			// page — the container fires "hide" on the page element on switch
			this.wrapper.on("hide", () => {
				this.menu_dropdown.close("owner");
				this.actions_dropdown.close("owner");
				this.wrapper.find(".inner-group-button, .custom-btn-group").each((_, group) => {
					$(group).data("es_dropdown")?.close("owner");
				});
			});

			// desktop shows "Actions" + chevron; mobile keeps just the chevron (the template's
			// label_class: hidden-xs actions-btn-group-label)
			let action_btn = $(parts.actions_btn);
			let action_btn_label = action_btn.find(".es-button__label");
			frappe.ui.keys.get_shortcut_group(this.page_actions[0]).add(action_btn, action_btn_label);

			// https://axesslab.com/skip-links (the template draws it into the sidebar)
			this.skip_link_to_main = $(parts.skip_link);
		},

		skip_to_main(e) {
			e.preventDefault();
			const main = this.main.get(0);
			main.setAttribute("tabindex", -1);
			main.focus();
			main.addEventListener(
				"blur",
				() => {
					main.removeAttribute("tabindex");
				},
				{ once: true }
			);
		},

		// ------------------------------------------------------------ helpers
		// the element the template drew for `key` (a per-item part), registered as that item's
		alive() {
			return !this.$fui.destroyed && !!this.$parts.page_head;
		},
		take(key, item, drop) {
			return own(this.$parts[key], item, drop);
		},
		// what legacy .empty() also took: elements in `$el` the template did not draw
		remove_foreign($el) {
			$el.children()
				.filter((_, child) => !owned.has(child) && !this.is_static_part(child))
				.remove();
		},
		// legacy .html() replaced every node of `el`: all but `keep` and Vue's anchors go, text a
		// caller set with .text() too
		remove_foreign_nodes(el, keep) {
			if (!el) return;
			for (const node of [...el.childNodes]) {
				if (node === keep || node.nodeType === 8 || (node.nodeType === 3 && node.data === "")) continue;
				if (node.nodeType === 1) $(node).remove();
				else node.remove();
			}
		},
		is_static_part(el) {
			return el === this.$parts.inner_message;
		},
		// `fn` empties `list` and renders. Legacy .empty() of `container` took only what was still in
		// it: an item's element a caller moved somewhere else stays where it is now, with its handlers
		release(list, container, fn) {
			const moved = [];
			for (const item of list) {
				const el = this.$parts[item.key];
				if (el && el.parentNode && el.parentNode !== container) moved.push(el);
			}
			if (moved.length) renderer.leaving_to_jquery(moved, fn);
			else fn();
		},
		// legacy `$els.remove()`: template-drawn elements leave the state, anything else goes with jQuery
		remove_nodes($els) {
			let changed = false;
			$els.each((_, el) => {
				const rec = owned.get(el);
				if (rec) {
					owned.delete(el);
					rec.drop();
					changed = true;
				} else {
					$(el).remove();
				}
			});
			if (changed) this.flush();
		},
		item_of(el) {
			return el && owned.get(el)?.item;
		},
		// the store `parent` is, while the template draws it: a custom group's <ul> held after
		// clear_custom_actions is a caller's detached element from then on (the legacy branch)
		store_of(parent) {
			const el = parent && $(parent)[0];
			const store = el && this.$stores?.get(el);
			return store && this.$parts[store.key] === el ? store : null;
		},
		store_group_el(store) {
			return this.$parts[store.group_part];
		},
		toggle_class(el, cls, on) {
			if (el) el.classList.toggle(cls, !!on);
		},

		// ------------------------------------------------------------ indicator
		set_indicator(label, color) {
			const is_mobile = frappe.is_mobile();
			const ind = this.ind;
			// legacy .html() wrote the content every time: content a caller removed is drawn anew
			const content = this.$parts.indicator_content;
			if (ind.label !== null && this.indicator[0] && (!content || content.parentNode !== this.indicator[0])) ind.gen++;
			ind.shown = true;
			ind.label = `${label}`;
			ind.color = color;
			ind.mobile = is_mobile;
			this.flush();
			// legacy .html() replaced the content: what a caller put there goes
			this.remove_foreign_nodes(this.indicator[0], this.$parts.indicator_content);
			// clear_indicator().removeClass("hide"): removeClass() took every class, a caller's too
			this.reset_indicator_classes();
			// .attr("data-theme", color) after clear_indicator's removeAttr
			const el = this.indicator[0];
			if (color === undefined) this.indicator.removeAttr("data-theme");
			else if (el && el.getAttribute("data-theme") !== `${color}`) el.setAttribute("data-theme", color);

			if (is_mobile) {
				this.indicator.attr("title", label);
				this.indicator.tooltip();
			}
		},

		clear_indicator() {
			this.ind.shown = false;
			this.ind.color = undefined;
			this.flush();
			this.reset_indicator_classes();
			this.indicator.removeAttr("data-theme");
			return this.indicator;
		},

		reset_indicator_classes() {
			const el = this.indicator[0];
			const expected = `es-badge page-indicator-pill${this.ind.shown ? "" : " hide"}`;
			if (el && el.className !== expected) el.className = expected;
		},

		add_action_icon(icon, click, css_class = "", tooltip_label) {
			// ideally, we should pass tooltip_label this is just safe gaurd.
			if (!tooltip_label) {
				tooltip_label = frappe.unscrub(icon);
			}
			const item = reactive({ key: new_key("icon"), icon, css_class, title: __(tooltip_label) });
			this.icon_items.push(item);
			this.icon_group_shown = true;
			this.flush();
			this.toggle_class(this.icon_group[0], "hide", false);

			const button = $(this.take(item.key, item, () => drop_from(this.icon_items, item)));
			button.click(click);
			button.tooltip({ delay: { show: 600, hide: 100 }, trigger: "hover" });
			return button;
		},

		// markup handed to the caller: stays a string
		get_icon_label(icon, label) {
			let icon_name = icon;
			let size = "xs";
			if (typeof icon === "object") {
				icon_name = icon.icon;
				size = icon.size || "xs";
			}
			return `${icon ? frappe.utils.icon(icon_name, size) : ""} <span class="hidden-xs"> ${__(
				label
			)} </span>`;
		},

		// ------------------------------------------------------------ primary / secondary
		action_state(btn) {
			const el = btn && $(btn)[0];
			if (!el) return null;
			if (el === this.$parts.btn_primary) return this.primary_btn;
			if (el === this.$parts.btn_secondary) return this.secondary_btn;
			return null;
		},

		set_action(btn, opts) {
			let me = this;
			const state = this.action_state(btn);
			if (!state) return this.set_action_legacy(btn, opts);

			// clear_action_of(btn), folded into this render
			btn.unbind("click");
			// icon can be a name or { icon, size } — the es contract sizes icons
			// from the button itself, so only the name matters now. Guard against
			// null: callers pass it to skip the icon (typeof null === "object")
			const icon = opts.icon && typeof opts.icon === "object" ? opts.icon.icon : opts.icon;
			state.gen++; // button.dress() rebuilt the children every time
			state.label = opts.label;
			state.icon = icon || undefined;
			state.variant = opts.variant;
			// the component's default map (Save → Saving...) applies unless the caller gave one
			state.loading_label = opts.working_label || undefined;
			state.short_label = opts.short_label || undefined;
			// responsive label pair: the full label shows from md up, the short one below md; with an
			// icon and no short label, mobile shows the icon alone (page.scss squares the button)
			state.label_class = opts.short_label || opts.icon ? "hidden-xs" : undefined;
			if (opts.label !== undefined) state.data_label = opts.label;
			state.working_label = opts.working_label || undefined;
			state.shown = true;
			this.flush();

			// button.dress() replaced the content: what a caller put there with .html() goes
			drop_before_anchors(btn[0]);
			// what legacy wrote every time: a caller may have hidden or disabled it since
			btn.removeClass("hide").prop("disabled", false);
			if (!opts.working_label) btn.removeAttr("data-working-label");
			else if (btn.attr("data-working-label") !== `${opts.working_label}`) btn.attr("data-working-label", opts.working_label);
			// .attr("data-label", opts.label), which a caller may have changed since
			if (opts.label !== undefined && btn.attr("data-label") !== `${opts.label}`) btn.attr("data-label", opts.label);
			btn.on("click", function () {
				// busy blocks the mouse via pointer-events, but keyboard
				// activation still fires — guard re-entry
				if (btn.attr("aria-busy") === "true") return;
				let response = opts.click.apply(this, [btn]);
				me.btn_disable_enable(btn, response);
			});

			// alt shortcuts — pass the full label span alone; the button also
			// contains the spinner, loading-label and short-label spans, whose
			// text must not join in
			let text_span = btn.find(".es-button__label").first();
			frappe.ui.keys.get_shortcut_group(this).add(btn, text_span.length ? text_span : btn);
		},

		// a button that is not this page's primary or secondary one: the legacy way
		set_action_legacy(btn, opts) {
			let me = this;
			this.clear_action_of(btn);
			const icon = opts.icon && typeof opts.icon === "object" ? opts.icon.icon : opts.icon;
			const dress_opts = { label: opts.label, icon: icon, variant: opts.variant };
			if (opts.working_label) dress_opts.loading_label = opts.working_label;
			frappe.ui.button.dress(btn, dress_opts);
			btn.removeClass("hide")
				.prop("disabled", false)
				.attr("data-label", opts.label)
				.on("click", function () {
					if (btn.attr("aria-busy") === "true") return;
					let response = opts.click.apply(this, [btn]);
					me.btn_disable_enable(btn, response);
				});
			if (opts.short_label) {
				btn.find(".es-button__label").addClass("hidden-xs");
				$('<span class="es-button__label hidden-lg"></span>')
					.text(opts.short_label)
					.insertAfter(btn.find(".es-button__label").first());
			} else if (opts.icon) {
				btn.find(".es-button__label").addClass("hidden-xs");
			}
			if (opts.working_label) btn.attr("data-working-label", opts.working_label);
			let text_span = btn.find(".es-button__label").first();
			frappe.ui.keys.get_shortcut_group(this).add(btn, text_span.length ? text_span : btn);
		},

		// `label` can be a plain string, or { label, short_label } to show a
		// shorter text below the md breakpoint (e.g. "Add" for "Add Sales Order")
		set_primary_action(label, click, icon, working_label) {
			this.set_action(this.btn_primary, {
				...(label && typeof label === "object" ? label : { label }),
				click: click,
				icon: icon,
				working_label: working_label,
				variant: "solid",
			});
			this.set_primary_action_options(label?.options);
			return this.btn_primary;
		},

		// Other ways to do what the primary action does, in a menu on the chevron beside it.
		set_primary_action_options(options) {
			this.primary_action_dropdown?.destroy();
			this.primary_action_dropdown = null;
			this.primary_menu_hidden = !options?.length;
			this.flush();
			this.btn_primary_menu.prop("hidden", !options?.length);
			if (!options?.length) return;

			this.primary_action_dropdown = new frappe.ui.Dropdown({
				trigger: this.btn_primary_menu,
				options,
				align: "end",
				sheet_on_mobile: true,
			});
		},

		set_secondary_action(label, click, icon, working_label) {
			this.set_action(this.btn_secondary, {
				...(label && typeof label === "object" ? label : { label }),
				click: click,
				icon: icon,
				working_label: working_label,
				variant: "subtle",
			});

			return this.btn_secondary;
		},

		clear_action_of(btn) {
			const state = this.action_state(btn);
			if (state) {
				state.shown = false;
				state.working_label = undefined;
				this.flush();
			}
			btn.addClass("hide").unbind("click").removeAttr("data-working-label");
		},

		clear_primary_action() {
			this.clear_action_of(this.btn_primary);
			this.set_primary_action_options(null);
		},

		clear_secondary_action() {
			this.clear_action_of(this.btn_secondary);
		},

		clear_actions() {
			this.clear_primary_action();
			this.clear_secondary_action();
		},

		// Close and tear down the espresso dropdowns of button groups inside
		// $scope before their elements are discarded — an open menu body-portals,
		// so removing its group would otherwise leave the panel floating over
		// the page with its listeners live.
		destroy_group_dropdowns($scope) {
			$scope
				.find(".inner-group-button, .custom-btn-group")
				.addBack(".inner-group-button, .custom-btn-group")
				.each((_, group) => {
					$(group).data("es_dropdown")?.destroy();
				});
		},

		clear_custom_actions() {
			this.destroy_group_dropdowns(this.custom_actions);
			this.release(this.toolbar_items, this.custom_actions[0], () => {
				this.toolbar_items.splice(0);
				this.inner_message = null;
				this.toolbar_shown = false;
				this.flush();
			});
			// legacy .empty(): what callers put here goes too (the list view's view switcher, ...)
			this.remove_foreign(this.custom_actions);
			this.custom_actions.addClass("hide");
			this.clear_mobile_custom_groups();
		},
		clear_mobile_custom_groups() {
			const $groups = this.custom_mobile_actions.children(".custom-btn-group:not(.view-switcher)");
			this.destroy_group_dropdowns($groups);
			this.remove_nodes($groups);
		},

		clear_icons() {
			this.release(this.icon_items, this.icon_group[0], () => {
				this.icon_items.splice(0);
				this.icon_group_shown = false;
				this.flush();
			});
			this.remove_foreign(this.icon_group);
			this.icon_group.addClass("hide");
		},

		//--- Menu --//

		add_menu_item(label, click, standard, shortcut, show_parent, group) {
			return this.add_dropdown_item({
				label,
				click,
				standard,
				parent: this.menu,
				shortcut,
				show_parent,
				group,
			});
		},

		add_custom_menu_item(parent, label, click, standard, shortcut, icon = null) {
			return this.add_dropdown_item({
				label,
				click,
				standard,
				parent: parent,
				shortcut,
				icon,
			});
		},

		clear_menu() {
			this.clear_btn_group(this.menu);
		},

		show_menu() {
			this.set_store_hidden(this.menu_store, false);
		},

		hide_menu() {
			this.set_store_hidden(this.menu_store, true);
		},

		set_store_hidden(store, hide) {
			store.hidden = hide;
			this.flush();
			this.toggle_class(this.store_group_el(store), "hide", hide);
		},

		show_icon_group() {
			this.icon_group_shown = true;
			this.flush();
			this.icon_group.removeClass("hide");
		},

		hide_icon_group() {
			this.icon_group_shown = false;
			this.flush();
			this.icon_group.addClass("hide");
		},

		//--- Actions Menu--//

		show_actions_menu() {
			this.set_store_hidden(this.actions_store, false);
		},

		hide_actions_menu() {
			this.set_store_hidden(this.actions_store, true);
		},

		add_action_item(label, click, standard, icon = null) {
			return this.add_dropdown_item({
				label,
				click,
				standard,
				icon,
				parent: this.actions,
			});
		},

		add_actions_menu_item(label, click, standard, shortcut, icon = null, theme = null) {
			return this.add_dropdown_item({
				label,
				click,
				standard,
				shortcut,
				icon,
				theme,
				parent: this.actions,
				show_parent: false,
			});
		},

		clear_actions_menu() {
			this.clear_btn_group(this.actions);
		},

		//-- Generic --//

		/*
		 * Add label to given drop down menu. If label, is already contained in the drop
		 * down menu, it will be ignored.
		 * @param {string} label - Text for the drop down menu
		 * @param {function} click - function to be called when `label` is clicked
		 * @param {Boolean} standard
		 * @param {object} parent - DOM object representing the parent of the drop down item lists
		 * @param {string} shortcut - Keyboard shortcut associated with the element
		 * @param {Boolean} show_parent - Whether to show the dropdown button if dropdown item is added
		 * @param {string} group - Heading the item is listed under; items sharing one sit together
		 */
		add_dropdown_item(opts) {
			const store = this.store_of(opts.parent);
			if (!store || !this.alive()) return this.add_dropdown_item_legacy(opts);
			const out = this.push_store_item(store, opts);
			this.flush();
			return this.drawn_store_item(store, out);
		},

		// the state half of add_dropdown_item: no render. Returns the existing link (legacy dedupe)
		// or the new item.
		push_store_item(
			store,
			{
				label,
				click,
				standard,
				parent,
				shortcut,
				show_parent = true,
				icon = null,
				icon_right = null,
				theme = null,
				group = null,
			}
		) {
			if (show_parent) {
				store.hidden = false;
				store.hidden_xl = false;
				store.show_parent = true; // put back on the DOM after the render (drawn_store_item)
			}

			let $link = this.is_in_group_button_dropdown(parent, "li > a.grey-link > span", label);
			if ($link) return { $link };

			const item = markRaw({
				key: new_key("mi"),
				label: `${label}`,
				data_label: encodeURIComponent(label),
				click,
				icon,
				icon_right,
				theme,
				group,
				user: !standard,
				hidden_xl: false,
				submenu: null,
				shortcut: null,
				shortcut_label: null,
			});
			if (shortcut) {
				let shortcut_obj = this.prepare_shortcut_obj(shortcut, click, label);
				item.shortcut_label = shortcut_obj.shortcut_label;
				item.shortcut = shortcut_obj.shortcut;
				// binding stays here — the menu rows only display the combo
				frappe.ui.keys.add_shortcut(shortcut_obj);
			}
			if (standard) {
				change_rows(store, () => store.rows.push(item));
			} else {
				// legacy: before the user-action divider, which is put first when there is none
				let at = store.udiv ? store.head.indexOf(store.udiv) : -1;
				if (at < 0) {
					store.udiv = markRaw({ key: new_key("udiv"), divider: true, user: true, placed: false });
					change_rows(store, () => store.head.unshift(store.udiv));
					at = 0;
				}
				change_rows(store, () => store.head.splice(at, 0, item));
			}
			return { item };
		},

		// after the render: the link to return, the divider's element, the parent's classes
		drawn_store_item(store, { $link, item }) {
			if (store.show_parent) {
				store.show_parent = false;
				$(this.store_group_el(store)).removeClass("hide hidden-xl");
			}
			const udiv = store.udiv;
			if (udiv && !udiv.placed) {
				// legacy prependTo(parent): a new divider, and the item put before it, go first in the
				// <ul>, before what callers appended there. The next user items go before the
				// divider's element, where it now is.
				udiv.placed = true;
				const ul = this.$parts[store.key];
				const els = store.head
					.slice(0, store.head.indexOf(udiv) + 1)
					.map((row) => this.$parts[row.key])
					.filter(Boolean);
				if (ul && els.length && ul.firstElementChild !== els[0])
					for (let i = els.length - 1; i >= 0; i--) ul.insertBefore(els[i], ul.firstChild);
			}
			if (udiv) {
				const divider = this.take(udiv.key, udiv, () => drop_row(store, udiv));
				this.divider = $(divider);
			}
			if ($link) return $link;
			const li = this.take(item.key, item, () => drop_row(store, item));
			return $(li).children("a");
		},

		// a <ul> that is not one of this page's stores (a caller's own): the legacy way
		add_dropdown_item_legacy({
			label,
			click,
			standard,
			parent,
			shortcut,
			show_parent = true,
			icon = null,
			icon_right = null,
			theme = null,
			group = null,
		}) {
			if (show_parent) {
				parent.parent().removeClass("hide hidden-xl");
			}

			let $link = this.is_in_group_button_dropdown(parent, "li > a.grey-link > span", label);
			if ($link) return $link;

			let $li;
			let $icon = ``;

			if (icon) {
				$icon = `<span class="menu-item-icon flex align-items-center justify-items-center">${frappe.utils.icon(
					icon
				)}</span>`;
			}

			const data_label = encodeURIComponent(label);
			if (shortcut) {
				let shortcut_obj = this.prepare_shortcut_obj(shortcut, click, label);
				$li = $(`
					<li>
						<a class="grey-link dropdown-item" href="#" onClick="return false;">
							${$icon}
							<span class="menu-item-label" data-label="${data_label}">${label}</span>
							<span class="menu-item-shortcut">${shortcut_obj.shortcut_label}</span>
						</a>
					</li>
				`);
				frappe.ui.keys.add_shortcut(shortcut_obj);
				$li.data("menu_shortcut", shortcut_obj.shortcut);
			} else {
				$li = $(`
					<li>
						<a class="grey-link dropdown-item" href="#" onClick="return false;">
							${$icon}
							<span class="menu-item-label" data-label="${data_label}">${label}</span>
						</a>
					</li>
				`);
			}

			$li.data("menu_click", click);
			if (icon) $li.data("menu_icon", icon);
			if (icon_right) $li.data("menu_icon_right", icon_right);
			if (theme) $li.data("menu_theme", theme);
			if (group) $li.data("menu_group", group);

			$link = $li.find("a").on("click", (e) => {
				if (e.ctrlKey || e.metaKey) {
					frappe.open_in_new_tab = true;
				}
				return click();
			});

			if (standard) {
				$li.appendTo(parent);
			} else {
				this.divider = parent.find(".dropdown-divider.user-action");
				if (!this.divider.length) {
					this.divider = $('<li class="dropdown-divider user-action visible-xs"></li>').prependTo(
						parent
					);
				}
				$li.addClass("user-action").insertBefore(this.divider);
			}

			return $link;
		},

		// What build_dropdown_options reads off a row: the item's state for a row the template
		// drew, jQuery data for a raw <li> an app appended (or one from the legacy branch).
		item_data(li, key) {
			const item = this.item_of(li);
			if (!item) return $(li).data(key);
			switch (key) {
				case "menu_click":
					return item.click;
				case "menu_icon":
					return item.icon;
				case "menu_icon_right":
					return item.icon_right;
				case "menu_theme":
					return item.theme;
				case "menu_group":
					return item.group;
				case "menu_shortcut":
					return item.shortcut;
				case "menu_submenu":
					return item.submenu;
			}
		},
		// add_inner_button's `menu_item.closest("li").data("menu_submenu", ...)`
		set_item_data($li, key, value) {
			$li.each((_, li) => {
				const item = this.item_of(li);
				if (item && key === "menu_submenu") item.submenu = value;
				else $(li).data(key, value);
			});
		},

		// Snapshot a hidden item store (this.menu / this.actions) into menu rows.
		// Reading the live elements on every open is what keeps the legacy jQuery
		// contract alive: .text(), .toggle(), .addClass("disabled") on a held item
		// all show up the next time the menu opens. Divider <li>s split groups, and
		// an item added with a `group` joins the group of that heading.
		build_dropdown_options($parent) {
			// classes internal to the legacy markup; everything else (visible-xs,
			// hidden-xl, caller classes) is carried onto the rendered row
			const internal = ["grey-link", "dropdown-item", "disabled", "user-action"];
			// the responsive utilities, evaluated at open time — a group whose
			// rows are all CSS-hidden would still paint its separator, and the
			// legacy divider was itself visible-xs (desktop menus had none)
			const responsive_hidden = (el) =>
				(el.classList.contains("visible-xs") &&
					window.matchMedia("(min-width: 576px)").matches) ||
				(el.classList.contains("hidden-xs") &&
					window.matchMedia("(max-width: 767.98px)").matches) ||
				(el.classList.contains("hidden-xl") &&
					window.matchMedia("(min-width: 992px)").matches);
			const segments = [[]];
			const headed = new Map();
			const segment_for = (heading) => {
				if (heading) {
					if (!headed.has(heading)) {
						const segment = Object.assign([], { heading });
						headed.set(heading, segment);
						segments.push(segment);
					}
					return headed.get(heading);
				}
				if (segments[segments.length - 1].heading) segments.push([]);
				return segments[segments.length - 1];
			};
			// one submenu row per inner-button group, keyed by group label
			const nested_groups = new Map();

			$parent.children("li").each((_, li) => {
				if (li.classList.contains("dropdown-divider")) {
					const last = segments[segments.length - 1];
					if (!responsive_hidden(li) && (last.length || last.heading)) {
						segments.push([]);
					}
					return;
				}
				const $li = $(li);
				const a = $li.children("a").get(0);
				if (!a) return;
				// .toggle(false) / .hide() by callers
				if (li.style.display === "none" || a.style.display === "none") return;
				if (responsive_hidden(li) || responsive_hidden(a)) return;

				// .text(label) on the held <a> replaces its children, so fall back
				const label = ($li.find(".menu-item-label").text() || $(a).text()).trim();
				if (!label) return;

				const css_class = [...li.classList, ...a.classList]
					.filter((c) => !internal.includes(c))
					.join(" ");
				const click = this.item_data(li, "menu_click");
				const onclick = (e) => {
					if (e && (e.ctrlKey || e.metaKey)) {
						frappe.open_in_new_tab = true;
					}
					// raw <li>s appended by apps have no stashed handler —
					// clicking their own link keeps them working
					return click ? click() : a.click();
				};

				// grouped inner buttons mirror into this menu on mobile as flat
				// "Group > Label" store items (see add_inner_button) — render
				// them as one "Group" row with a submenu instead
				const nested = this.item_data(li, "menu_submenu");
				if (nested) {
					let submenu = nested_groups.get(nested.group);
					if (!submenu) {
						submenu = [];
						nested_groups.set(nested.group, submenu);
						segment_for(this.item_data(li, "menu_group")).push({
							label: nested.group,
							css_class: css_class || undefined,
							submenu,
						});
					}
					submenu.push({
						label: nested.label,
						disabled: a.classList.contains("disabled"),
						onclick,
					});
					return;
				}

				segment_for(this.item_data(li, "menu_group")).push({
					label,
					icon: this.item_data(li, "menu_icon") || undefined,
					icon_right: this.item_data(li, "menu_icon_right") || undefined,
					theme: this.item_data(li, "menu_theme") || undefined,
					shortcut: this.item_data(li, "menu_shortcut") || undefined,
					disabled: a.classList.contains("disabled"),
					css_class: css_class || undefined,
					onclick,
				});
			});

			const groups = segments.filter((segment) => segment.length);
			if (groups.length <= 1 && !groups[0]?.heading) return groups[0] || [];
			return groups.map((options) => ({
				group: options.heading || "",
				hide_label: !options.heading,
				options: [...options],
			}));
		},

		prepare_shortcut_obj(shortcut, click, label) {
			let shortcut_obj;
			// convert to object, if shortcut string passed
			if (typeof shortcut === "string") {
				shortcut_obj = { shortcut };
			} else {
				shortcut_obj = shortcut;
			}
			shortcut_obj.shortcut_label = frappe.ui.keys.get_shortcut_label(shortcut_obj.shortcut);

			// actual shortcut string
			shortcut_obj.shortcut = shortcut_obj.shortcut.toLowerCase();
			// action is button click
			if (!shortcut_obj.action) {
				shortcut_obj.action = click;
			}
			// shortcut description can be button label
			if (!shortcut_obj.description) {
				shortcut_obj.description = label;
			}
			// page
			shortcut_obj.page = this;
			return shortcut_obj;
		},

		/*
		 * Check if there already exists a button with a specified label in a specified button group
		 * @param {object} parent - This should be the `ul` of the button group.
		 * @param {string} selector - CSS Selector of the button to be searched for. By default, it is `li`.
		 * @param {string} label - Label of the button
		 */
		is_in_group_button_dropdown(parent, selector, label) {
			if (!selector) selector = "li";

			if (!label || !parent) return false;

			const item_selector = `${selector}[data-label="${encodeURIComponent(label)}"]`;

			const existing_items = $(parent).find(item_selector);
			return existing_items?.length > 0 && existing_items;
		},

		clear_btn_group(parent) {
			// a refresh can clear the store while its menu is open — close it so
			// the portaled panel doesn't float on with stale rows
			if (parent.is(this.menu)) this.menu_dropdown?.close("owner");
			if (parent.is(this.actions)) this.actions_dropdown?.close("owner");
			const store = this.store_of(parent);
			if (store) {
				this.release([...store.head, ...store.rows], this.$parts[store.key], () => {
					change_rows(store, () => {
						store.head.splice(0);
						store.rows.splice(0);
					});
					store.udiv = null;
					store.hidden = true;
					this.flush();
				});
				// legacy .empty(): raw <li>s callers appended go too
				this.remove_foreign(parent);
			} else {
				parent.empty();
			}
			parent.parent().addClass("hide");
		},

		add_divider() {
			const store = this.menu_store;
			const item = markRaw({ key: new_key("div"), divider: true });
			change_rows(store, () => store.rows.push(item));
			this.flush();
			return $(this.take(item.key, item, () => drop_row(store, item)));
		},

		// the toolbar entry (inner button, inner group, custom group) that drew `el`
		entry_of(el) {
			const item = this.item_of(el);
			return item && item.kind ? item : null;
		},
		// the list a toolbar container's entries live in
		entries_of(parent) {
			const el = parent && $(parent)[0];
			if (!el) return null;
			if (el === this.$parts.custom_actions) return this.toolbar_items;
			if (el === this.$parts.custom_mobile_actions) return this.mobile_groups;
			return null;
		},
		show_toolbar() {
			this.toolbar_shown = true;
		},

		get_or_add_inner_group_button(label, align_right) {
			const found = this.find_or_push_group(label, align_right);
			if (found.entry) {
				this.flush();
				return this.drawn_group(found.entry);
			}
			return found.$group;
		},

		// the state half: the group the toolbar already shows, or a new entry (drawn by the next render)
		find_or_push_group(label, align_right) {
			const $group = this.inner_toolbar.find(
				`.inner-group-button[data-label="${encodeURIComponent(label)}"]`
			);
			if ($group.length || !this.alive()) return { $group };
			const entry = reactive({
				key: new_key("grp"),
				kind: "group",
				label: `${label}`,
				data_label: encodeURIComponent(label),
				align_right: !!align_right,
				variant: undefined,
				hidden: false,
				items: [],
			});
			this.toolbar_items.push(entry);
			return { entry };
		},

		// after the render: the group's element, and the espresso dropdown on its button
		drawn_group(entry) {
			const $group = $(this.take(entry.key, entry, () => this.drop_entry(this.toolbar_items, entry)));
			const $btn = $(this.$parts[`${entry.key}:btn`]);
			// the same bridge as the header menus: the .dropdown-menu div is a hidden item store
			// (add_inner_button returns its <a>s to callers, who mutate them), and the espresso
			// dropdown snapshots it on every open
			$group.data(
				"es_dropdown",
				new frappe.ui.Dropdown({
					trigger: $btn,
					align: entry.align_right ? "end" : "start",
					options: () => this.build_inner_group_options($group.children(".dropdown-menu")),
				})
			);
			return $group;
		},

		drop_entry(list, entry) {
			drop_from(list, entry);
		},

		// Snapshot an inner group's item store — bare <a.dropdown-item> children
		// plus divider <li>s — into menu rows; same live-read contract as
		// build_dropdown_options, so held-reference mutations show on next open.
		build_inner_group_options($store) {
			const segments = [[]];
			$store.children().each((_, el) => {
				if (el.classList.contains("dropdown-divider")) {
					if (segments[segments.length - 1].length) segments.push([]);
					return;
				}
				// match by tag, not .dropdown-item — change_inner_button_type's
				// legacy removeClass() strips ALL classes off the store item
				if (el.tagName !== "A" || el.style.display === "none") return;
				const label = $(el).text().trim();
				if (!label) return;
				const internal = ["dropdown-item", "disabled", "btn", "btn-danger", "text-danger"];
				const css_class = [...el.classList].filter((c) => !internal.includes(c)).join(" ");
				segments[segments.length - 1].push({
					label,
					disabled: el.classList.contains("disabled"),
					// btn-danger comes from change_inner_button_type(label, group,
					// "danger"); text-danger is how apps mark risky rows
					theme:
						el.classList.contains("btn-danger") || el.classList.contains("text-danger")
							? "red"
							: undefined,
					css_class: css_class || undefined,
					// clicking the store element runs every handler callers bound
					onclick: () => $(el).trigger("click"),
				});
			});
			const groups = segments.filter((segment) => segment.length);
			if (groups.length <= 1) return groups[0] || [];
			return groups.map((options) => ({ group: "", hide_label: true, options }));
		},

		get_inner_group_button(label) {
			return this.inner_toolbar.find(
				`.inner-group-button[data-label="${encodeURIComponent(label)}"]`
			);
		},

		set_inner_btn_group_as_primary(label) {
			const group = this.get_or_add_inner_group_button(label);
			const dropdown_items = group.find(".dropdown-menu .dropdown-item");
			const entry = this.entry_of(group[0]);

			if (dropdown_items.length > 0) {
				if (entry) {
					entry.variant = "solid";
					this.flush();
				} else group.find("button").attr("data-variant", "solid");
			} else {
				if (entry) {
					entry.hidden = true;
					this.flush();
				}
				group.toggleClass("hide", true);
			}
		},

		btn_disable_enable(btn, response) {
			// aria-busy, not disabled: disabling ejects keyboard focus, busy shows
			// the es-button spinner/loading-label and blocks clicks. Direct
			// .prop("disabled") pokes from outside still work (es-button styles
			// :disabled) — this only changes what the page does on its own.
			const busy = (on) => (on ? btn.attr("aria-busy", "true") : btn.removeAttr("aria-busy"));
			if (response && response.finally) {
				busy(true);
				response.finally(() => busy(false));
			} else if (response && response.always) {
				busy(true);
				response.always(() => busy(false));
			}
		},
		add_divider_to_button_group(group) {
			var $group = this.get_or_add_inner_group_button(group);
			const entry = this.entry_of($group[0]);
			if (!entry) {
				// a group the template did not draw
				$('<li class="dropdown-divider"></li>').appendTo($group.find(".dropdown-menu"));
				return;
			}
			const item = reactive({ key: new_key("gdiv"), divider: true });
			entry.items.push(item);
			this.flush();
			this.take(item.key, item, () => drop_from(entry.items, item));
		},
		/*
		 * Add button to button group. If there exists another button with the same label,
		 * `add_inner_button` will not add the new button to the button group even if the callback
		 * function is different.
		 *
		 * @param {string} label - Label of the button to be added to the group
		 * @param {object} action - function to be called when button is clicked
		 * @param {string} group - Label of the group button
		 */
		// One render for all of it: the mobile menu item, the menu's visibility, the group, the item.
		add_inner_button(label, action, group, type = "default", align_right = false) {
			var me = this;
			let _action = function () {
				let btn = $(this);
				let response = action();
				me.btn_disable_enable(btn, response);
			};

			// Add actions as menu item in Mobile View. The store keeps the flat
			// "Group > Label" item (dedupe and remove_custom_button look it up by
			// that label) — the snapshot renders stamped items as a nested
			// "Group" row with a submenu instead.
			let menu_item_label = group ? `${group} > ${label}` : label;
			const menu = this.push_mobile_menu_item(menu_item_label, _action, group ? { group, label } : null, false);
			const menu_group = this.menu_btn_group[0];
			const show_menu_group = !!(menu_group && menu_group.classList.contains("hide"));
			if (show_menu_group) {
				this.menu_store.hidden = false;
				this.menu_store.hidden_xl = true;
			}
			const finish_menu = () => {
				this.drawn_mobile_menu_item(menu);
				if (show_menu_group) this.menu_btn_group.removeClass("hide").addClass("hidden-xl");
			};

			if (group) {
				const found = this.find_or_push_group(group, align_right);
				this.toolbar_shown = true;
				// a new group has no items yet
				const exists =
					found.$group && this.is_in_group_button_dropdown(found.$group.find(".dropdown-menu"), "a", label);
				const entry = found.entry || (found.$group && this.entry_of(found.$group[0]));
				let item = null;
				if (!exists && entry) {
					item = reactive({
						key: new_key("gi"),
						label: `${label}`,
						data_label: encodeURIComponent(label),
						cls: "dropdown-item",
						action: _action,
					});
					entry.items.push(item);
				}
				this.flush();
				finish_menu();
				const $group = found.entry ? this.drawn_group(found.entry) : found.$group;
				$(this.inner_toolbar).removeClass("hide");

				if (!exists) {
					if (!entry) {
						// a group the template did not draw
						return $(
							`<a class="dropdown-item" href="#" onclick="return false;" data-label="${encodeURIComponent(
								label
							)}">${label}</a>`
						)
							.on("click", _action)
							.appendTo($group.find(".dropdown-menu"));
					}
					return $(this.take(item.key, item, () => drop_from(entry.items, item)));
				}
			} else {
				let button = this.inner_toolbar.find(`button[data-label="${encodeURIComponent(label)}"]`);
				let entry = null;
				if (button.length == 0 && this.alive()) {
					entry = reactive({
						key: new_key("ib"),
						kind: "button",
						button: {
							label: __(label),
							...es_opts_for_btn_type(type),
							class: "ellipsis",
							"data-label": encodeURIComponent(label),
						},
					});
					this.toolbar_items.push(entry);
					this.toolbar_shown = true;
				}
				this.flush();
				finish_menu();
				if (entry) {
					button = $(this.take(entry.key, entry, () => drop_from(this.toolbar_items, entry)));
					button.on("click", _action);
					this.inner_toolbar.removeClass("hide");
				}
				return button;
			}
		},

		// add_inner_button's and add_button's mobile mirror: a user item in the Menu store, hidden
		// from xl up (`menu_item.parent().addClass("hidden-xl")`). The state half; the caller renders.
		push_mobile_menu_item(label, click, submenu, show_parent) {
			const store = this.menu_store;
			if (!this.alive()) return null;
			const out = this.push_store_item(store, {
				label,
				click,
				standard: false,
				parent: this.menu,
				show_parent,
			});
			if (out.item) {
				out.item.hidden_xl = true;
				if (submenu) out.item.submenu = submenu;
			}
			return { out, submenu };
		},
		drawn_mobile_menu_item(pushed) {
			if (!pushed) return $();
			const { out, submenu } = pushed;
			const menu_item = this.drawn_store_item(this.menu_store, out);
			if (!out.item) {
				// legacy dedupe returned the label spans: its .closest("li") / .parent() pokes
				if (submenu) this.set_item_data(menu_item.closest("li"), "menu_submenu", submenu);
				menu_item.parent().addClass("hidden-xl");
			}
			return menu_item;
		},

		remove_inner_button(label, group) {
			if (typeof label === "string") {
				label = [label];
			}
			// translate
			label = label.map((l) => __(l));

			if (group) {
				var $group = this.get_inner_group_button(__(group));
				if ($group.length) {
					this.remove_nodes(
						$group.find(`.dropdown-item[data-label="${encodeURIComponent(label)}"]`)
					);
				}
				if ($group.find(".dropdown-item").length === 0) {
					this.destroy_group_dropdowns($group);
					this.remove_nodes($group);
				}
			} else {
				this.remove_nodes(
					this.inner_toolbar.find(`button[data-label="${encodeURIComponent(label)}"]`)
				);
			}
		},

		change_inner_button_type(label, group, type) {
			let btn;

			if (group) {
				// the class poke lands on the store item; the snapshot maps
				// btn-danger to the red row theme. Strips extra classes
				// (pre-existing behavior).
				var $group = this.get_inner_group_button(__(group));
				if ($group.length) {
					btn = $group.find(`.dropdown-item[data-label="${encodeURIComponent(label)}"]`);
					const cls = `btn btn-${type} ellipsis`;
					const drawn = [];
					btn.each((_, el) => {
						const item = this.item_of(el);
						if (item) {
							item.cls = cls;
							drawn.push(el);
						} else $(el).removeClass().addClass(cls);
					});
					if (drawn.length) {
						this.flush();
						// removeClass() took a caller's classes too
						for (const el of drawn) if (el.className !== cls) el.className = cls;
					}
				}
			} else {
				// es-buttons change look via data attributes — the classes
				// (es-button, ellipsis, data-label hooks) must survive
				btn = this.inner_toolbar.find(`button[data-label="${encodeURIComponent(label)}"]`);
				if (btn.length) {
					const es = es_opts_for_btn_type(type);
					let drawn = false;
					btn.each((_, el) => {
						const entry = this.entry_of(el);
						if (entry && entry.button) {
							entry.button = { ...entry.button, variant: es.variant, theme: es.theme };
							drawn = true;
						} else {
							es.variant === "subtle"
								? $(el).removeAttr("data-variant")
								: $(el).attr("data-variant", es.variant);
							es.theme ? $(el).attr("data-theme", es.theme) : $(el).removeAttr("data-theme");
						}
					});
					if (drawn) this.flush();
					// what legacy wrote every time, whatever a caller set since
					btn.each((_, el) => {
						const variant = es.variant === "subtle" ? null : es.variant;
						if (el.getAttribute("data-variant") !== variant)
							variant ? el.setAttribute("data-variant", variant) : el.removeAttribute("data-variant");
						const theme = es.theme || null;
						if (el.getAttribute("data-theme") !== theme)
							theme ? el.setAttribute("data-theme", theme) : el.removeAttribute("data-theme");
					});
				}
			}
		},

		add_inner_message(message) {
			// a message some caller put here the legacy way goes too
			this.inner_toolbar
				.find(".inner-page-message")
				.filter((_, el) => el !== this.$parts.inner_message)
				.remove();
			this.inner_message = `${message}`;
			this.inner_message_gen++; // a new element, as legacy made one
			this.toolbar_shown = true;
			this.flush();
			this.inner_toolbar.removeClass("hide");
			// legacy prepend(): first in the toolbar, before what callers put there (also after
			// they emptied it and appended their own, which leaves the template's anchors behind it)
			const msg = this.$parts.inner_message;
			const box = this.custom_actions[0];
			if (msg && box && box.firstChild !== msg) box.insertBefore(msg, box.firstChild);
			return $(this.take("inner_message", null, () => (this.inner_message = null)));
		},

		clear_inner_toolbar() {
			// inner_toolbar IS custom_actions (see setup_page) — delegate so the
			// dropdown teardown and the mobile-container clear live in one place
			this.clear_custom_actions();
		},

		clear_user_actions() {
			this.remove_nodes(this.menu.find(".user-action"));
		},

		// page::title
		get_title_area() {
			return this.$title_area;
		},

		/**
		 * The trail in this page's head. The last item is the page itself, so it carries no `href`.
		 *
		 * Each page owns its own items and its own markup. A view can only change the trail of the
		 * page it was handed, which is why an off-screen form cannot touch the one on screen.
		 *
		 * @param {Array<Object>} items espresso breadcrumb items: `label`, `href`, `onclick`,
		 *   `prefix`, `suffix`, `title`
		 */
		set_breadcrumbs(items) {
			this.breadcrumbs = items || [];
			// explicit items win over anything `frappe.breadcrumbs.add()` left here
			this.legacy_breadcrumbs = null;
			this.render_breadcrumbs();
		},

		/** @returns {Array<Object>} the trail this page holds, whichever API set it */
		get_breadcrumbs() {
			// a legacy `add()` payload is resolved on every read, not at call time, because the old
			// API let a caller name a document before it had finished loading
			if (this.legacy_breadcrumbs) return frappe.breadcrumbs.resolve(this.legacy_breadcrumbs);
			return this.breadcrumbs || [];
		},

		render_breadcrumbs() {
			const $nav = this.$title_area?.find(".navbar-breadcrumbs");
			if (!$nav?.length || !this.alive()) return;
			const nav = this.$parts.breadcrumbs_nav;

			// a page inside a dialog has a head of its own but no business drawing a trail in it
			const items = this.show_breadcrumbs === false ? [] : this.get_breadcrumbs().slice();
			// the title (last crumb) becomes a button when something sets an action for it
			const title_action = items.length && frappe.ui.Page.title_action?.();
			if (title_action) items.push({ ...items.pop(), onclick: title_action });

			this.crumbs_mobile = !!frappe.is_mobile();
			// the list is refilled rather than replaced, so a reference held by
			// `frappe.breadcrumbs.$breadcrumbs` stays good across paints. Taken out from outside:
			// a new one; emptied from outside: new crumbs (legacy refilled it every time).
			const ol = this.$parts.crumbs;
			if (!ol || ol.parentNode !== nav) this.crumbs_ol_gen++;
			// legacy .empty().append(): new crumbs every time, so a held <li> leaves with what a
			// caller did to it
			else if (this.crumb_items.length) this.crumbs_gen++;
			this.crumb_items = items.map((item, i) => this.crumb_of(item, i === items.length - 1));
			this.flush();
			this.$breadcrumbs = $(this.$parts.crumbs);
			// what callers appended to the list goes, as the legacy .empty() took it
			const mine = new Set(this.crumb_items.map((_, i) => this.$parts[`crumb:${i}`]));
			this.$breadcrumbs.children().filter((_, li) => !mine.has(li)).remove();
		},

		// one item of frappe.ui.breadcrumbs({ items }), as the template draws it
		crumb_of(item, last) {
			const href = safe_href(item.href, "breadcrumbs");
			const title = item.title || (last ? item.label : "");
			let aria_label;
			if (!item.label && (item.prefix || item.suffix)) {
				if (item.title) aria_label = item.title;
				else console.warn("frappe.ui.breadcrumbs: an icon-only crumb needs a title for accessibility");
			}
			const affix = (value) => {
				if (!value) return null;
				if (typeof value !== "string") {
					console.warn("frappe.ui.breadcrumbs: prefix/suffix take a lucide icon name");
					return null;
				}
				return value;
			};
			return {
				tag: href ? "a" : item.onclick ? "button" : "span",
				href,
				label: item.label,
				prefix: affix(item.prefix),
				suffix: affix(item.suffix),
				title: title || undefined,
				last,
				aria_label,
				onclick: item.onclick,
			};
		},

		// legacy bound item.onclick with jQuery: `this` is the crumb, the event a jQuery one
		crumb_click(crumb, e) {
			if (crumb.onclick.call(e.currentTarget, $.event.fix(e)) === false) {
				e.preventDefault();
				e.stopPropagation();
			}
		},

		set_title(title, icon = null, strip = true, tab_title = "", tooltip_label = "") {
			if (!title) title = "";
			if (strip) {
				title = strip_html(title);
			}
			this.title = title;
			if (this.set_document_title) {
				frappe.utils.set_title(tab_title || title);
			}

			// the title is the last crumb, so there is only ever one node naming the page
			const items = (this.breadcrumbs || []).slice();
			const last = { ...(items.pop() || {}) };
			last.label = title;
			last.title = __(tooltip_label) || title;
			// the page is where the reader already is; a link back to it is noise
			delete last.href;
			delete last.onclick;
			if (icon) last.prefix = icon;
			items.push(last);

			this.set_breadcrumbs(items);
		},

		// $sub_title_area is whatever h6 the wrapper held when the page was made (page.html has none)
		set_title_sub(txt) {
			// strip icon
			this.$sub_title_area.html(txt).toggleClass("hide", !!!txt);
		},

		// page.html has no .title-icon: this finds one only if a caller put it in the title area
		get_main_icon(icon) {
			return this.$title_area.find(".title-icon").html(frappe.utils.icon(icon)).toggle(true);
		},

		add_help_button(txt) {
			//
		},

		add_button(label, click, opts) {
			if (!opts) opts = {};
			// btn_class/btn_size keep their bootstrap vocabulary ("btn-primary",
			// "btn-xs") and are mapped onto the es contract; a class we don't
			// recognize passes through so custom hooks keep working
			const type = (opts.btn_class || "btn-default").replace(/^btn-/, "");
			const known = Boolean(BTN_TYPE_TO_ES[type]);
			if (!this.alive()) return $();
			// Add actions as menu item in Mobile View (similar to "add_custom_button" in forms.js)
			// (legacy add_menu_item(label, click, false): show_parent defaults to true)
			const menu = this.push_mobile_menu_item(label, click, null, undefined);

			const entry = reactive({
				key: new_key("btn"),
				kind: "button",
				button: {
					label: label,
					icon: opts.icon,
					...es_opts_for_btn_type(type),
					size: opts.btn_size === "btn-xs" ? "xs" : undefined,
					class: ["ellipsis", !known && opts.btn_class].filter(Boolean).join(" "),
					"data-label": encodeURIComponent(label),
				},
			});
			this.toolbar_items.push(entry);
			this.toolbar_shown = true;
			this.flush();
			this.drawn_mobile_menu_item(menu);
			let button = $(this.take(entry.key, entry, () => drop_from(this.toolbar_items, entry)));
			button.on("click", click);
			this.custom_actions.removeClass("hide");

			return button;
		},

		add_custom_button_group(label, icon, parent) {
			// same bridge as the header menus: the UL is a hidden item store
			// (add_custom_menu_item writes li > a there and returns the link),
			// rendered as an espresso menu per open
			if (!parent) parent = frappe.is_mobile() ? this.custom_mobile_actions : this.custom_actions;
			const list = this.alive() && this.entries_of(parent);
			if (!list) return this.add_custom_button_group_legacy(label, icon, parent);

			const entry = reactive({
				key: new_key("cg"),
				kind: "custom_group",
				label: __(label),
				icon: icon || undefined,
				store: new_store(false),
			});
			entry.store.group_part = entry.key;
			list.push(entry);
			if (list === this.toolbar_items) this.toolbar_shown = true;
			this.flush();
			parent.removeClass("hide");
			const custom_btn_group = this.take(entry.key, entry, () => drop_from(list, entry));
			const store_el = this.$parts[entry.store.key];
			this.$stores.set(store_el, entry.store);

			const $store = $(store_el);
			$(custom_btn_group).data(
				"es_dropdown",
				new frappe.ui.Dropdown({
					trigger: $(this.$parts[`${entry.key}:btn`]),
					options: () => this.build_dropdown_options($store),
				})
			);

			return $store;
		},

		// a parent that is not this page's toolbar: the legacy way
		add_custom_button_group_legacy(label, icon, parent) {
			let custom_btn_group = $(`
				<div class="custom-btn-group">
					<ul class="dropdown-menu" role="presentation"></ul>
				</div>
			`);

			let $button = frappe.ui.button({
				label: __(label),
				icon: icon,
				icon_right: "chevrons-up-down",
				css_class: "ellipsis",
			});
			$button.find(".es-button__label").addClass("custom-btn-group-label");
			if (icon) {
				$button.find(".es-button__label").addClass("hidden-xs");
				$button.children("svg").last().addClass("hidden-xs");
			}
			$button.prependTo(custom_btn_group);
			parent.removeClass("hide").append(custom_btn_group);

			const $store = custom_btn_group.find(".dropdown-menu");
			custom_btn_group.data(
				"es_dropdown",
				new frappe.ui.Dropdown({
					trigger: $button,
					options: () => this.build_dropdown_options($store),
				})
			);

			return $store;
		},

		add_dropdown_button(parent, label, click, icon) {
			frappe.ui.toolbar.add_dropdown_button(parent, label, click, icon);
		},

		// page::form
		add_form_item(kind, label) {
			this.show_form();
			const item = reactive({ key: new_key("fi"), kind, label: label === undefined ? "" : `${label}` });
			this.form_items.push(item);
			this.flush();
			return this.take(item.key, item, () => drop_from(this.form_items, item));
		},
		add_label(label) {
			return $(this.add_form_item("label", label));
		},
		add_select(label, options) {
			var field = this.add_field({ label: label, fieldtype: "Select" });
			return field.$wrapper.find("select").empty().add_options(options);
		},
		add_data(label) {
			var field = this.add_field({ label: label, fieldtype: "Data" });
			return field.$wrapper.find("input").attr("placeholder", label);
		},
		add_date(label, date) {
			var field = this.add_field({ label: label, fieldtype: "Date", default: date });
			return field.$wrapper.find("input").attr("placeholder", label);
		},
		add_check(label) {
			return $(this.add_form_item("check", label)).find("input");
		},
		add_break() {
			// add further fields in the next line
			this.add_form_item("break");
		},
		// The control is a v8 control: `new` mounts its view into the template's page_form part (or
		// the parent given), right there, as a child of the app's tree.
		add_field(df, parent) {
			this.show_form();

			if (!df.placeholder) {
				df.placeholder = df.label;
			}

			df.input_class = "input-xs";

			var f = frappe.ui.form.make_control({
				df: df,
				parent: parent || this.page_form,
				only_input: df.fieldtype == "Check" ? false : true,
			});
			f.refresh();
			// the control's own wrapper: classes and a tooltip the page adds to it, as before
			$(f.wrapper)
				.addClass("col-md-2")
				.attr("title", __(df.label, null, df.parent))
				.tooltip({
					delay: { show: 600, hide: 100 },
					trigger: "hover",
				});
			if (parent == this.filters) {
				this.restyle_field(f);
			}

			// html fields in toolbar are only for display
			if (df.fieldtype == "HTML") {
				return;
			}

			// hidden fields dont have $input
			if (!f.$input) f.make_input();

			f.$input.attr("placeholder", __(df.label, null, df.parent));

			if (df.fieldtype === "Check") {
				$(f.wrapper).find(":first-child").removeClass("col-md-offset-4 col-md-8");
			}

			if (df.fieldtype == "Button") {
				$(f.wrapper).find(".page-control-label").html("&nbsp;");
				f.$input.addClass("btn-xs").css({ width: "100%", "margin-top": "-1px" });
			}

			if (df["default"]) f.set_input(df["default"]);
			this.fields_dict[df.fieldname || df.label] = f;
			return f;
		},
		restyle_field(f) {
			$(f.wrapper).removeClass("col-md-2").css("margin", "0px");

			$(f.wrapper).find("select").css("width", "140px");
			$(f.wrapper).find(".select-icon").css("top", "2px");
		},
		clear_fields() {
			this.release(this.form_items, this.page_form[0], () => {
				this.form_items.splice(0);
				this.flush();
			});
			// legacy .empty(): the controls add_field drew here (jQuery removal destroys them) and
			// whatever callers appended (query report's check filter area)
			this.remove_foreign(this.page_form);
		},
		show_form() {
			this.form_shown = true;
			this.flush();
			this.page_form.removeClass("hide");
		},
		hide_form() {
			this.form_shown = false;
			this.flush();
			this.page_form.addClass("hide");
		},
		get_form_values() {
			var values = {};
			for (let fieldname in this.fields_dict) {
				let field = this.fields_dict[fieldname];
				values[fieldname] = field.get_value();
			}
			return values;
		},
		// "main" is the template's own view; any other is the caller's markup, appended as before
		add_view(name, html) {
			let element = html;
			if (typeof html === "string") {
				element = $(html);
			}
			if (element[0] !== this.$parts.main_view) element.appendTo($(this.$parts.page_content));
			this.views[name] = element;
			if (!this.current_view) {
				this.current_view = this.views[name];
			} else {
				this.views[name].toggle(false);
			}
			return this.views[name];
		},
		// views are toggled on their elements, as before: all but "main" are the caller's markup
		set_view(name) {
			if (this.current_view_name === name) return;
			this.current_view && this.current_view.toggle(false);
			this.current_view = this.views[name];

			this.previous_view_name = this.current_view_name;
			this.current_view_name = name;

			this.views[name].toggle(true);

			this.wrapper.trigger("view-change");
		},
	},
};
</script>

<template>
	<template v-if="draw_page">
		<div v-part:page_head class="page-head flex">
			<div class="container">
				<div class="row flex-nowrap align-center page-head-content justify-between">
					<div class="page-title">
						<button
							class="es-button page-back-button"
							data-variant="ghost"
							data-size="md"
							data-icon-button="true"
							:aria-label="__('Back')"
						>
							<Icon name="chevron-left" size="md" />
						</button>
						<div v-part:title_area class="flex title-area ellipsis">
							<PageRegion>
							<nav
								v-part:breadcrumbs_nav
								class="es-breadcrumbs navbar-breadcrumbs"
								:class="{ 'mobile-no-divider': crumbs_mobile }"
								:aria-label="__('Breadcrumb')"
							>
								<ol :key="crumbs_ol_gen" v-part:crumbs v-tail>
									<li v-for="(c, i) in crumb_items" :key="`${crumbs_gen}:${i}`" v-part:[`crumb:${i}`]>
										<a
											v-if="c.tag === 'a'"
											class="es-breadcrumbs__item"
											:href="c.href"
											:title="c.title"
											:aria-current="c.last ? 'page' : undefined"
											:aria-label="c.aria_label"
										>
											<Icon v-if="c.prefix" :name="c.prefix" current_color />
											<span v-if="c.label" class="es-breadcrumbs__label">{{ c.label }}</span>
											<Icon v-if="c.suffix" :name="c.suffix" current_color />
										</a>
										<button
											v-else-if="c.tag === 'button'"
											class="es-breadcrumbs__item"
											type="button"
											:title="c.title"
											:aria-current="c.last ? 'page' : undefined"
											:aria-label="c.aria_label"
											@click="crumb_click(c, $event)"
										>
											<Icon v-if="c.prefix" :name="c.prefix" current_color />
											<span v-if="c.label" class="es-breadcrumbs__label">{{ c.label }}</span>
											<Icon v-if="c.suffix" :name="c.suffix" current_color />
										</button>
										<span
											v-else
											class="es-breadcrumbs__item"
											:title="c.title"
											:aria-current="c.last ? 'page' : undefined"
											:aria-label="c.aria_label"
										>
											<Icon v-if="c.prefix" :name="c.prefix" current_color />
											<span v-if="c.label" class="es-breadcrumbs__label">{{ c.label }}</span>
											<Icon v-if="c.suffix" :name="c.suffix" current_color />
										</span>
									</li>
								</ol>
							</nav>
							</PageRegion>
							<button class="btn btn-default more-button hide">
								<svg class="icon icon-sm"><use href="#icon-ellipsis"></use></svg>
							</button>
							<PageRegion>
							<span
								v-part:indicator
								v-keep
								class="es-badge page-indicator-pill"
								:class="{ hide: !ind.shown }"
								:data-theme="ind.color"
								data-testid="page-status"
							>
								<span
									v-if="ind.mobile"
									:key="`m${ind.gen}`"
									v-part:indicator_content
									class="indicator-doc-html"
									:style="`background-color: var(--${ind.color}-400)`"
								></span>
								<span v-else-if="ind.label !== null" :key="ind.gen" v-part:indicator_content v-html="ind.label"></span>
							</span>
							</PageRegion>
						</div>
					</div>
					<div class="align-center flex standard-items-section">
						<div
							v-part:page_actions
							class="flex col page-actions justify-content-end"
							:class="{ 'pl-0': mobile_at_make }"
						>
							<!-- buttons -->
							<div v-part:filters class="filters flex"></div>
							<PageToolbar :page="this_page" />
							<PageToolbar :page="this_page" mobile />
							<div v-part:standard_actions class="standard-actions flex">
								<PageRegion>
								<span
									v-part:icon_group
									v-tail
									class="page-icon-group hidden-xs hidden-sm"
									:class="{ hide: !icon_group_shown }"
								>
									<button
										v-for="ic in icon_items"
										:key="ic.key"
										v-part:[ic.key]
										class="text-muted btn btn-default icon-btn"
										:class="ic.css_class"
										:title="ic.title"
									>
										<Icon :name="ic.icon" />
									</button>
								</span>
								</PageRegion>
								<PageRegion>
								<div
									v-part:menu_btn_group
									class="menu-btn-group"
									:class="{ hide: menu_store.hidden, 'hidden-xl': menu_store.hidden_xl }"
								>
									<EsButton part="menu_btn" class="icon-btn menu-more-button" icon="ellipsis" :title="__('Menu')" />
									<!-- hidden item store, not UI: add_dropdown_item draws <li><a> here
									(the returned jQuery is public API); frappe.ui.Dropdown snapshots it
									into menu rows on every open — see build_dropdown_options -->
									<PageMenuStore :store="menu_store" ul_class="dropdown-menu dropdown-menu-right" />
								</div>
								</PageRegion>
								<PageRegion>
								<EsButton
									part="btn_secondary"
									class="secondary-action"
									:class="{ hide: !secondary_btn.shown }"
									:gen="secondary_btn.gen"
									:label="secondary_btn.label"
									:icon="secondary_btn.icon"
									:variant="secondary_btn.variant"
									:loading_label="secondary_btn.loading_label"
									:short_label="secondary_btn.short_label"
									:label_class="secondary_btn.label_class"
									:data-label="secondary_btn.data_label"
									:data-working-label="secondary_btn.working_label"
								/>
								</PageRegion>
								<PageRegion>
								<div
									v-part:actions_btn_group
									class="actions-btn-group"
									:class="{ hide: actions_store.hidden, 'hidden-xl': actions_store.hidden_xl }"
								>
									<EsButton
										part="actions_btn"
										:label="__('Actions')"
										icon_right="chevrons-up-down"
										variant="solid"
										label_class="hidden-xs actions-btn-group-label"
									/>
									<PageMenuStore :store="actions_store" ul_class="dropdown-menu dropdown-menu-right" />
								</div>
								</PageRegion>
								<PageRegion>
								<div v-part:primary_group class="es-segmented-button primary-action-group" role="group">
									<EsButton
										part="btn_primary"
										class="primary-action"
										:class="{ hide: !primary_btn.shown }"
										variant="solid"
										:gen="primary_btn.gen"
										:label="primary_btn.label"
										:icon="primary_btn.icon"
										:loading_label="primary_btn.loading_label"
										:short_label="primary_btn.short_label"
										:label_class="primary_btn.label_class"
										:data-label="primary_btn.data_label"
										:data-working-label="primary_btn.working_label"
									/>
									<EsButton
										part="btn_primary_menu"
										class="primary-action-menu"
										icon="chevron-down"
										variant="solid"
										:title="__('More Options')"
										:hidden="primary_menu_hidden"
									/>
								</div>
								</PageRegion>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-part:container class="container page-body">
			<div class="page-toolbar hide">
				<div class="container"></div>
			</div>
			<div class="page-wrapper">
				<div v-part:page_content class="page-content">
					<div class="workflow-button-area btn-group pull-right hide"></div>
					<div class="clearfix"></div>
					<div v-part:main_view class="layout-main" :class="{ 'layout-two-column': !single_column }">
						<div v-if="!single_column && sidebar_position !== 'Right'" v-part:sidebar class="layout-side-section">
							<button
								v-part:skip_link
								class="sr-only sr-only-focusable btn btn-primary-light my-2"
								tabindex="0"
								role="link"
								@click="skip_to_main($event)"
							>
								{{ __("Navigate to main content") }}
							</button>
						</div>
						<div class="layout-main-section-wrapper">
							<div v-part:main class="layout-main-section">
								<PageRegion>
								<div v-part:page_form v-tail class="page-form row" :class="{ hide: !form_shown }">
									<template v-for="f in form_items" :key="f.key">
										<label v-if="f.kind === 'label'" v-part:[f.key] class="col-md-1 page-only-label" v-html="`${f.label} `"></label>
										<div v-else-if="f.kind === 'check'" v-part:[f.key] class="checkbox">
											<label><input type="checkbox" /><span v-html="f.label"></span></label>
										</div>
										<div v-else v-part:[f.key] class="clearfix invisible-xs"></div>
									</template>
								</div>
								</PageRegion>
							</div>
							<div v-part:footer class="layout-footer hide"></div>
						</div>
						<div v-if="!single_column && sidebar_position === 'Right'" v-part:sidebar class="layout-side-section right">
							<button
								v-part:skip_link
								class="sr-only sr-only-focusable btn btn-primary-light my-2"
								tabindex="0"
								role="link"
								@click="skip_to_main($event)"
							>
								{{ __("Navigate to main content") }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</template>
</template>
