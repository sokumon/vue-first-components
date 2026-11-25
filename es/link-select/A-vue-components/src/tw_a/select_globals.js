// select.js's globals, verbatim (variant A no longer loads select.js: ControlSelect.vue replaces its class).
frappe.ui.form.add_options = function (input, options_list, sort, doctype) {
	let $select = $(input);
	if (!Array.isArray(options_list)) {
		return $select;
	}

	let options = options_list.map((raw_option) => parse_option(raw_option, doctype));
	if (sort) {
		options = options.sort((a, b) => cstr(a.label).localeCompare(cstr(b.label)));
	}

	options
		.map((option) =>
			$("<option>")
				.html(cstr(option.label))
				.attr("value", option.value)
				.prop("disabled", option.is_disabled)
				.prop("selected", option.is_selected)
		)
		.forEach(($option) => $option.appendTo($select.get(0)));

	// select the first option
	$select.get(0).selectedIndex = 0;
	$select.trigger("select-change");
	return $select;
};

// add <option> list to <select>
(function ($) {
	$.fn.add_options = function (options_list, sort) {
		return frappe.ui.form.add_options(this.get(0), options_list, sort);
	};
	$.fn.set_working = function () {
		this.prop("disabled", true);
	};
	$.fn.done_working = function () {
		this.prop("disabled", false);
	};

	let original_val = $.fn.val;
	$.fn.val = function () {
		let result = original_val.apply(this, arguments);
		if (arguments.length > 0) $(this).trigger("select-change");
		return result;
	};
})(jQuery);

function parse_option(v, doctype) {
	let value = null;
	let label = null;
	let is_disabled = false;
	let is_selected = false;

	if (!is_null(v)) {
		const is_value_null = is_null(v.value);
		const is_label_null = is_null(v.label);
		is_disabled = Boolean(v.disabled);
		is_selected = Boolean(v.selected);

		if (is_value_null && is_label_null && typeof v !== "object") {
			value = v;
			label = __(v, null, doctype);
		} else {
			value = is_value_null ? "" : v.value;
			label = is_label_null ? __(value, null, doctype) : __(v.label, null, doctype);
		}
	}

	return {
		value,
		label,
		is_disabled,
		is_selected,
	};
}
