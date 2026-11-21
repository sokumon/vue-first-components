<script>
export default {
	name: "frappe.ui.FuiProbe",
	data() {
		return { label: "Save", shown: false };
	},
	computed: {
		wrapper() {
			return $(this.$el);
		},
	},
	methods: {
		set_label(label) {
			this.label = label;
		},
		toggle() {
			this.shown = !this.shown;
		},
	},
};
</script>

<script setup>
import { ref } from "vue";
import { Button, Dropdown } from "./fui-lib.js";

const clicks = ref(0);
const picked = ref("");
const options = [
	{ label: "Alpha", onClick: () => (picked.value = "Alpha") },
	{ label: "Beta", onClick: () => (picked.value = "Beta") },
];
</script>

<template>
	<div class="fui-probe">
		<Button class="fui-btn" variant="solid" :label="label" @click="clicks++" />
		<span class="clicks">{{ clicks }}</span>
		<Dropdown :options="options">
			<button class="fui-dd-trigger">Open</button>
		</Dropdown>
		<span class="picked">{{ picked }}</span>
		<input class="fui-input" />
		<Transition name="fq">
			<div v-if="shown" class="fq-box"><input class="fq-input" /></div>
		</Transition>
	</div>
</template>

<style>
.fq-enter-active,
.fq-leave-active {
	transition: opacity 0.3s;
}
.fq-enter-from,
.fq-leave-to {
	opacity: 0;
}
</style>
