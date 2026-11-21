<!--
frappe.ui.form.Control, the base of every form field, as a v5 class. Ported from
frappe/public/js/frappe/form/controls/base_control.js with its public API unchanged.

What moved: the wrapper's markup is the template. Everything else is the legacy code as it was:
methods that read or poke the DOM keep doing so through $wrapper.

The legacy constructor was `$.extend(this, opts); this.make(); if (this.render_input) this.refresh()`.
Here the options are assigned by the class, and make()/refresh() run in mounted(), which is still
inside `new`. The view starts as a placeholder: make_wrapper() is what asks for the markup, so a
subclass that overrides make_wrapper() without calling super (Check, Switch, Comment) keeps building
its own with jQuery, as it always did.
-->
<script>
import { toRaw } from "vue";

export default {
	name: "frappe.ui.form.Control",
	data() {
		return {
			// drawn on the first render, unless a subclass overrides make_wrapper(): then only if it calls super
			vue_wrapper: this.make_wrapper === frappe.ui.form.Control.prototype.make_wrapper,
			hidden_control: false,
		};
	},
	mounted() {
		this.make();
		if (this.render_input) {
			this.refresh();
		}
	},
	computed: {
		// `appendTo(undefined)` left the wrapper detached, for a caller to append it later
		host() {
			return (this.parent && $(this.parent)[0]) || document.createDocumentFragment();
		},
		perm() {
			return this.frm?.perm;
		},
	},
	methods: {
		make() {
			this.make_wrapper();
			this.wrapper = this.$wrapper.get(0);
			this.wrapper.fieldobj = this; // reference for event handlers
			if (this.vue_drawn) {
				// data-fieldtype, data-fieldname and the tooltip are in the template
				this.tooltip = $(this.$refs.tooltip);
				return;
			}
			this.$wrapper
				.attr("data-fieldtype", this.df.fieldtype)
				.attr("data-fieldname", this.df.fieldname);

			this.tooltip = $(`<span class="tooltip-content">${__(this.df.fieldname)}</span>`);
			this.$wrapper.append(this.tooltip);

			this.tooltip.on("click", (e) => this.copy_fieldname(e));
		},
		copy_fieldname(e) {
			let text = $(e.target).text();
			frappe.utils.copy_to_clipboard(text);
		},

		// the template draws the wrapper; this adopts it
		make_wrapper() {
			if (!this.vue_wrapper) {
				this.vue_wrapper = true;
				this.flush();
			}
			this.$wrapper = $(this.$el);
			this.vue_drawn = true; // the template draws the wrapper's classes; a jQuery-built one doesn't have one

			// alias
			this.wrapper = this.$wrapper;
		},

		toggle(show) {
			this.df.hidden = show ? 0 : 1;
			this.refresh();
		},

		// returns "Read", "Write" or "None"
		// as strings based on permissions
		get_status(explain) {
			if (this.df.get_status) {
				return this.df.get_status(this);
			}

			if (
				(!this.doctype && !this.docname) ||
				this.df.parenttype === "Web Form" ||
				this.df.is_web_form
			) {
				let status = "Write";

				// like in case of a dialog box
				if (cint(this.df.hidden)) {
					if (explain) console.log("By Hidden: None");
					return "None";
				} else if (cint(this.df.hidden_due_to_dependency)) {
					if (explain) console.log("By Hidden Dependency: None");
					return "None";
				} else if (
					cint(this.df.read_only || this.df.is_virtual || this.df.fieldtype === "Read Only")
				) {
					if (explain) console.log("By Read Only: Read");
					status = "Read";
				} else if (
					(this.grid && this.grid.control !== this && this.grid.display_status == "Read") ||
					(this.layout && this.layout.grid && this.layout.grid.display_status == "Read")
				) {
					// parent grid is read
					if (explain) console.log("By Parent Grid Read-only: Read");
					status = "Read";
				}

				let value = this.value || this.get_model_value();
				value = this.get_parsed_value(value);

				if (
					status === "Read" &&
					is_null(value) &&
					!["Attachment Gallery", "HTML", "Image", "Button"].includes(this.df.fieldtype)
				)
					status = "Read";

				return status;
			}

			var status = frappe.perm.get_field_display_status(
				this.df,
				frappe.model.get_doc(this.doctype, this.docname),
				this.perm || (this.frm && this.frm.perm),
				explain
			);

			// Match parent grid controls read only status
			if (
				status === "Write" &&
				(this.grid || (this.layout && this.layout.grid && !cint(this.df.allow_on_submit)))
			) {
				var grid = this.grid || this.layout.grid;
				if (grid.display_status == "Read") {
					status = "Read";
					if (explain) console.log("By Parent Grid Read-only: Read");
				}
			}

			let value = frappe.model.get_value(this.doctype, this.docname, this.df.fieldname);

			if (["Date", "Datetime"].includes(this.df.fieldtype) && value) {
				value = frappe.datetime.str_to_user(value);
			}

			value = this.get_parsed_value(value);

			// hide if no value
			if (
				this.doctype &&
				status === "Read" &&
				!this.only_input &&
				is_null(value) &&
				frappe.defaults.is_enabled("hide_empty_read_only_fields") &&
				![
					"Attachment Gallery",
					"HTML",
					"Image",
					"Button",
					"Geolocation",
					"Vue Component",
				].includes(this.df.fieldtype)
			) {
				if (explain) console.log("By Hide Read-only, null fields: None");
				status = "None";
			}

			return status;
		},
		// The classes refresh() decides (hidden, error, required, bold, input or display) are template
		// state: setting one that didn't change costs nothing, and one render at the end applies the
		// rest. That render is synchronous: layout.js counts .frappe-control:not(.hide-control) next.
		refresh() {
			const raw = toRaw(this);
			raw.$refreshing = (raw.$refreshing || 0) + 1;
			try {
				this.disp_status = this.get_status();
				if (this.$wrapper) {
					this.set_hidden_control(this.disp_status == "None");
					this.refresh_input && this.refresh_input();
				}

				if (this.df.translatable) {
					this.show_translatable_button(this.get_value());
				}
			} finally {
				raw.$refreshing--;
			}
			this.sync();
		},
		set_hidden_control(hide) {
			if (this.vue_drawn) this.hidden_control = hide;
			else this.$wrapper.toggleClass("hide-control", hide);
		},
		// After a change to template state, outside refresh(): the DOM is up to date when this returns.
		sync() {
			if (!toRaw(this).$refreshing) this.flush();
		},
		show_translatable_button(value) {
			// Disable translation non-string fields or special string fields
			if (
				!frappe.model ||
				!this.frm ||
				!this.doc ||
				!this.df.translatable ||
				!frappe.model.can_write("Translation") ||
				!value
			)
				return;

			// Disable translation in website
			if (!frappe.views || !frappe.views.TranslationManager) return;

			// Already attached button
			if (this.$wrapper.find(".clearfix .btn-translation").length) return;

			const translation_btn = `<a class="btn-translation no-decoration text-muted" title="${__(
				"Open Translation"
			)}">
				${frappe.utils.icon("globe", "sm")}
			</a>`;

			$(translation_btn)
				.appendTo(this.$wrapper.find(".clearfix"))
				.on("click", () => {
					if (!this.doc.__islocal) {
						new frappe.views.TranslationManager({
							df: this.df,
							source_text: this.value,
							target_language: this.doc.language,
							doc: this.doc,
						});
					}
				});
		},
		get_doc() {
			return (
				(this.doctype &&
					this.docname &&
					locals[this.doctype] &&
					locals[this.doctype][this.docname]) ||
				{}
			);
		},
		get_model_value() {
			if (this.doc) {
				return this.doc[this.df.fieldname];
			}
		},
		get_parsed_value(value) {
			if (this.parse) {
				value = this.parse(value);
			}
			return value;
		},

		set_value(value, force_set_value = false) {
			return this.validate_and_set_in_model(value, null, force_set_value);
		},
		parse_validate_and_set_in_model(value, e) {
			value = this.get_parsed_value(value);
			return this.validate_and_set_in_model(value, e);
		},
		validate_and_set_in_model(value, e, force_set_value = false) {
			const me = this;
			const is_value_same = this.get_model_value() === value;
			if (this.inside_change_event || (is_value_same && !force_set_value)) {
				me.set_formatted_input?.(value);
				return Promise.resolve();
			}

			const old_value = this.get_model_value();
			this.frm?.undo_manager?.record_change({
				fieldname: me.df.fieldname,
				old_value,
				new_value: value,
				doctype: this.doctype,
				docname: this.docname,
				is_child: Boolean(this.doc?.parenttype),
			});
			this.inside_change_event = true;
			function set(value) {
				me.inside_change_event = false;
				return frappe.run_serially([
					() => (me._validated = true),
					() => me.set_model_value(value),
					() => delete me._validated,
					() => {
						me.set_mandatory && me.set_mandatory(value);

						if (me.df.change || me.df.onchange) {
							// onchange event specified in df
							let set = (me.df.change || me.df.onchange).apply(me, [e]);
							me.set_invalid && me.set_invalid();
							return set;
						}
						me.set_invalid && me.set_invalid();
					},
					() => me?.after_set_value?.(),
				]);
			}
			value = this.validate(value);
			if (value && value.then) {
				// got a promise
				return value.then((value) => set(value));
			} else {
				// all clear
				return set(value);
			}
		},
		get_value() {
			if (this.get_status() === "Write") {
				return this.get_input_value
					? this.parse
						? this.parse(this.get_input_value())
						: this.get_input_value()
					: undefined;
			} else {
				return this.value || undefined;
			}
		},
		set_model_value(value) {
			if (this.frm) {
				this.last_value = value;
				return frappe.model.set_value(
					this.doctype,
					this.docname,
					this.df.fieldname,
					value,
					this.df.fieldtype
				);
			} else {
				if (this.doc) {
					this.doc[this.df.fieldname] = value;
				}
				this.set_input(value);
				return Promise.resolve();
			}
		},
		set_focus() {
			if (this.$input) {
				this.$input.get(0).focus();
				return true;
			}
		},
	},
};
</script>

<template>
	<div
		v-if="vue_wrapper"
		class="frappe-control"
		:class="{ 'hide-control': hidden_control }"
		:data-fieldtype="df.fieldtype"
		:data-fieldname="df.fieldname"
	>
		<span v-once ref="tooltip" class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
	</div>
</template>
