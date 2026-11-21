<!-- created() runs inside Vue's patch (the view's setup): a `new` there, into a detached element, still returns with its DOM, and becomes this view's child. -->
<script>
import { provide } from "vue";

export default {
	name: "frappe.ui.Nest",
	setup() {
		provide("section", { label: "Nest" });
		return {};
	},
	created() {
		this.inner = new frappe.ui.ProbeChild({ parent: document.createElement("div") });
		this.inner_ready = this.inner.$el?.textContent;
	},
	mounted() {
		this.$parts.slot.appendChild(this.inner.$el.parentNode);
	},
};
</script>

<template>
	<div v-part:slot class="nest"></div>
</template>
