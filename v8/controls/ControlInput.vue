<!--
frappe.ui.form.ControlInput, template-first. A complete port of frappe's base_input.js; public API unchanged.

All of its markup is the template below: wrapper (both shapes: labelled, and only_input), label row
with the translation button, input area with the input and ControlData's buttons (open-link, copy,
barcode scan), read-only display, description, tooltip, and every class refresh() decides. The
legacy methods keep their names, bodies and call order; where they built or poked markup they now
set state the template reads:

	make_wrapper()       draw_wrapper = true          (Control)
	make_input()         draw_input = true            (ControlData)
	set_label(l)         label_html                   toggle_label(s)        label_shown
	set_description(d)   description_html             toggle_description(s)  description_shown
	set_new_description, set_empty_description: description_html
	set_disp_area(v)     disp_html, disp_style        refresh_input()        show_input, disp_title
	set_mandatory(v)     mandatory_error              set_invalid()          invalid_error, input_invalid
	set_required()       reqd_label                   set_bold()             bold
	$input disabled      input_disabled               set_max_width()        max_width

ControlData's parts live here too, behind its flags (draw_link_btn, draw_copy_btn, draw_scan_btn):
the desk's esbuild Vue plugin has no <template extends>, so ControlData.vue has an empty template
and `inherit_view: true`.

A subclass that built its own wrapper (Check, Switch, Comment) or its own label/display/input
elements didn't let the template draw that part: the methods then write to the subclass's elements
the legacy way. That `else` branch is the only jQuery left, and only unported subclasses reach it.
InfoCard (documentation_url, show_description_on_click) is frappe's own class from info_card.js,
called as before on the template's label.
-->
<script>
import Control from "./Control.vue";
import { InfoCard } from "../../frappe/form/info_card";

export default {
	name: "frappe.ui.form.ControlInput",
	extends: Control,
	static: { horizontal: true, html_element: "input" },
	data() {
		return {
			draw_input: false,
			show_input: true,
			input_disabled: false,
			input_attrs: {},
			input_invalid: false,
			bold: false,
			reqd_label: false,
			mandatory_error: false,
			invalid_error: false,
			max_width: false,
			label_html: "",
			label_shown: true,
			description_html: "",
			description_shown: false,
			disp_html: "",
			disp_style: "",
			disp_title: undefined,
			draw_link_btn: false,
			draw_copy_btn: false,
			draw_scan_btn: false,
		};
	},
	computed: {
		wrapper_classes() {
			return {
				"form-group": !!this.only_input,
				"input-max-width": this.max_width,
				"hide-control": this.hidden_control,
				"has-error-mandatory": this.mandatory_error,
				"has-error-invalid": this.invalid_error,
				"has-error": this.mandatory_error || this.invalid_error,
			};
		},
		// the input's tag. The template draws input, select and textarea as themselves: a string
		// `<component :is>` would look the name up in the app's component registry first, so an
		// app-registered "Select" or "Textarea" would replace the native element.
		input_tag() {
			return this.constructor.html_element;
		},
		// what legacy make_input() and set_input_attributes() put on the input
		input_bindings() {
			const { class: extra, ...attrs } = this.input_attrs;
			return {
				...attrs,
				class: ["input-with-feedback form-control", { bold: this.bold, invalid: this.input_invalid }, extra],
				// an attribute, as legacy `.attr("type", ...)` (a select's `type` property is read-only)
				"^type": this.constructor.input_type,
				inputmode: this.constructor.input_mode,
				autocomplete: "off",
				disabled: this.input_disabled,
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
			if (!this.owns_wrapper()) {
				this.$wrapper.find(".control-label").parent().toggleClass("hide", !show);
				return;
			}
			this.label_shown = !!show;
			this.sync();
		},
		toggle_description(show) {
			if (!this.owns_wrapper()) {
				this.$wrapper.find(".help-box").toggleClass("hide", !show);
				return;
			}
			this.description_shown = !!show;
			this.sync();
		},
		set_input_areas() {
			const parts = this.$parts;
			if (this.only_input) {
				this.input_area = this.wrapper;
			} else if (this.owns_wrapper()) {
				this.label_area = this.label_span = parts.label;
				this.input_area = parts.input_area;
				this.$input_wrapper = $(parts.input_wrapper);
				// keep a separate display area to rendered formatted values
				// like links, currencies, HTMLs etc.
				this.disp_area = parts.disp_area;
			} else {
				this.label_area = this.label_span = this.$wrapper.find("label").get(0);
				this.input_area = this.$wrapper.find(".control-input").get(0);
				this.$input_wrapper = this.$wrapper.find(".control-input-wrapper");
				this.disp_area = this.$wrapper.find(".control-value").get(0);
			}
		},
		set_max_width() {
			if (!this.constructor.horizontal) return;
			if (this.owns_wrapper()) {
				this.max_width = true;
				this.sync();
			} else this.$wrapper.addClass("input-max-width");
		},

		read_only_because_of_fetch_from() {
			return (
				this.df.fetch_from &&
				!this.df.fetch_if_empty &&
				this.frm?.doc?.[this.df.fetch_from.split(".")[0]]
			);
		},

		// which of the legacy fields are still the template's parts (a subclass may have pointed one
		// at its own element)
		owns_disp_area() {
			return !!this.disp_area && this.disp_area === this.$parts.disp_area;
		},
		owns_input_area() {
			return !!this.input_area && this.input_area === this.$parts.input_area;
		},
		owns_label() {
			return !!this.label_span && this.label_span === this.$parts.label;
		},
		owns_input() {
			return this.draw_input && !!this.input && this.input === this.$parts.input;
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
						const title = __(
							"This value is fetched from {0}'s {1} field",
							me.df.fetch_from.split(".").map((value) => __(frappe.unscrub(value)))
						);
						if (me.owns_disp_area()) me.disp_title = title;
						else $(me.disp_area).attr("title", title);
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
		// legacy refresh_input() set these on every refresh, whatever the DOM had (import_preview sets
		// `$input.prop("disabled", true)` from outside): put back what the template drew
		reapply_state() {
			super.reapply_state();
			if (this.disp_status == "None") return;
			if (!this.only_input && this.owns_input_area() && this.owns_disp_area()) {
				this.input_area.classList.toggle("hide", !this.show_input);
				this.disp_area.classList.toggle("hide", !!this.show_input);
			}
			if (this.owns_input() && this.input.disabled !== !!this.input_disabled) this.input.disabled = !!this.input_disabled;
		},
		// legacy refresh_input(): `disp_area.addClass/removeClass("hide")`, `input_area.toggleClass("hide")`
		show_input_area(show) {
			if (this.only_input) return;
			if (this.owns_input_area() && this.owns_disp_area()) {
				this.show_input = !!show;
				return this.sync();
			}
			this.disp_area && $(this.disp_area).toggleClass("hide", !!show);
			$(this.input_area).toggleClass("hide", !show);
		},
		// legacy refresh_input(): `$input.prop("disabled", ...)`
		set_input_disabled(disabled) {
			if (this.owns_input()) {
				this.input_disabled = !!disabled;
				return this.sync();
			}
			this.$input && this.$input.prop("disabled", disabled);
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
			// Apply alignment only for supported fields
			const align =
				this.df.alignment &&
				["Data", "Int", "Float", "Currency", "Percent"].includes(this.df.fieldtype)
					? this.df.alignment.toLowerCase()
					: null;
			// This is used to display formatted output AND showing values in read only fields
			if (this.owns_disp_area()) {
				this.disp_html = display_value;
				if (align) this.disp_style = `text-align: ${align}`;
				return this.sync();
			}
			if (this.disp_area) {
				$(this.disp_area).html(display_value);
				if (align) $(this.disp_area).css("text-align", align);
			}
		},
		set_label(label) {
			if (label) this.df.label = label;

			if (this.only_input || this.df.label == this._label) return;

			var icon = "";
			const html =
				(icon ? '<i class="' + icon + '"></i> ' : "") + __(this.df.label, null, this.df.parent) ||
				"&nbsp;";
			if (this.owns_label()) {
				this.label_html = html;
				// InfoCard appends to the label: it must find the new label drawn
				if (this.df.show_description_on_click && !this._doc_url_info_card) this.flush();
				else this.sync();
			} else this.label_span.innerHTML = html;
			this.show_description_on_click();
			this._label = this.df.label;
		},
		show_description_on_click() {
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
				// InfoCard appends to the label: the label set in this refresh must be drawn first
				if (this.owns_label()) this.flush();
				this._doc_url_info_card = new InfoCard({
					label_area: this.label_area,
					label_span: this.label_span,
					df: this.df,
				});
			}
		},

		// the description box: the template's, or the one a subclass built
		help_box() {
			return this.owns_wrapper() ? $(this.$parts.help_box) : this.$wrapper.find(".help-box");
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
				if (this.owns_wrapper()) this.description_html = description;
				else this.help_box().html(description);
				if (description.includes("<code")) {
					frappe.require("syntax_highlighting.bundle.js").then(() => {
						this.flush(); // drawn by now (a batch ends synchronously); a no-op then
						this.help_box()
							.find("code")
							.each(function () {
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
			if (this.owns_wrapper()) this.description_html = description;
			else this.$wrapper.find(".help-box").html(description);
			this.toggle_description(true);
		},
		set_empty_description() {
			if (this.owns_wrapper()) this.description_html = "";
			else this.$wrapper.find(".help-box").html("");
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

			const missing = Boolean(this.df.reqd && is_null(value));
			if (this.owns_wrapper()) {
				this.mandatory_error = missing;
				return this.sync();
			}
			const is_invalid = this.$wrapper.hasClass("has-error-invalid");
			this.$wrapper.toggleClass("has-error-mandatory", missing);
			this.$wrapper.toggleClass("has-error", is_invalid || missing);
		},
		set_invalid() {
			let invalid = !!this.df.invalid;
			if (this.grid) {
				// the grid's own cell, outside this control
				this.$wrapper.parents(".grid-static-col").toggleClass("invalid", invalid);
				if (this.owns_input()) {
					this.input_invalid = invalid;
					this.sync();
				} else this.$input?.toggleClass("invalid", invalid);
				this.grid_row.columns[this.df.fieldname].is_invalid = invalid;
			} else if (this.owns_wrapper()) {
				this.invalid_error = invalid;
				this.sync();
			} else {
				const is_mandatory_and_empty = this.$wrapper.hasClass("has-error-mandatory");
				this.$wrapper.toggleClass("has-error-invalid", invalid);
				this.$wrapper.toggleClass("has-error", is_mandatory_and_empty || invalid);
			}
		},
		set_required() {
			if (this.owns_label() && this.label_area === this.label_span) {
				this.reqd_label = Boolean(this.df.reqd);
				return this.sync();
			}
			this.label_area && $(this.label_area).toggleClass("reqd", Boolean(this.df.reqd));
		},
		set_bold() {
			const bold = !!(this.df.bold || this.df.reqd);
			const mine = this.owns_input() || this.owns_disp_area();
			if (mine) this.bold = bold; // the template's input and display area
			if (this.$input && !this.owns_input()) {
				this.$input.toggleClass("bold", bold);
			}
			if (this.disp_area && !this.owns_disp_area()) {
				$(this.disp_area).toggleClass("bold", bold);
			}
			if (mine) this.sync();
		},
	},
};
</script>

<template>
	<div
		v-if="draw_wrapper"
		v-part:wrapper
		class="frappe-control"
		:class="wrapper_classes"
		:data-fieldtype="df.fieldtype"
		:data-fieldname="df.fieldname"
	>
		<template v-if="only_input">
			<template v-if="draw_input">
				<input
					v-if="input_tag === 'input'"
					v-memo="[bold, input_disabled, input_attrs, input_invalid]"
					v-part:input
					v-bind="input_bindings"
				/>
				<select
					v-else-if="input_tag === 'select'"
					v-memo="[bold, input_disabled, input_attrs, input_invalid]"
					v-part:input
					v-bind="input_bindings"
				/>
				<textarea
					v-else-if="input_tag === 'textarea'"
					v-memo="[bold, input_disabled, input_attrs, input_invalid]"
					v-part:input
					v-bind="input_bindings"
				/>
				<component
					:is="input_tag"
					v-else
					v-memo="[bold, input_disabled, input_attrs, input_invalid]"
					v-part:input
					v-bind="input_bindings"
				/>
			</template>
		</template>
		<div v-else class="form-group" :class="{ horizontal: constructor.horizontal }">
			<div class="clearfix" :class="{ hide: !label_shown }">
				<label
					v-memo="[reqd_label, label_html]"
					v-part:label
					class="control-label"
					:class="{ reqd: reqd_label }"
					style="padding-right: 5px"
					v-html="label_html"
				></label>
				<span class="help"></span>
				<a
					v-if="translatable_btn"
					class="btn-translation no-decoration text-muted"
					:title="__('Open Translation')"
					@click="open_translation()"
					v-html="frappe.utils.icon('globe', 'sm')"
				></a>
			</div>
			<div v-part:input_wrapper class="control-input-wrapper">
				<div v-part:input_area class="control-input" :class="{ hide: !show_input }">
					<template v-if="draw_input">
						<input
							v-if="input_tag === 'input'"
							v-memo="[bold, input_disabled, input_attrs, input_invalid]"
							v-part:input
							v-bind="input_bindings"
						/>
						<select
							v-else-if="input_tag === 'select'"
							v-memo="[bold, input_disabled, input_attrs, input_invalid]"
							v-part:input
							v-bind="input_bindings"
						/>
						<textarea
							v-else-if="input_tag === 'textarea'"
							v-memo="[bold, input_disabled, input_attrs, input_invalid]"
							v-part:input
							v-bind="input_bindings"
						/>
						<component
							:is="input_tag"
							v-else
							v-memo="[bold, input_disabled, input_attrs, input_invalid]"
							v-part:input
							v-bind="input_bindings"
						/>
					</template>
					<button
						v-if="draw_copy_btn"
						class="btn action-btn"
						@click="copy_value()"
						v-html="frappe.utils.icon('clipboard', 'sm')"
					></button>
					<span v-if="draw_link_btn" v-part:link_btn class="link-btn">
						<a
							class="btn-open no-decoration"
							:title="__('Open Link')"
							target="_blank"
							v-html="frappe.utils.icon('link', 'sm')"
						></a>
					</span>
					<span v-if="draw_scan_btn" v-part:scan_btn class="link-btn">
						<a
							class="btn-open no-decoration"
							:title="__('Scan')"
							@click="open_scanner()"
							v-html="frappe.utils.icon('scan-barcode', 'sm')"
						></a>
					</span>
				</div>
				<div
					v-memo="[show_input, bold, disp_style, disp_title, disp_html]"
					v-part:disp_area
					class="control-value like-disabled-input"
					:class="{ hide: show_input, bold }"
					:style="disp_style || null"
					:title="disp_title"
					v-html="disp_html"
				></div>
				<div
					v-memo="[description_shown, description_html]"
					v-part:help_box
					class="help-box small text-extra-muted"
					:class="{ hide: !description_shown }"
					v-html="description_html"
				></div>
			</div>
		</div>
		<span v-part:tooltip class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
	</div>
	<template v-else-if="draw_input || tooltip_into">
		<Teleport v-if="draw_input" :to="input_area" :disabled="!input_area">
			<input
				v-if="input_tag === 'input'"
				v-memo="[bold, input_disabled, input_attrs, input_invalid]"
				v-part:input
				v-bind="input_bindings"
			/>
			<select
				v-else-if="input_tag === 'select'"
				v-memo="[bold, input_disabled, input_attrs, input_invalid]"
				v-part:input
				v-bind="input_bindings"
			/>
			<textarea
				v-else-if="input_tag === 'textarea'"
				v-memo="[bold, input_disabled, input_attrs, input_invalid]"
				v-part:input
				v-bind="input_bindings"
			/>
			<component
				:is="input_tag"
				v-else
				v-memo="[bold, input_disabled, input_attrs, input_invalid]"
				v-part:input
				v-bind="input_bindings"
			/>
		</Teleport>
		<Teleport v-if="tooltip_into" :to="tooltip_into">
			<span v-part:tooltip class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
		</Teleport>
	</template>
</template>
