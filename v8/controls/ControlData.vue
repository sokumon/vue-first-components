<!--
frappe.ui.form.ControlData, template-first. A complete port of frappe's data.js; public API unchanged.

It draws with ControlInput's template (`inherit_view: true`; the desk's esbuild Vue plugin needs a
<template> in every file and has no <template extends>, so its parts sit in ControlInput's template
behind its flags):

	make_input()          draw_input = true, input_attrs     the input
	set_input_attributes() input_attrs                       maxlength, data-*, placeholder, css, class
	setup_copy_button()   draw_copy_btn = true               the copy button
	setup_url_field()     draw_link_btn = true               the open-link button
	setup_barcode_field() draw_scan_btn = true               the scan button

The jQuery handlers it binds (change, debounced input, paste, autoname, URL, IBAN) are the legacy ones.
A subclass whose make_input() doesn't call super (Link, Attach, Button) builds its own input, as it
always did, and set_input_attributes() then writes to it the legacy way; one that calls super from a
wrapper it built itself (Check, Switch) gets this input, drawn into its own input area.
-->
<script>
import ControlInput from "./ControlInput.vue";

export default {
	name: "frappe.ui.form.ControlData",
	extends: ControlInput,
	inherit_view: true,
	static: { html_element: "input", input_type: "text", trigger_change_on_input_event: true },
	methods: {
		make_input() {
			if (this.$input) return;

			// the template draws the input (html_element, input_type, input_mode, autocomplete, the
			// classes, and what set_input_attributes() would add); this switches it on and adopts it
			this.input_attrs = this.get_input_attributes();
			this.draw_input = true;
			this.flush();
			this.$input = $(this.$parts.input);

			this.$input.on("paste", (e) => {
				let pasted_data = frappe.utils.get_clipboard_data(e);
				let maxlength = this.$input.attr("maxlength");
				if (maxlength && pasted_data.length > maxlength) {
					let warning_message = __(
						"The value you pasted was {0} characters long. Max allowed characters is {1}.",
						[cstr(pasted_data.length).bold(), cstr(maxlength).bold()]
					);

					// Only show edit link to users who can update the doctype
					if (this.frm && frappe.model.can_write(this.frm.doctype)) {
						let doctype_edit_link = null;
						if (this.frm.meta.custom) {
							doctype_edit_link = frappe.utils.get_form_link(
								"DocType",
								this.frm.doctype,
								true,
								__("this form")
							);
						} else {
							doctype_edit_link = frappe.utils.get_form_link(
								"Customize Form",
								"Customize Form",
								true,
								null,
								{
									doc_type: this.frm.doctype,
								}
							);
						}
						let edit_note = __(
							"{0}: You can increase the limit for the field if required via {1}",
							[__("Note").bold(), doctype_edit_link]
						);
						warning_message += `<br><br><span class="text-muted text-small">${edit_note}</span>`;
					}

					frappe.msgprint({
						message: warning_message,
						indicator: "orange",
						title: __("Data Clipped"),
					});
				}
			});

			this.input = this.$input.get(0);
			this.set_input_attributes();
			this.has_input = true;
			this.bind_change_event();
			this.setup_autoname_check();
			this.setup_copy_button();
			if (this.df.options == "URL") {
				this.setup_url_field();
			}
			if (this.df.options == "Barcode") {
				this.setup_barcode_field();
			}
			if (this.df.options == "IBAN") {
				this.setup_iban_field();
			}
		},

		// The legacy buttons went into `$wrapper.find(".control-input")`: the template's input area.
		// A wrapper without one (only_input, or a subclass's own) got none, and gets none here.
		has_button_area() {
			return this.owns_wrapper() && !this.only_input;
		},
		setup_url_field() {
			if (this.has_button_area()) {
				this.draw_link_btn = true;
				this.flush();
			}
			this.$link = $(this.$parts.link_btn);
			this.$link_open = this.$link.find(".btn-open");

			this.$input.on("focus", () => {
				setTimeout(() => {
					let inputValue = this.get_input_value();

					if (
						inputValue &&
						validate_url(inputValue) &&
						!frappe.utils.has_unsafe_url_scheme(inputValue)
					) {
						this.$link.toggle(true);
						this.$link_open.attr("href", this.get_input_value());
					} else {
						this.$link.toggle(false);
					}
				}, 500);
			});

			this.$input.bind("input", () => {
				let inputValue = this.get_input_value();

				if (
					inputValue &&
					validate_url(inputValue) &&
					!frappe.utils.has_unsafe_url_scheme(inputValue)
				) {
					this.$link.toggle(true);
					this.$link_open.attr("href", this.get_input_value());
				} else {
					this.$link.toggle(false);
				}
			});

			this.$input.on("blur", () => {
				// if this disappears immediately, the user's click
				// does not register, hence timeout
				setTimeout(() => {
					this.$link.toggle(false);
				}, 500);
			});
		},

		setup_iban_field() {
			this.$input.on("blur", () => {
				this.set_formatted_input(this.get_input_value());
			});
		},

		setup_copy_button() {
			if (this.df.with_copy_button && this.has_button_area()) {
				this.draw_copy_btn = true;
				this.flush();
			}
		},
		copy_value() {
			frappe.utils.copy_to_clipboard(this.value);
		},

		setup_barcode_field() {
			if (this.has_button_area()) {
				this.draw_scan_btn = true;
				this.flush();
			}
			this.$scan_btn = $(this.$parts.scan_btn);
			this.$scan_btn.toggle(true);

			const me = this;
			$(document).on("frappe.ui.Dialog:shown", function () {
				me.$scan_btn.toggle(true);
			});
		},
		open_scanner() {
			const me = this;
			new frappe.ui.Scanner({
				dialog: true,
				multiple: false,
				on_scan(data) {
					if (data && data.result && data.result.text) {
						me.set_value(data.result.text);
					}
				},
			});
		},

		bind_change_event() {
			const change_handler = (e) => {
				if (this.change) this.change(e);
				else {
					let value = this.get_input_value();
					this.parse_validate_and_set_in_model(value, e);
				}
			};
			this.$input.on("change", change_handler);
			if (this.constructor.trigger_change_on_input_event && !this.in_grid()) {
				// debounce to avoid repeated validations on value change
				this.$input.on("input", frappe.utils.debounce(change_handler, 500));
			}

			if (this.constructor?.trigger_dirty_on_input_event) {
				this.$input.on("input", () => {
					this.frm?.dirty();
				});
			}
		},
		setup_autoname_check() {
			if (!this.df.parent) return;
			this.meta = frappe.get_meta(this.df.parent);
			if (
				this.meta &&
				((this.meta.autoname &&
					this.meta.autoname.substr(0, 6) === "field:" &&
					this.meta.autoname.substr(6) === this.df.fieldname) ||
					this.df.fieldname === "__newname")
			) {
				this.$input.on("keyup", () => {
					this.set_description("");
					if (this.doc && this.doc.__islocal) {
						// check after 1 sec
						let timeout = setTimeout(() => {
							// clear any pending calls
							if (this.last_check) clearTimeout(this.last_check);

							// check if name exists
							frappe.db.get_value(
								this.doctype,
								this.$input.val(),
								"name",
								(val) => {
									if (val && val.name) {
										this.set_description(
											__("{0} already exists. Select another name", [val.name])
										);
									}
								},
								this.doc.parenttype
							);
							this.last_check = null;
						}, 1000);
						this.last_check = timeout;
					}
				});
			}
		},

		// What legacy set_input_attributes() put on the input, as bindings. Singles skip all of it for
		// these field types ("singles dont have any "real" length requirements"), as before.
		get_input_attributes() {
			const df = this.df;
			const attrs = {};
			if (["Data", "Link", "Dynamic Link", "Password", "Select", "Read Only"].includes(df.fieldtype)) {
				if (this.frm?.meta?.issingle) return attrs;
				attrs.maxlength = df.length || 140;
			}
			attrs["data-fieldtype"] = df.fieldtype;
			attrs["data-fieldname"] = df.fieldname;
			attrs.placeholder = __(df.placeholder || "");
			if (this.doctype) attrs["data-doctype"] = this.doctype;
			const style = { ...(df.input_css || {}) };
			// Apply alignment for supported field types
			if (df.alignment && ["Data", "Int", "Float", "Currency", "Percent"].includes(df.fieldtype)) {
				style["text-align"] = df.alignment.toLowerCase();
			}
			if (Object.keys(style).length) attrs.style = style;
			if (df.input_class) attrs.class = df.input_class;
			return attrs;
		},
		set_input_attributes() {
			const attrs = this.get_input_attributes();
			if (this.owns_input()) {
				// a new object only when something changed, or the input would re-render
				if (!same_attrs(attrs, this.input_attrs)) {
					this.input_attrs = attrs;
					this.sync();
				}
				return;
			}
			// an input a subclass built itself (Link, Button, Attach): the legacy way
			const { style, class: extra, ...rest } = attrs;
			if ("maxlength" in rest) this.$input.attr("maxlength", rest.maxlength);
			if (!("data-fieldtype" in rest)) return; // a single: skipped
			this.$input
				.attr("data-fieldtype", rest["data-fieldtype"])
				.attr("data-fieldname", rest["data-fieldname"])
				.attr("placeholder", rest.placeholder);
			if (this.doctype) {
				this.$input.attr("data-doctype", this.doctype);
			}
			if (style) this.$input.css(style);
			if (extra) this.$input.addClass(extra);
		},
		set_input(value) {
			this.batch(() => {
				this.last_value = this.value;
				this.value = value;
				this.set_formatted_input(value);
				this.set_disp_area(value);
				this.set_mandatory && this.set_mandatory(value);
			});
		},
		// The value belongs to the input, as it always did: the template doesn't bind it, so a re-render
		// never resets what the user typed. Nothing changed: no DOM write.
		set_formatted_input(value) {
			if (!this.$input) return;
			const formatted = this.format_for_input(value);
			if (this.owns_input() && this.input.tagName !== "SELECT" && this.input.value === (formatted == null ? "" : String(formatted))) return;
			this.$input.val(formatted);
		},
		get_input_value() {
			return this.$input ? this.$input.val() : undefined;
		},
		format_for_input(val) {
			if (this.df.options == "IBAN" && val) {
				return frappe.utils.get_formatted_iban(val);
			}
			return val == null ? "" : val;
		},
		parse(value) {
			if (this.df.options == "IBAN" && value) {
				return value.replaceAll(" ", "");
			}
			return value;
		},
		validate(v) {
			if (!v) {
				return "";
			}
			if (this.df.is_filter) {
				return v;
			}
			if (this.df.options == "Phone") {
				this.df.invalid = !validate_phone(v);
				return v;
			} else if (this.df.options == "Name") {
				this.df.invalid = !validate_name(v);
				return v;
			} else if (this.df.options == "Email") {
				var email_list = frappe.utils.split_emails(v);
				if (!email_list) {
					return "";
				} else {
					let email_invalid = false;
					email_list.forEach(function (email) {
						if (!validate_email(email)) {
							email_invalid = true;
						}
					});
					this.df.invalid = email_invalid;
					return v;
				}
			} else if (this.df.options == "URL") {
				this.df.invalid = !validate_url(v) || frappe.utils.has_unsafe_url_scheme(v);
				return v;
			} else {
				return v;
			}
		},
		toggle_container_scroll(el_class, scroll_class, add = false) {
			let el = this.$input.parents(el_class)[0];
			if (el) $(el).toggleClass(scroll_class, add);
		},
		in_grid() {
			return this.grid || (this.layout && this.layout.grid);
		},
	},
};

function same_attrs(a, b) {
	const ka = Object.keys(a);
	if (ka.length !== Object.keys(b).length) return false;
	for (const k of ka) {
		const x = a[k], y = b[k];
		if (x === y) continue;
		if (x && y && typeof x === "object" && typeof y === "object" && JSON.stringify(x) === JSON.stringify(y)) continue;
		return false;
	}
	return true;
}
</script>

<template>
	<!-- inherit_view: ControlInput's template draws this class -->
</template>
