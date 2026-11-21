<!--
frappe.ui.button.html(opts) as a template (frappe/public/js/frappe/ui/components/button.js): the same
<button class="es-button"> with the same attributes and children, so page.scss and button.css style
it exactly as before. Classes and any other attribute (data-label, hidden, ...) fall through from the
caller.

	label, icon (= icon_left), icon_right, variant, size, theme, title, loading_label   as button_html()
	label_class        classes page.js added to the label span afterwards (hidden-xs, actions-btn-group-label)
	short_label        set_action()'s second, below-md label span (hidden-lg)
	icon_right_class   classes on the right icon (add_custom_button_group: hidden-xs)
	gen                set_action() rebuilt the children every time (button.dress); a new gen draws new ones
	part               the controller part (v-part) the <button> is recorded as. A prop, not v-part on
	                   <EsButton>: a directive on a component's vnode makes Vue update it on every render
	                   of its parent

Attributes equal to the CSS defaults (subtle / sm / gray) are left out, as button_html() does.
-->
<script>
import Icon from "./Icon.vue";
import { keep } from "./anchors.js";

function default_loading_label(label) {
	if (!label) return null;
	const map = {
		[__("Save")]: __("Saving..."),
		[__("Delete")]: __("Deleting..."),
		[__("Submit")]: __("Submitting..."),
	};
	return map[label] || null;
}

export default {
	name: "EsButton",
	components: { Icon },
	directives: { keep },
	props: {
		label: { type: String, default: undefined },
		// undefined: frappe's default map (Save -> Saving...); "" or null: none
		loading_label: { type: String, default: undefined },
		icon: { type: String, default: undefined },
		icon_left: { type: String, default: undefined },
		icon_right: { type: String, default: undefined },
		variant: { type: String, default: undefined },
		size: { type: String, default: undefined },
		theme: { type: String, default: undefined },
		title: { type: String, default: undefined },
		type: { type: String, default: "button" },
		label_class: { type: String, default: undefined },
		short_label: { type: String, default: undefined },
		icon_right_class: { type: String, default: "" },
		gen: { type: Number, default: 0 },
		part: { type: String, default: undefined },
	},
	computed: {
		left() {
			return this.icon_left || this.icon;
		},
		icon_only() {
			return Boolean((this.left || this.icon_right) && !this.label);
		},
		loading_text() {
			return this.loading_label !== undefined ? this.loading_label : default_loading_label(this.label);
		},
	},
};
</script>

<template>
	<button
		v-part:[part]
		v-keep
		class="es-button"
		:type="type"
		:data-variant="variant && variant !== 'subtle' ? variant : undefined"
		:data-size="size && size !== 'sm' ? size : undefined"
		:data-theme="theme && theme !== 'gray' ? theme : undefined"
		:data-icon-button="icon_only ? 'true' : undefined"
		:title="title || undefined"
		:aria-label="icon_only && title ? title : undefined"
	>
		<template v-for="g in [gen]" :key="g">
			<span class="es-spinner" aria-hidden="true"></span>
			<span v-if="loading_text" class="es-button__loading-label" aria-live="polite">{{ loading_text }}</span>
			<Icon v-if="left" :name="left" current_color />
			<span v-if="label" class="es-button__label" :class="label_class">{{ label }}</span>
			<span v-if="label && short_label" class="es-button__label hidden-lg">{{ short_label }}</span>
			<Icon v-if="icon_right" :name="icon_right" :svg_class="icon_right_class" current_color />
		</template>
	</button>
</template>
