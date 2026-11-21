<!--
frappe.ui.form.Control, template-first. A complete port of frappe's base_control.js; public API unchanged.

The legacy constructor was `$.extend(this, opts); this.make(); if (this.render_input) this.refresh()`.
Here `new` assigns the options and mounts the view (a placeholder: no part is switched on yet), then
mounted() runs the same make()/refresh(). make_wrapper() no longer builds markup: it switches the
template's wrapper on and reads it. A subclass that overrides make_wrapper() without calling super
(Check, Switch, Comment) builds its own wrapper as before; the template then teleports the tooltip
part into it, and the methods below write to it the legacy way (the `else` branches).
-->
<script>
export default {
	name: "frappe.ui.form.Control",
	data() {
		return {
			draw_wrapper: false, // make_wrapper() switches it on
			tooltip_into: null, // a wrapper a subclass built, which gets the tooltip part
			hidden_control: false,
			translatable_btn: false, // drawn by ControlInput's template, in the label row
		};
	},
	// the legacy constructor's tail
	mounted() {
		this.make();
		if (this.render_input) {
			this.refresh();
		}
	},
	computed: {
		perm: {
			get() {
				return this.frm?.perm;
			},
			set(_perm) {
				console.error("Setting perm on controls isn't supported, update form's perm instead");
			},
		},
	},
	methods: {
		make() {
			this.make_wrapper();
			if (!this.draw_wrapper) {
				// a wrapper the subclass built: the data attributes the template would have drawn
				this.$wrapper
					.attr("data-fieldtype", this.df.fieldtype)
					.attr("data-fieldname", this.df.fieldname);
			}
			this.wrapper = this.$wrapper.get(0);
			this.wrapper.fieldobj = this; // reference for event handlers
			if (!this.draw_wrapper) {
				// ...and the tooltip part, teleported into it
				this.tooltip_into = this.wrapper;
				this.flush();
			}
			this.tooltip = $(this.$parts.tooltip);
		},
		copy_fieldname(e) {
			let text = $(e.target).text();
			frappe.utils.copy_to_clipboard(text);
		},

		make_wrapper() {
			this.draw_wrapper = true;
			this.flush();
			this.$wrapper = $(this.$parts.wrapper);

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
		// The classes refresh() decides are template state: setting one that didn't change costs
		// nothing, and one render at the end of the batch applies the rest. That render is
		// synchronous: layout.js counts .frappe-control:not(.hide-control) right after.
		refresh() {
			this.batch(() => {
				this.disp_status = this.get_status();
				if (this.$wrapper) {
					this.set_hidden_control(this.disp_status == "None");
					this.refresh_input && this.refresh_input();
				}

				if (this.df.translatable) {
					this.show_translatable_button(this.get_value());
				}
			});
			this.reapply_state();
		},
		// Legacy refresh() wrote these to the DOM every time, whatever was there; frappe code outside
		// the control changes them (query_report's toggle_filter_display toggles hide-control on a
		// filter's wrapper). The render skips state that didn't change, so put back what it drew.
		reapply_state() {
			if (this.owns_wrapper()) this.wrapper.classList.toggle("hide-control", !!this.hidden_control);
		},
		// state set inside fn is drawn once, when the outermost batch ends
		batch(fn) {
			const fui = this.$fui;
			fui.refreshing++;
			try {
				return fn();
			} finally {
				fui.refreshing--;
				this.sync();
			}
		},
		// after a change to template state outside a batch: the DOM is current when this returns
		sync() {
			if (!this.$fui.refreshing) this.flush();
		},
		// legacy: `$wrapper.toggleClass("hide-control", ...)` in refresh()
		set_hidden_control(hide) {
			if (this.owns_wrapper()) {
				this.hidden_control = hide;
				this.sync();
			} else this.$wrapper.toggleClass("hide-control", hide);
		},
		// the template drew the wrapper (and $wrapper still is it)
		owns_wrapper() {
			return this.draw_wrapper && this.$wrapper?.[0] === this.$parts.wrapper;
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

			if (this.owns_wrapper()) {
				// Already attached button
				if (this.translatable_btn) return;
				this.translatable_btn = true; // ControlInput's template draws it in the label row
				return this.sync();
			}

			// a wrapper a subclass built: the legacy way, into its .clearfix if it has one
			if (this.$wrapper.find(".clearfix .btn-translation").length) return;

			const translation_btn = `<a class="btn-translation no-decoration text-muted" title="${__(
				"Open Translation"
			)}">
				${frappe.utils.icon("globe", "sm")}
			</a>`;

			$(translation_btn)
				.appendTo(this.$wrapper.find(".clearfix"))
				.on("click", () => this.open_translation());
		},
		open_translation() {
			if (!this.doc.__islocal) {
				new frappe.views.TranslationManager({
					df: this.df,
					source_text: this.value,
					target_language: this.doc.language,
					doc: this.doc,
				});
			}
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
		v-if="draw_wrapper"
		v-part:wrapper
		class="frappe-control"
		:class="{ 'hide-control': hidden_control }"
		:data-fieldtype="df.fieldtype"
		:data-fieldname="df.fieldname"
	>
		<span v-part:tooltip class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
	</div>
	<Teleport v-else-if="tooltip_into" :to="tooltip_into">
		<span v-part:tooltip class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
	</Teleport>
</template>
