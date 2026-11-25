<!--
frappe.ui.form.SelectInput: what a Select control draws (variant A): frappe-ui's Select, used unchanged,
mounted with `new` into the control's input area, next to the control's native <select>.

The native <select> stays control.$input (the contract: apps .empty().add_options() it, read
`select[data-fieldname=x]`, `$input.find("option")`, `.val()`), kept out of sight. It is the model the
view draws: options, value and disabled are read from it whenever jQuery writes it (`select-change`,
which select.js's $.fn.val patch and add_options() fire) or it changes, and a pick in the frappe-ui
Select is written back with `.val(v)` plus a native `change`, which the control handles as before.
-->
<script>
import { Select } from "./fui-a.js";
import { portal_target } from "./portal.js";

export default {
	name: "frappe.ui.form.SelectInput",
	components: { Select },
	data() {
		return {
			options: [],
			value: null,
			placeholder: "",
			disabled: false,
		};
	},
	created() {
		this.portal_to = portal_target();
	},
	mounted() {
		const select = (this.select = this.control.input);
		$(select).on("select-change change", () => this.read());
		// focus sent to the native select (set_focus(), grid row navigation) goes to the visible trigger
		$(select).on("focus", () => this.trigger_element()?.focus());
		this.read();
	},
	methods: {
		read() {
			const select = this.select;
			if (!select) return;
			const options = [...select.options].map((o) => ({ label: o.textContent, value: o.value, disabled: o.disabled }));
			const same =
				options.length === this.options.length &&
				options.every((o, i) => o.label === this.options[i].label && o.value === this.options[i].value && o.disabled === this.options[i].disabled);
			if (!same) this.options = options;
			// legacy showed the placeholder while the selected option's text is empty: null shows the Select's
			const selected = select.options[select.selectedIndex];
			const value = !selected || (this.placeholder && !selected.textContent) ? null : select.value;
			if (value !== this.value) this.value = value;
			if (select.disabled !== this.disabled) this.disabled = select.disabled;
			this.flush();
		},
		trigger_element() {
			return this.$parts.root?.querySelector('[data-slot="trigger"], button');
		},
		on_pick(value) {
			const $select = this.control.$input;
			if (!$select || value === $select.val()) return;
			$select.val(value);
			$select[0].dispatchEvent(new Event("change", { bubbles: true }));
		},
	},
};
</script>

<template>
	<div v-part:root class="tw-fui tw-select">
		<Select
			:options="options"
			:model-value="value"
			:placeholder="placeholder"
			:disabled="disabled"
			:portal-to="portal_to"
			class="w-full"
			variant="subtle"
			size="sm"
			@update:model-value="on_pick($event)"
		/>
	</div>
</template>
