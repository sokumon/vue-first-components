// link.js's globals, verbatim (variant A: control.js imports this instead of ./link; the class is
// ControlLink.vue, loaded before this bundle). The Awesomplete patch must stay in this bundle: it is the
// Awesomplete module instance autocomplete.js, multiselect.js and multiselect_pills.js import here.
import Awesomplete from "../../ui/awesomplete";

frappe.ui.form.recent_link_validations = frappe.ui.form.recent_link_validations || {};

if (Awesomplete) {
	Awesomplete.prototype._itemCursor = 0;
	Awesomplete.prototype.get_item = function (value) {
		var matches = this._list.filter(function (item) {
			return item.value === value;
		});

		if (matches.length === 0) return null;

		var item = matches[this._itemCursor % matches.length];
		this._itemCursor++;

		return item;
	};
}
