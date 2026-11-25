// Variant B (es-* tags): Desk's ControlLink and ControlSelect stay the legacy jQuery classes. Only
// make_input changes: it creates frappe-ui's Combobox / Select as <es-combobox> / <es-select> with
// jQuery, rendered by the one es-* app (wc/jq runtime + sweep fixes, built in ./es_link/es-link.js,
// `vue` resolved to Desk's one Vue by the one-vue esbuild plugin). frappe-ui's .vue files are unchanged.
//
// Loaded after controls.bundle.js, so it patches the prototypes the subclasses (Dynamic Link, app
// subclasses) already inherit from. Everything apps hold keeps its legacy meaning:
//   Link:   $input/input = the Combobox's own <input> (Vue creates it once); jQuery .val() on it is
//           routed into the component's `query` prop, so a later Vue patch cannot undo it.
//           awesomplete = a shim (list, isOpened, open/close/evaluate, ul, get_item) that drives the
//           Combobox and fires the awesomplete-open/-select/-selectcomplete/-close events in
//           Awesomplete's order, so link.js's own handlers (copied verbatim below) do the picking.
//   Select: $input = the legacy <select> (kept, visually hidden: apps call .find("option"),
//           .empty().add_options(), select[data-fieldname]); <es-select> is the visible UI, mirrored
//           from the <select> and writing picks back through $input.val(v).trigger("change").
import { ES } from "./es_link/es-link.js";

const Link = frappe.ui.form.ControlLink;
const Select = frappe.ui.form.ControlSelect;
const legacy_link_make_input = Link.prototype.make_input;
const legacy_select_make_input = Select.prototype.make_input;

// subclasses that build on Awesomplete's internals (filter, pills) keep the legacy input
const link_uses_es = (ctl) =>
	!(frappe.ui.form.ControlTableMultiSelect && ctl instanceof frappe.ui.form.ControlTableMultiSelect) &&
	!(frappe.ui.form.ControlLinkCombobox && ctl instanceof frappe.ui.form.ControlLinkCombobox) &&
	!ctl.custom_awesomplete_filter &&
	!window.__es_link_off;
const select_uses_es = () => !window.__es_link_off;

// Awesomplete's $.fire: a bubbling, cancelable HTMLEvents event with extra fields
function fire(target, type, props) {
	const evt = document.createEvent("HTMLEvents");
	evt.initEvent(type, true, true);
	for (const k in props || {}) evt[k] = props[k];
	return target.dispatchEvent(evt);
}

// the host renders now even when the control's parent is not in the document yet
function insert_host(host) {
	if (!host.isConnected) ES.mount(host);
	ES.flush();
}

// jQuery and Desk write the input's value directly ($input.val(x)); Vue re-sets `value` from the
// Combobox's `query` on every patch of that input. Route DOM writes into the prop so both agree.
const value_desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
function route_value(input, host) {
	Object.defineProperty(input, "value", {
		configurable: true,
		get() {
			return value_desc.get.call(this);
		},
		set(v) {
			value_desc.set.call(this, v);
			const s = value_desc.get.call(this);
			if (host.query !== s) host.query = s;
		},
	});
}

// ------------------------------------------------------------------ Link
const BUILTIN_ROWS = ["filter_description__link_option", "create_new__link_option", "advanced_search__link_option"];
function to_options(ctl, list) {
	return list.map((item, i) => {
		const value = item.value;
		const text = item.html ? frappe.utils.html2text(item.html).trim() : "";
		const label = ctl.get_translated(item.label || text || value);
		if (item.action || cstr(value).includes("__link_option") || item.html) {
			const key = "c" + i + ":" + value;
			const row = {
				type: "custom",
				key,
				label: item.label ? label : text || label,
				keepOpen: value === "filter_description__link_option",
				onClick: () => pick(ctl, item),
			};
			// rows an app adds through ControlLink.link_options keep their own HTML (filled into the
			// Combobox's per-option slot by the es-slot event, see make_input)
			if (item.html && !BUILTIN_ROWS.includes(value)) {
				row.slot = "html";
				(ctl._es_html ||= {})[key] = item.html;
			}
			return row;
		}
		let description = null;
		if (item.description && (ctl.is_title_link() || value !== item.description))
			description = __(frappe.utils.html2text(frappe.utils.escape_html(item.description)));
		return { label: cstr(label), value, description };
	});
}

function make_shim(ctl, host) {
	const ul = document.createElement("ul"); // Awesomplete's list element: kept for callers that style it
	ul.setAttribute("role", "listbox");
	ul.hidden = true;
	const shim = {
		input: ctl.input,
		ul,
		_list: [],
		_itemCursor: 0,
		minChars: 0,
		get list() {
			return this._list;
		},
		set list(v) {
			this._list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\s*,\s*/) : [];
			this._list = this._list.map((x) => (typeof x === "object" ? x : { label: x, value: x }));
			host.options = to_options(ctl, this._list);
			ES.flush();
			if (document.activeElement === this.input) this.evaluate();
		},
		get isOpened() {
			return !!ctl._es_open;
		},
		get opened() {
			return !!ctl._es_open;
		},
		evaluate() {
			if (this._list.length) this.open();
			else this.close({ reason: "nomatches" });
		},
		open() {
			// Awesomplete.open() fires awesomplete-open on every evaluate() with rows, even when already open
			if (ctl._es_open) fire(ctl.input, "awesomplete-open");
			else set_open(ctl, true);
			first_active(ctl);
		},
		close(o) {
			set_open(ctl, false, o);
		},
		get_item(value) {
			const matches = this._list.filter((item) => item.value === value);
			if (!matches.length) return null;
			return matches[this._itemCursor++ % matches.length];
		},
		select() {
			// Awesomplete.select(li): pick the highlighted row
			if (ctl._es_open) enter(ctl);
		},
		destroy() {},
	};
	return shim;
}

// autoFirst: the first row is active whenever the list opens or its rows change. The Combobox
// highlights the first row only while the user types; an ArrowDown on a list with no active row does it.
function first_active(ctl) {
	setTimeout(() => {
		if (!ctl._es_open) return;
		const content = document.getElementById(ctl.input.getAttribute("aria-controls") || "");
		if (!content || content.querySelector("[data-highlighted]")) return;
		const ev = new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", keyCode: 40, bubbles: false, cancelable: true });
		ev._es_synthetic = true;
		ctl.input.dispatchEvent(ev);
	}, 0);
}

// open/close from our side (list arrived, Escape, blur, close())
function set_open(ctl, v, o) {
	if (!!ctl._es_open === v) return;
	ctl._es_open = v;
	if (v && !ctl._es_portal) {
		ctl._es_portal = true;
		ctl._es_host.portalTo = ctl.input.parentElement;
	}
	ctl._es_host.open = v;
	ES.flush();
	fire(ctl.input, v ? "awesomplete-open" : "awesomplete-close", v ? undefined : o || {});
	if (!v) flush_selectcomplete(ctl);
}

function flush_selectcomplete(ctl) {
	const t = ctl._es_selectcomplete;
	if (!t) return;
	ctl._es_selectcomplete = null;
	fire(ctl.input, "awesomplete-selectcomplete", { text: t.text, originalEvent: t.originalEvent });
}

// Awesomplete.select(): awesomplete-select (cancelable) -> replace -> close -> selectcomplete
function pick(ctl, item) {
	const text = { label: ctl.get_translated(item.label || item.value), value: item.value };
	const originalEvent = ctl._es_key || undefined;
	const allowed = fire(ctl.input, "awesomplete-select", { text, origin: ctl.input, originalEvent });
	if (!allowed) {
		ctl._es_veto_close = true; // the component closes itself after a pick: keep the list open
		queueMicrotask(() => (ctl._es_veto_close = false));
		return false;
	}
	ctl.input.value = text.label; // Awesomplete's replace(), as link.js overrides it
	ctl._es_selectcomplete = { text, originalEvent };
	queueMicrotask(() => {
		if (!ctl._es_selectcomplete) return;
		if (ctl._es_open) set_open(ctl, false, { reason: "select" });
		else flush_selectcomplete(ctl);
	});
	return true;
}

// pick the highlighted row as the Combobox does on Enter
function enter(ctl) {
	const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: false, cancelable: true });
	ev._es_synthetic = true; // keeps the key that asked for it (Tab) as the pick's originalEvent
	ctl.input.dispatchEvent(ev);
}

Link.prototype.make_input = function () {
	if (!link_uses_es(this)) return legacy_link_make_input.call(this);
	const me = this;
	const host = document.createElement("es-combobox");
	host.setAttribute("es-native-events", "");
	host.setAttribute("class", "w-full es-link-input");
	Object.assign(host, {
		options: [],
		modelValue: null, // the value lives in the control; the component only shows and picks
		query: "",
		open: false,
		filterable: false, // the server already searched; keep its order
		openOnFocus: false,
		openOnClick: false,
		placeholder: __(this.df.placeholder || ""),
		emptyText: __("No results found"),
	});
	const $lf = $(`<div class="link-field ui-front es-link-field" style="position: relative;">
			<div class="awesomplete"></div>
			<span class="link-btn">
				<a class="btn-clear" style="display: inline-flex;" title="${__("Clear Link")}">
					${frappe.utils.icon("x", "xs")}
				</a>
				<a class="btn-open" style="display: inline-flex;" title="${__("Open Link")}">
					${frappe.utils.icon("arrow-right", "xs")}
				</a>
			</span>
		</div>`);
	// per-option HTML rows: a <template> slot the runtime stamps per row; jQuery fills it in
	$(host)
		.append('<template slot="item-html"><span class="es-link-html"></span></template>')
		.on("es-slot", (e) => {
			const d = e.originalEvent.detail;
			const html = (this._es_html || {})[d.scope?.item?.key];
			$(d.nodes).filter(".es-link-html").html(html || "");
		});
	$lf.find(".awesomplete").append(host);
	$lf.prependTo(this.input_area);
	insert_host(host);
	this._es_host = host;
	this.$input_area = $(this.input_area);
	this.$input = $(host).find("input").first();
	this.input = this.$input.get(0);
	// the list renders next to the input, as Awesomplete's <ul> did: Desk's specs and apps look for it
	// there ($(input).parent() / .closest(".awesomplete")), and it stays inside dialogs and grid rows
	// host.portalTo is set on the first open (set_open): setting it here re-rendered every Combobox once more
	this.$input.addClass("input-with-feedback");
	route_value(this.input, host);
	this.$link = this.$input_area.find(".link-btn");
	this.$link_clear = this.$input_area.find(".btn-clear");
	this.$link_open = this.$link.find(".btn-open");
	this.set_input_attributes();

	this.$link_clear.on("click", function () {
		me.$link.toggle(false);
		me.$input.val("").focus();
	});
	this.$input.on("focus", function () {
		if (!me.$input.val()) {
			me.$input.val("");
			me.on_input();
		}
		me.show_link_and_clear_buttons();
	});
	this.$input.on("blur", function () {
		setTimeout(function () {
			me.$link.toggle(false);
			me.hide_link_and_clear_buttons();
		}, 250);
	});
	this.$input_area.on("mouseenter", () => this.show_link_and_clear_buttons());
	this.$input_area.on("mouseleave", () => {
		if (!this.$input.is(":focus")) this.hide_link_and_clear_buttons();
	});

	this.$input.attr("data-target", this.df.options);
	this.has_input = true;
	this.translate_values = true;
	this.setup_buttons();
	this.es_setup_combobox(host);
	this.bind_change_event();
};

Link.prototype.es_setup_combobox = function (host) {
	const me = this;
	const input = this.input;
	this.$input.cache = {};
	this.awesomplete = make_shim(this, host);

	// the component's own state changes: accept only what matches the legacy model
	host.addEventListener("update:query", (e) => {
		// typing sets query to the input's text; anything else (resets on close/select) is ours to decide
		if (e.detail !== value_desc.get.call(input)) e.preventDefault();
	});
	host.addEventListener("update:modelValue", (e) => e.preventDefault());
	host.addEventListener("update:open", (e) => {
		const v = !!e.detail;
		if (v === !!me._es_open) return;
		if (v && (!me.awesomplete._list.length || /^Arrow(Up|Down)$/.test(me._es_key?.key || ""))) {
			// Awesomplete opens only with rows, and arrow keys on a closed list belong to the page (grid rows)
			e.preventDefault();
			return;
		}
		if (!v && me._es_veto_close) {
			me._es_veto_close = false;
			e.preventDefault();
			return;
		}
		if (v && !me._es_portal) {
			me._es_portal = true;
			host.portalTo = input.parentElement;
		}
		me._es_open = v;
		fire(input, v ? "awesomplete-open" : "awesomplete-close", v ? undefined : { reason: "blur" });
		if (!v) flush_selectcomplete(me);
	});
	host.addEventListener("update:selectedOption", (e) => {
		const opt = e.detail;
		if (!opt || opt.type === "custom") return;
		const item = me.awesomplete.get_item(opt.value) || { value: opt.value, label: opt.label };
		pick(me, item);
	});

	input.addEventListener(
		"keydown",
		(e) => {
			if (e._es_synthetic) return;
			me._es_key = e;
			setTimeout(() => me._es_key === e && (me._es_key = null));
			if (!me._es_open) return;
			if (e.key === "Escape") {
				// Awesomplete closes on Escape (no preventDefault); dialog.js reads aria-expanded in its
				// capture listener first, so the dialog stays open
				me.awesomplete.close({ reason: "esc" });
			} else if (e.key === "Tab" && !e.shiftKey) {
				// tabSelect: Tab picks the highlighted row (link.js decides whether the text matches)
				const before = me._es_open;
				enter(me);
				if (before && me._es_open) e.preventDefault(); // refused: stay, as Awesomplete does
			}
		},
		true
	);
	// Awesomplete closes on every blur (clicks in the list do not blur: their mousedown is prevented).
	// Added after jQuery's own blur listener, so link.js's blur handler still sees the list open, as with
	// Awesomplete (whose listener came after make_input's first jQuery binding).
	input.addEventListener("blur", () => {
		if (me._es_open) me.awesomplete.close({ reason: "blur" });
	});

	this._debounced_input_handler = frappe.utils.debounce(this.on_input.bind(this), 500);
	this.$input.on("input", this._debounced_input_handler);

	// ---- below: link.js setup_awesomeplete's handlers, unchanged ----
	this.$input.on("blur", function () {
		if (document.activeElement === me.input) {
			if (me.autocomplete_open && me.$input.val()) {
				me.$input.one("focus", () => me.on_input());
			}
			return;
		}
		if (me.selected) {
			me.selected = false;
			return;
		}
		let value = me.get_input_value();
		let label = me.get_label_value();
		if (value !== (me.value || "")) {
			me.parse_validate_and_set_in_model(value, null, label);
		}
	});
	this.$input.on("awesomplete-open", () => {
		this.autocomplete_open = true;
		if (!me.get_label_value()) me.$link.toggle(false);
	});
	this.$input.on("awesomplete-close", () => {
		this.autocomplete_open = false;
		if (!me.get_label_value()) me.$link.toggle(false);
	});
	this.$input.on("awesomplete-select", function (e) {
		var o = e.originalEvent;
		var item = me.awesomplete.get_item(o.text.value);
		me.autocomplete_open = false;
		const TABKEY = 9;
		const ENTERKEY = 13;
		const event = o.originalEvent;
		if (event && [TABKEY, ENTERKEY].includes(event.keyCode)) {
			const input = me.get_label_value().toLowerCase();
			if (!input && event.keyCode === TABKEY) {
				e.preventDefault();
				me.awesomplete.close();
				return false;
			} else if (input && !me.input_matches_item(input, item)) {
				e.preventDefault();
				if (event.preventDefault) event.preventDefault();
				return false;
			}
		}
		if (item.value === "filter_description__link_option") {
			e.preventDefault();
			return false;
		}
		if (item.action) {
			item.value = "";
			item.label = "";
			item.action.apply(me);
		}
		if (me.df.remember_last_selected_value) {
			frappe.boot.user.last_selected_values[me.df.options] = item.value;
		}
		me.parse_validate_and_set_in_model(item.value, null, item.label);
	});
	this.$input.on("awesomplete-selectcomplete", function (e) {
		let o = e.originalEvent;
		if (cstr(o.text.value).indexOf("__link_option") !== -1) {
			me.$input.val("");
		}
	});
};

// ------------------------------------------------------------------ Select
function select_options(select) {
	return [...select.options].map((o) => ({ label: o.textContent, value: o.value, disabled: o.disabled }));
}
function sync_select(ctl) {
	const host = ctl._es_host;
	const sel = ctl.input;
	if (!host || !sel) return;
	const opts = select_options(sel);
	const key = JSON.stringify(opts);
	if (key !== ctl._es_opts_key) {
		ctl._es_opts_key = key;
		host.options = opts;
	}
	const v = sel.selectedIndex < 0 ? null : sel.value;
	if (host.modelValue !== v) host.modelValue = v;
	if (host.disabled !== sel.disabled) host.disabled = sel.disabled;
	if (ctl._es_idle) ctl._es_idle(); // [speed2 G1] the shown option follows the value
	// no ES.flush(): changes render in one batch in the next microtask (a frappe-ui Select render costs
	// several ms because reka renders the closed list's items to collect them; 200 set_input calls in a
	// loop must not pay it 200 times synchronously)
}

// [speed2 G1] Idle options. reka renders a closed Select's items (5 component instances per option) only to
// collect them for typeahead; frappe-ui's trigger shows its own selectedOption, computed from `options`.
// So until the user first reaches the control, the component gets only the selected option: the same
// trigger at a fraction of the mount and update cost. The full list goes in (rendered at once) on
// pointerenter, capture-phase pointerdown and focusin, i.e. before reka can open the list or read its items
// for typeahead, and stays in from then on (collapsing again while reka's list animates out broke its
// patch). host.options still reads the full list. window.__es_select_full turns it off.
const idle_mode = () => !window.__es_select_full;
let select_options_desc = null;
function idle_options(ctl, host) {
	if (!idle_mode()) return;
	const d = (select_options_desc ||= Object.getOwnPropertyDescriptor(customElements.get("es-select").prototype, "options"));
	const st = { full: [], expanded: false, shown: null };
	const push = (list) => {
		st.shown = list;
		d.set.call(host, list);
	};
	const same1 = (a, b) => a.length === b.length && (!a.length || (a[0].value === b[0].value && a[0].label === b[0].label && a[0].disabled === b[0].disabled));
	const apply = () => {
		if (st.expanded) return;
		const v = host.modelValue;
		const one = st.full.filter((o) => o.value === v).slice(0, 1);
		if (!st.shown || !same1(one, st.shown)) push(one);
	};
	Object.defineProperty(host, "options", {
		configurable: true,
		enumerable: true,
		get: () => st.full,
		set(v) {
			st.full = Array.isArray(v) ? v : [];
			if (st.expanded) push(st.full);
			else apply();
		},
	});
	const expand = () => {
		if (st.expanded) return;
		st.expanded = true;
		ctl._es_idle = null;
		push(st.full);
		ES.flush();
	};
	host.addEventListener("pointerenter", expand);
	host.addEventListener("pointerdown", expand, true);
	host.addEventListener("focusin", expand, true);
	host.addEventListener("update:open", (e) => e.detail && expand());
	ctl._es_idle = apply;
}

Select.prototype.make_input = function () {
	legacy_select_make_input.call(this);
	if (!select_uses_es(this) || this._es_host) return;
	this.es_attach_select();
};
Select.prototype.es_attach_select = function () {
	const host = document.createElement("es-select");
	host.setAttribute("class", "w-full es-select-input");
	// options and value before the first render: reka's SelectRoot decides at setup whether its
	// modelValue is controlled (a host mounted with no value kept its own and drifted from ours)
	const opts = select_options(this.input);
	this._es_opts_key = JSON.stringify(opts);
	Object.assign(host, {
		modelValue: this.input.selectedIndex < 0 ? null : this.input.value,
		disabled: this.input.disabled,
		placeholder: __(this.df.placeholder || "") || " ",
	});
	idle_options(this, host);
	host.options = opts;
	this.$input.addClass("es-select-native").attr({ tabindex: "-1", "aria-hidden": "true" });
	this.$wrapper.addClass("es-select-control");
	this.$input.after(host);
	insert_host(host);
	this._es_host = host;
	host.addEventListener("update:modelValue", (e) => {
		const v = e.detail == null ? "" : e.detail;
		if (this.$input.val() === v) return;
		this.$input.val(v).trigger("change");
	});
	// the <select> stays the source of truth: mirror every change made to it
	const mo = new MutationObserver(() => sync_select(this));
	mo.observe(this.input, { childList: true, subtree: true, characterData: true, attributes: true });
	this.$input.on("change select-change", () => sync_select(this));
	// focus goes to the visible trigger; the trigger's focus and blur are relayed to $input, where
	// apps and Desk listen (the hidden <select> itself never keeps focus)
	const sel = this.input;
	this.$input.on("focus", (e) => {
		if (!e.originalEvent || !e.originalEvent._es_relay) host.focus();
	});
	let has_focus = false;
	const relay = (type) => {
		if (has_focus === (type === "focus")) return;
		has_focus = type === "focus";
		const ev = new FocusEvent(type);
		ev._es_relay = true;
		sel.dispatchEvent(ev);
	};
	host.addEventListener("focusin", () => relay("focus"));
	host.addEventListener("focusout", (e) => {
		const to = e.relatedTarget;
		if (to && (host.contains(to) || (to.closest && to.closest("es-portal")))) return;
		relay("blur");
	});
	sync_select(this);
};
const legacy_select_set_formatted_input = Select.prototype.set_formatted_input;
Select.prototype.set_formatted_input = function (value) {
	const r = legacy_select_set_formatted_input.call(this, value);
	if (this._es_host) sync_select(this);
	return r;
};

// ------------------------------------------------------------------ page-wide
// Bootstrap's modal steals focus back from anything outside it; es-* overlays live in <es-portal>
// (wc/jq review: "[es-portal-aware enforceFocus]").
const Modal = $.fn.modal && $.fn.modal.Constructor;
if (Modal && Modal.prototype._enforceFocus) {
	Modal.prototype._enforceFocus = function () {
		$(document)
			.off("focusin.bs.modal")
			.on("focusin.bs.modal", (event) => {
				const el = this._element;
				if (
					document !== event.target &&
					el !== event.target &&
					$(el).has(event.target).length === 0 &&
					!(event.target.closest && event.target.closest("es-portal"))
				) {
					el.focus();
				}
			});
	};
}
// a click in a Combobox list must not take focus from its input (Awesomplete's lists do the same),
// or the input's blur validates the typed text before the pick lands
document.addEventListener(
	"mousedown",
	(e) => {
		const t = e.target;
		if (t && t.closest && t.closest("es-combobox [data-slot=content][data-selection], es-portal [data-slot=content][data-selection]"))
			e.preventDefault();
	},
	true
);

frappe.ui.form.es_link = { ES, version: "B-es-tags" };

// ---------------------------------------------------------------- [speed] lazy mount (prototype)
// A Combobox costs ~2.5 ms to mount, and a form builds every Link up front while only about a third
// are on screen. A Link control now starts with Desk's own plain <input> markup as a stand-in and
// mounts its Combobox: before the first paint if it is on screen, when it comes into view (tab,
// collapsed section, depends_on), when the stand-in gets focus, and at once whenever any code reads
// or writes $input / input / awesomplete / $link* (so app code always gets the real thing).
// window.__es_lazy_off turns it off.
const eager_link_make_input = Link.prototype.make_input;
const link_set_formatted_input = Link.prototype.set_formatted_input;
const LAZY_KEYS = ["$input", "input", "awesomplete", "$link", "$link_clear", "$link_open", "_es_host"];
const lazy = new Set();
const lazy_stats = (frappe.ui.form.es_link_lazy = { forced: {}, visible: 0, io: 0, focus: 0, pending: () => lazy.size });
// [speed2] "on screen" means in (or within MARGIN px of) the viewport, not merely laid out: a long form's
// fields below the fold, and controls built below the viewport, mount as they scroll near it
const MARGIN = 300;
const io = new IntersectionObserver(
	(entries) => {
		for (const en of entries)
			if (en.isIntersecting && en.target._es_ctl) {
				lazy_stats.io++;
				en.target._es_ctl.es_mount();
			}
	},
	{ rootMargin: MARGIN + "px 0px" }
);
const near_viewport = (a) => {
	if (!a) return false;
	if (window.__es_lazy_laidout) return a.getClientRects().length > 0; // the previous rule, for A/B
	const r = a.getBoundingClientRect();
	return (r.width || r.height) && r.bottom > -MARGIN && r.top < window.innerHeight + MARGIN;
};
let check_queued = false;
function queue_check() {
	if (check_queued) return;
	check_queued = true;
	// rAF callbacks run before the frame is painted: on-screen fields are drawn in their first frame
	requestAnimationFrame(() => {
		check_queued = false;
		const shown = [...lazy].filter((c) => near_viewport(c.es_lazy_anchor()));
		for (const c of shown) {
			lazy_stats.visible++;
			c.es_mount();
		}
	});
}

Link.prototype.make_input = function () {
	if (!link_uses_es(this) || window.__es_lazy_off) return eager_link_make_input.call(this);
	const me = this;
	const $ph = $(`<div class="link-field ui-front es-link-pending" style="position: relative;">
			<div class="awesomplete"><input type="text" class="input-with-feedback form-control" autocomplete="off"></div>
		</div>`).prependTo(this.input_area);
	$ph.find("input")
		.attr({ "data-fieldname": this.df.fieldname, placeholder: __(this.df.placeholder || "") })
		.on("focus", () => {
			lazy_stats.focus++;
			me.es_mount();
			me.input.focus();
		});
	this._es_ph = $ph;
	this.has_input = true;
	this.translate_values = true;
	for (const k of LAZY_KEYS)
		Object.defineProperty(this, k, {
			configurable: true,
			enumerable: true,
			get() {
				// Desk's own refresh_input only toggles bold/invalid/disabled on $input: give it the stand-in
				// (copied over at mount); anything else gets the real, mounted input
				if (me._es_quiet && me._es_ph && (k === "$input" || k === "input"))
					return k === "$input" ? me._es_ph.find("input") : me._es_ph.find("input")[0];
				me.es_mount("get " + k);
				return me[k];
			},
			set(v) {
				me.es_mount("set " + k);
				me[k] = v;
			},
		});
	$ph[0]._es_ctl = this;
	io.observe($ph[0]);
	lazy.add(this);
	queue_check();
};

Link.prototype.es_lazy_anchor = function () {
	return this._es_ph && this._es_ph[0];
};

Link.prototype.es_mount = function (why) {
	const $ph = this._es_ph;
	if (!$ph) return;
	this._es_ph = null;
	lazy.delete(this);
	io.unobserve($ph[0]);
	if (why) lazy_stats.forced[why] = (lazy_stats.forced[why] || 0) + 1;
	if (why && window.__es_lazy_trace) {
		const k = why + " <- " + new Error().stack.split("\n").slice(3, 7).map((l) => l.trim().replace(/\(.*\/(\w+)\.bundle\.\w+\.js/, "($1")).join(" < ");
		(lazy_stats.trace ||= {})[k] = (lazy_stats.trace[k] || 0) + 1;
	}
	for (const k of LAZY_KEYS) delete this[k];
	const ph = $ph.find("input");
	$ph.remove();
	eager_link_make_input.call(this);
	this.$input.toggleClass("bold", ph.hasClass("bold")).toggleClass("invalid", ph.hasClass("invalid"));
	if (ph.prop("disabled")) this.$input.prop("disabled", true);
	if ("_es_pending_value" in this) {
		const v = this._es_pending_value;
		delete this._es_pending_value;
		link_set_formatted_input.call(this, v);
	}
};

Link.prototype.set_formatted_input = function (value) {
	if (this._es_ph) {
		// not mounted yet: keep the value for the mount, show it in the stand-in meanwhile
		this._es_pending_value = value;
		this._es_ph.find("input").val(value == null ? "" : value);
		return;
	}
	return link_set_formatted_input.call(this, value);
};

const input_refresh_input = Link.prototype.refresh_input;
Link.prototype.refresh_input = function () {
	if (!this._es_ph && this.has_input) return input_refresh_input.apply(this, arguments);
	const q = this._es_quiet;
	this._es_quiet = true;
	try {
		return input_refresh_input.apply(this, arguments);
	} finally {
		this._es_quiet = q;
	}
};

// ---------------------------------------------------------------- [speed2 G2] lazy Select
// Before it mounts, a Select is exactly Desk's legacy control: $input/input are the native <select> it
// always is, so only `_es_host` needs a trap. It mounts like a Link: before the first paint if on screen,
// when it scrolls or is revealed into view, on focus or pointerdown, or when code reads _es_host.
const select_lazy_on = () => !window.__es_lazy_off && !window.__es_select_lazy_off;
const eager_select_make_input = Select.prototype.make_input;
Select.prototype.make_input = function () {
	if (!select_uses_es(this) || !select_lazy_on() || this._es_sel_pending || Object.prototype.hasOwnProperty.call(this, "_es_host"))
		return eager_select_make_input.call(this);
	legacy_select_make_input.call(this);
	const me = this;
	this._es_sel_pending = true;
	Object.defineProperty(this, "_es_host", {
		configurable: true,
		get() {
			me.es_mount("get _es_host");
			return me._es_host;
		},
		set(v) {
			me.es_mount("set _es_host");
			me._es_host = v;
		},
	});
	this.$input.on("focus.es_lazy", () => {
		lazy_stats.focus++;
		me.es_mount();
	});
	this.$input.on("pointerdown.es_lazy", (e) => {
		// a press on a pending <select> would open the native list: show the real control instead
		lazy_stats.focus++;
		e.preventDefault();
		me.es_mount();
	});
	this.input._es_ctl = this;
	io.observe(this.input);
	lazy.add(this);
	queue_check();
};
Select.prototype.es_lazy_anchor = function () {
	return this._es_sel_pending ? this.input : null;
};
Select.prototype.es_mount = function (why) {
	if (!this._es_sel_pending) return;
	this._es_sel_pending = false;
	lazy.delete(this);
	io.unobserve(this.input);
	this.$input.off(".es_lazy");
	if (why) lazy_stats.forced[why] = (lazy_stats.forced[why] || 0) + 1;
	delete this._es_host;
	this.es_attach_select();
	// focus was already on the <select>: hand it to the trigger, as the mounted control's focus handler does
	if (document.activeElement === this.input) this._es_host.focus();
};
const select_set_formatted_input = Select.prototype.set_formatted_input;
Select.prototype.set_formatted_input = function (value) {
	// pending: the <select> is the truth and is read at mount
	if (this._es_sel_pending) return legacy_select_set_formatted_input.call(this, value);
	return select_set_formatted_input.call(this, value);
};
// dialogs: Bootstrap shows the modal (display:block) in _showElement; check then, so visible fields mount
// before the dialog's first frame instead of one frame later through the IntersectionObserver
if (Modal && Modal.prototype._showElement && !Modal.prototype._es_show_hooked) {
	const show = Modal.prototype._showElement;
	Modal.prototype._es_show_hooked = true;
	Modal.prototype._showElement = function () {
		const r = show.apply(this, arguments);
		if (lazy.size) queue_check();
		return r;
	};
}
