<!--
frappe.ui.form.ControlSelect, variant A ("Vue components", the v8 pattern). A port of frappe's
select.js; the public API is unchanged.

The native <select> is still drawn by ControlInput's template (html_element "select") and is still
control.$input: set_options(), set_formatted_input(), add_options() and every app that writes it with
jQuery work on it as before. It is kept out of sight (tw-native-select), and the control draws
frappe.ui.form.SelectInput (SelectInput.vue) beside it: frappe-ui's Select, used unchanged, which
draws the native select's options and value and writes picks back to it.

Method bodies are select.js's own, except the three that drew markup with jQuery (marked "variant A"):
set_icon (frappe-ui's Select has its own chevron), set_placeholder and toggle_placeholder (the
Select's placeholder prop). The globals select.js defined (frappe.ui.form.add_options,
$.fn.add_options/set_working/done_working, the $.fn.val patch that fires select-change) are in
select_globals.js.
-->
<script>
import ControlData from "../vue_first8/controls/ControlData.vue";

export default {
	name: "frappe.ui.form.ControlSelect",
	extends: ControlData,
	inherit_view: true,
	static: { html_element: "select", trigger_change_on_input_event: false },
	methods: {
		make_input() {
			super.make_input();
			// variant A: the native select stays $input, out of sight; the view draws frappe-ui's Select
			this.$input.addClass("tw-native-select").attr({ "aria-hidden": "true", tabindex: "-1" });
			this.select_view = new frappe.ui.form.SelectInput({ parent: this.input_area, control: this });

			const is_xs_input = this.df.input_class && this.df.input_class.includes("input-xs");
			this.set_icon(is_xs_input);
			this.df.placeholder && this.set_placeholder(is_xs_input);

			this.$input.addClass("ellipsis");
			this.set_options();
		},
		// variant A: frappe-ui's Select draws its own chevron (legacy appended `.select-icon`)
		set_icon(is_xs_input) {},
		// variant A: the Select's placeholder (legacy appended a `.placeholder` div and toggled it)
		set_placeholder(is_xs_input) {
			if (!this.select_view) return;
			this.select_view.placeholder = __(this.df.placeholder);
			this.select_view.flush();
		},
		set_formatted_input(value) {
			// refresh options first - (new ones??)
			if (value == null) value = "";
			this.set_options(value);

			// set in the input element
			super.set_formatted_input(value);

			// check if the value to be set is selected
			var input_value = "";
			if (this.$input) {
				input_value = this.$input.val();
			}

			if (value && input_value && value !== input_value) {
				// trying to set a non-existant value
				// model value must be same as whatever the input is
				this.set_model_value(input_value);
			}
		},
		set_options(value) {
			// reset options, if something new is set
			var options = this.df.options || [];

			if (typeof this.df.options === "string") {
				options = this.df.options.split("\n");
			}

			// nothing changed
			if (JSON.stringify(options) === this.last_options) {
				return;
			}
			this.last_options = JSON.stringify(options);

			if (this.$input) {
				var selected = this.$input.find(":selected").val();
				this.$input.empty();
				frappe.ui.form.add_options(
					this.$input,
					options || [],
					this.df.sort_options,
					this.df.context || this.df.parent || this.doctype
				);

				if (value === undefined && selected) {
					this.$input.val(selected);
				}
			}
		},
		get_file_attachment_list() {
			if (!this.frm) return;
			var fl = frappe.model.docinfo[this.frm.doctype][this.frm.docname];
			if (fl && fl.attachments) {
				this.set_description("");
				var options = [""];
				$.each(fl.attachments, function (i, f) {
					options.push(f.file_url);
				});
				return options;
			} else {
				this.set_description(__("Please attach a file first."));
				return [""];
			}
		},
		// variant A: the Select shows its placeholder while nothing is picked
		toggle_placeholder() {
			this.select_view?.read();
		},
		// variant A: what refresh() changed on the native select (disabled) reaches the view
		refresh_input() {
			super.refresh_input();
			this.select_view?.read();
		},
	},
};
</script>

<template><div></div></template>
