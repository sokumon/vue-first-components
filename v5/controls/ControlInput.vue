<!--
frappe.ui.form.ControlInput, the base of every labelled field, as a v5 class. Ported from
frappe/public/js/frappe/form/controls/base_input.js with its public API unchanged.

The wrapper's markup (label, input area, read-only display, help box) is the template, and so is the
input itself once ControlData's make_input() asks for it. Every method below is the legacy code as
it was: labels, descriptions, read-only display and mandatory styling still go through jQuery.
-->
<script>
import Control from "./Control.vue";
import { InfoCard } from "../../frappe/form/info_card";

export default {
	name: "frappe.ui.form.ControlInput",
	extends: Control,
	static: { horizontal: true },
	data() {
		return {
			vue_input: false,
			show_input: true,
			input_disabled: false,
			input_attrs: {},
			bold: false,
			reqd_label: false,
			mandatory_error: false,
			invalid_error: false,
		};
	},
	computed: {
		wrapper_classes() {
			return {
				"hide-control": this.hidden_control,
				"has-error-mandatory": this.mandatory_error,
				"has-error-invalid": this.invalid_error,
				"has-error": this.mandatory_error || this.invalid_error,
			};
		},
	},
	methods: {
		make() {
			// parent element
			super.make();
			this.set_input_areas();

			// set description
			this.set_max_width();
			// set initial value if set
			if (this.df.initial_value) {
				this.set_value(this.df.initial_value);
			}
		},
		toggle_label(show) {
			this.$wrapper.find(".control-label").parent().toggleClass("hide", !show);
		},
		toggle_description(show) {
			this.$wrapper.find(".help-box").toggleClass("hide", !show);
		},
		set_input_areas() {
			if (this.only_input) {
				this.input_area = this.wrapper;
			} else if (this.vue_drawn) {
				const refs = this.$refs;
				this.label_area = this.label_span = refs.label;
				this.input_area = refs.input_area;
				this.$input_wrapper = $(refs.input_wrapper);
				this.disp_area = refs.disp_area;
			} else {
				this.label_area = this.label_span = this.$wrapper.find("label").get(0);
				this.input_area = this.$wrapper.find(".control-input").get(0);
				this.$input_wrapper = this.$wrapper.find(".control-input-wrapper");
				// keep a separate display area to rendered formatted values
				// like links, currencies, HTMLs etc.
				this.disp_area = this.$wrapper.find(".control-value").get(0);
			}
		},
		set_max_width() {
			if (this.constructor.horizontal) {
				this.$wrapper.addClass("input-max-width");
			}
		},
		read_only_because_of_fetch_from() {
			return (
				this.df.fetch_from &&
				!this.df.fetch_if_empty &&
				this.frm?.doc?.[this.df.fetch_from.split(".")[0]]
			);
		},
		// update input value, label, description
		// display (show/hide/read-only),
		// mandatory style on refresh
		refresh_input() {
			var me = this;
			var make_input = function () {
				if (!me.has_input) {
					me.make_input();
					if (me.df.on_make) {
						me.df.on_make(me);
					}
				}
			};

			var update_input = function () {
				if (me.doctype && me.docname) {
					me.set_input(me.value);
				} else {
					me.set_input(me.value || null);
				}
			};

			if (me.disp_status != "None") {
				// refresh value
				if (me.frm) {
					me.value = frappe.model.get_value(me.doctype, me.docname, me.df.fieldname);
				} else if (me.doc) {
					me.value = me.doc[me.df.fieldname] || "";
				}

				let is_fetch_from_read_only = me.read_only_because_of_fetch_from();

				if (me.can_write() && !is_fetch_from_read_only) {
					me.show_input_area(true);
					me.set_input_disabled(false);
					make_input();
					update_input();
				} else {
					if (me.only_input) {
						make_input();
						update_input();
					} else {
						me.show_input_area(false);
						if (me.disp_area) {
							me.set_disp_area(me.value);
						}
					}
					me.set_input_disabled(true);

					if (is_fetch_from_read_only) {
						$(me.disp_area).attr(
							"title",
							__(
								"This value is fetched from {0}'s {1} field",
								me.df.fetch_from.split(".").map((value) => __(frappe.unscrub(value)))
							)
						);
					}
				}

				me.set_description();
				me.set_label();
				me.set_doc_url();
				me.set_mandatory(me.value);
				me.set_bold();
				me.set_required();
			}
		},
		can_write() {
			return this.disp_status == "Write";
		},
		set_disp_area(value) {
			if (
				["Currency", "Int", "Float"].includes(this.df.fieldtype) &&
				(this.value === 0 || value === 0)
			) {
				// to set the 0 value in readonly for currency, int, float field
				value = 0;
			} else {
				value = this.value || value;
			}
			if (frappe.model.plain_text_fieldtypes.includes(this.df.fieldtype)) {
				value = frappe.utils.escape_html(value);
			}
			let doc = this.doc || (this.frm && this.frm.doc);
			let display_value = frappe.format(value, this.df, { no_icon: true, inline: true }, doc);
			// This is used to display formatted output AND showing values in read only fields
			if (this.disp_area) {
				$(this.disp_area).html(display_value);
				// Apply alignment only for supported fields
				if (
					this.df.alignment &&
					["Data", "Int", "Float", "Currency", "Percent"].includes(this.df.fieldtype)
				) {
					$(this.disp_area).css("text-align", this.df.alignment.toLowerCase());
				}
			}
		},
		set_label(label) {
			const me = this;
			if (label) this.df.label = label;

			if (this.only_input || this.df.label == this._label) return;

			var icon = "";
			this.label_span.innerHTML =
				(icon ? '<i class="' + icon + '"></i> ' : "") +
					__(this.df.label, null, this.df.parent) || "&nbsp;";
			this.show_description_on_click();
			this._label = this.df.label;
		},
		show_description_on_click() {
			const me = this;
			if (this.df.show_description_on_click && !this._doc_url_info_card) {
				new InfoCard({
					label_area: this.label_area,
					label_span: this.label_span,
					df: this.df,
				});
			}
		},
		set_doc_url() {
			if (this.df.show_description_on_click) return;
			let unsupported_fieldtypes = frappe.model.no_value_type.filter(
				(x) => frappe.model.table_fields.indexOf(x) === -1
			);
			if (
				!this.df.label ||
				!this.df?.documentation_url ||
				unsupported_fieldtypes.includes(this.df.fieldtype)
			)
				return;

			if (!this._doc_url_info_card) {
				this._doc_url_info_card = new InfoCard({
					label_area: this.label_area,
					label_span: this.label_span,
					df: this.df,
				});
			}
		},
		set_description(description) {
			if (this.df.show_description_on_click) return;
			if (description !== undefined) {
				this.df.description = description;
			}
			if (this.only_input || this.df.description === this._description) {
				return;
			}
			if (this.df.description) {
				const description = __(this.df.description, null, this.df.parent);
				const help_box = this.$wrapper.find(".help-box");
				help_box.html(description);
				if (description.includes("<code")) {
					frappe.require("syntax_highlighting.bundle.js").then(() => {
						help_box.find("code").each(function () {
							hljs.highlightElement(this);
							this.style.display = "inline"; // override hljs's "block" display
						});
					});
				}
				this.toggle_description(true);
			} else {
				this.set_empty_description();
			}
			this._description = this.df.description;
		},
		set_new_description(description) {
			this.$wrapper.find(".help-box").html(description);
			this.toggle_description(true);
		},
		set_empty_description() {
			this.$wrapper.find(".help-box").html("");
			this.toggle_description(false);
		},
		set_mandatory(value) {
			// do not set has-error class on form load
			if (this.frm && this.frm.cscript && this.frm.cscript.is_onload) return;

			// do not set has-error class while a dialog or web form is rendered
			// set has-error only once the primary action (submit) has been attempted
			if (
				this.layout &&
				(this.layout.is_dialog || this.layout.doctype === "Web Form") &&
				!this.layout.primary_action_fulfilled
			)
				return;

			if (this.vue_drawn) {
				this.mandatory_error = Boolean(this.df.reqd && is_null(value));
				return this.sync();
			}
			const is_invalid = this.$wrapper.hasClass("has-error-invalid");
			this.$wrapper.toggleClass("has-error-mandatory", Boolean(this.df.reqd && is_null(value)));
			this.$wrapper.toggleClass(
				"has-error",
				is_invalid || Boolean(this.df.reqd && is_null(value))
			);
		},
		set_invalid() {
			let invalid = !!this.df.invalid;
			if (this.grid) {
				this.$wrapper.parents(".grid-static-col").toggleClass("invalid", invalid);
				this.$input?.toggleClass("invalid", invalid);
				this.grid_row.columns[this.df.fieldname].is_invalid = invalid;
			} else if (this.vue_drawn) {
				this.invalid_error = invalid;
				this.sync();
			} else {
				const is_mandatory_and_empty = this.$wrapper.hasClass("has-error-mandatory");
				this.$wrapper.toggleClass("has-error-invalid", invalid);
				this.$wrapper.toggleClass("has-error", is_mandatory_and_empty || invalid);
			}
		},
		set_required() {
			if (this.vue_drawn) {
				this.reqd_label = Boolean(this.df.reqd);
				return this.sync();
			}
			this.label_area && $(this.label_area).toggleClass("reqd", Boolean(this.df.reqd));
		},
		set_bold() {
			const bold = !!(this.df.bold || this.df.reqd);
			if (this.vue_drawn) {
				this.bold = bold; // the display area, and the input when the template drew it
				if (this.$input && !this.vue_input) this.$input.toggleClass("bold", bold);
				return this.sync();
			}
			if (this.$input) {
				this.$input.toggleClass("bold", bold);
			}
			if (this.disp_area) {
				$(this.disp_area).toggleClass("bold", bold);
			}
		},
		// input area or read-only display
		show_input_area(show) {
			if (this.vue_drawn) return (this.show_input = show);
			this.disp_area && $(this.disp_area).toggleClass("hide", show);
			$(this.input_area).toggleClass("hide", !show);
		},
		set_input_disabled(disabled) {
			if (this.vue_input) this.input_disabled = disabled;
			else this.$input && this.$input.prop("disabled", disabled);
		},
	},
};
</script>

<template>
	<div
		v-if="vue_wrapper && only_input"
		class="form-group frappe-control"
		:class="wrapper_classes"
		:data-fieldtype="df.fieldtype"
		:data-fieldname="df.fieldname"
	>
		<component
			:is="constructor.html_element"
			v-if="vue_input"
			ref="input"
			v-memo="[bold, input_disabled, input_attrs]"
			v-bind="input_attrs"
			class="input-with-feedback form-control"
			:class="{ bold }"
			:type="constructor.input_type"
			:inputmode="constructor.input_mode"
			autocomplete="off"
			:disabled="input_disabled"
		/>
		<span v-once ref="tooltip" class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
	</div>
	<div
		v-else-if="vue_wrapper"
		class="frappe-control"
		:class="wrapper_classes"
		:data-fieldtype="df.fieldtype"
		:data-fieldname="df.fieldname"
	>
		<div class="form-group" :class="{ horizontal: constructor.horizontal }">
			<div class="clearfix">
				<label v-memo="[reqd_label]" ref="label" class="control-label" :class="{ reqd: reqd_label }" style="padding-right: 5px"></label>
				<span class="help"></span>
			</div>
			<div ref="input_wrapper" class="control-input-wrapper">
				<div ref="input_area" class="control-input" :class="{ hide: !show_input }">
					<component
						:is="constructor.html_element"
						v-if="vue_input"
						ref="input"
						v-memo="[bold, input_disabled, input_attrs]"
						v-bind="input_attrs"
						class="input-with-feedback form-control"
						:class="{ bold }"
						:type="constructor.input_type"
						:inputmode="constructor.input_mode"
						autocomplete="off"
						:disabled="input_disabled"
					/>
				</div>
				<div v-memo="[show_input, bold]" ref="disp_area" class="control-value like-disabled-input" :class="{ hide: show_input, bold }"></div>
				<div class="help-box small text-extra-muted hide"></div>
			</div>
		</div>
		<span v-once ref="tooltip" class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
	</div>
</template>
