<!--
The markup of frappe.utils.icon(name, size, icon_class, "", svg_class, current_color) as a template:
an emoji draws as itself in a <span>, any other name as the sprite's <svg><use href="#icon-name">.
Used by Page.vue, EsButton.vue and PageMenuItem.vue wherever page.html and page.js called
frappe.utils.icon().
-->
<script>
export default {
	name: "FrappeIcon",
	props: {
		name: { type: String, default: "" },
		size: { type: String, default: "sm" },
		svg_class: { type: String, default: "" },
		icon_class: { type: String, default: "" },
		// frappe.ui.button's icons: stroke="currentColor"
		current_color: { type: Boolean, default: false },
	},
	computed: {
		emoji() {
			return frappe.utils.is_emoji(this.name);
		},
	},
};
</script>

<template>
	<span v-if="emoji">{{ name }}</span>
	<svg
		v-else
		:class="['icon', svg_class, size ? `icon-${size}` : '']"
		:stroke="current_color ? 'currentColor' : undefined"
		aria-hidden="true"
	>
		<use :class="icon_class" :href="`#icon-${name}`"></use>
	</svg>
</template>
