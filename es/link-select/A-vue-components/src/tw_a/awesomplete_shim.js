// control.awesomplete for a Link drawn with frappe-ui's Combobox (variant A).
//
// Awesomplete is part of the Link contract (wc/three-ways/contract/CONTRACT.md §6): app code sets
// `awesomplete.list`, reads `isOpened`, calls `close()` / `evaluate()` / `get_item()`, styles `ul`, and
// Desk core plus apps listen for the awesomplete-open / -select / -selectcomplete / -close events on
// $input. link.js's own handlers (Enter refused on a row the text doesn't match, action rows,
// remember_last_selected_value, parse_validate_and_set_in_model) run on those events.
//
// So this is Awesomplete's state machine and event protocol (node_modules/awesomplete/awesomplete.js:
// list, evaluate, open, close, select, replace, the option hooks data/filter/sort/replace/maxItems/
// autoFirst/tabSelect), with the drawing left to the Combobox: `evaluate()` hands the suggestions to
// the view as frappe-ui options, `open()`/`close()` set the view's `open` prop, and the view calls
// `select(index, origin, event)` when the Combobox picks a row. Nothing of the frappe-ui component is
// changed or reached into; the view only binds its props and listens to its emits.

function fire(target, type, properties) {
	const evt = document.createEvent("HTMLEvents");
	evt.initEvent(type, true, true);
	for (const key in properties || {}) evt[key] = properties[key];
	return target.dispatchEvent(evt);
}

function Suggestion(data) {
	const o = Array.isArray(data)
		? { label: data[0], value: data[1] }
		: typeof data === "object" && "label" in data && "value" in data
		? data
		: { label: data, value: data };
	this.label = o.label || o.value;
	this.value = o.value;
}
Object.defineProperty((Suggestion.prototype = Object.create(String.prototype)), "length", {
	get() {
		return this.label.length;
	},
});
Suggestion.prototype.toString = Suggestion.prototype.valueOf = function () {
	return "" + this.label;
};

export default class FuiAwesomplete {
	constructor(view, o = {}) {
		this.view = view; // frappe.ui.form.LinkInput (LinkInput.vue)
		this.input = view.input;
		this.options = o;
		this.minChars = o.minChars ?? 2;
		this.maxItems = o.maxItems ?? 10;
		this.autoFirst = !!o.autoFirst;
		this.tabSelect = !!o.tabSelect;
		this.data = o.data || ((item) => item);
		this.filter = o.filter || ((text, input) => RegExp(escape_re(input.trim()), "i").test(text));
		this.sort = o.sort === false ? false : o.sort || ((a, b) => (a.length !== b.length ? a.length - b.length : a < b ? -1 : 1));
		this.replace = o.replace || function (text) {
			this.input.value = text.value;
		};
		this.item = o.item; // legacy row builder: not used, the Combobox draws the rows
		this.isOpened = false;
		this.index = -1;
		this.suggestions = [];
		this._list = [];
		this._itemCursor = 0;
		if (o.list) this.list = o.list;
	}

	set list(list) {
		if (Array.isArray(list)) this._list = list;
		else if (typeof list === "string" && list.indexOf(",") > -1) this._list = list.split(/\s*,\s*/);
		if (document.activeElement === this.input) this.evaluate();
	}
	get list() {
		return this._list;
	}
	get selected() {
		return this.index > -1;
	}
	get opened() {
		return this.isOpened;
	}
	// the open list: frappe-ui's listbox while it is drawn, else the stand-in <ul hidden> inside .awesomplete
	get ul() {
		return this.view.list_element();
	}
	get container() {
		return this.view.$parts.awesomplete;
	}

	evaluate() {
		const value = this.input.value;
		if (value.length >= this.minChars && this._list && this._list.length > 0) {
			this.index = -1;
			let suggestions = this._list
				.map((item) => Object.assign(new Suggestion(this.data(item, value)), { item }))
				.filter((item) => this.filter(item, value));
			if (this.sort !== false) suggestions = suggestions.sort(this.sort);
			this.suggestions = suggestions.slice(0, this.maxItems);
			this.view.set_rows(this.suggestions);
			if (!this.suggestions.length) this.close({ reason: "nomatches" });
			else this.open();
		} else {
			this.suggestions = [];
			this.view.set_rows([]);
			this.close({ reason: "nomatches" });
		}
	}

	open() {
		this.isOpened = true;
		this.view.set_open(true);
		if (this.autoFirst && this.index === -1) this.goto(0);
		fire(this.input, "awesomplete-open");
	}

	close(o) {
		if (!this.opened) return;
		this.isOpened = false;
		this.index = -1;
		this.view.set_open(false);
		fire(this.input, "awesomplete-close", o || {});
	}

	goto(i) {
		this.index = i;
		this.view.highlight(i);
	}
	next() {
		const count = this.suggestions.length;
		this.goto(this.index < count - 1 ? this.index + 1 : count ? 0 : -1);
	}
	previous() {
		const count = this.suggestions.length;
		const pos = this.index - 1;
		this.goto(this.selected && pos !== -1 ? pos : count - 1);
	}

	// `selected`: a row index (the view passes the row the Combobox picked), or nothing for the active row
	select(selected, origin, originalEvent) {
		if (typeof selected === "number") this.index = selected;
		else if (selected == null) this.index = this.view.highlighted_index();
		const suggestion = this.suggestions[this.index];
		if (!suggestion) return false;
		const allowed = fire(this.input, "awesomplete-select", {
			text: suggestion,
			origin: origin || this.view.row_element(this.index),
			originalEvent,
		});
		if (allowed) {
			this.replace(suggestion);
			this.view.sync_query();
			this.close({ reason: "select" });
			fire(this.input, "awesomplete-selectcomplete", { text: suggestion, originalEvent });
		}
		return allowed;
	}

	// link.js patches these onto Awesomplete.prototype; the same here
	get_item(value) {
		const matches = this._list.filter((item) => item.value === value);
		if (matches.length === 0) return null;
		const item = matches[this._itemCursor % matches.length];
		this._itemCursor++;
		return item;
	}

	destroy() {}
}

function escape_re(s) {
	return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
}
