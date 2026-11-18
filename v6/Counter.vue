<script>
export default {
	name: "frappe.ui.Counter",
	computed: {
		wrapper() {
			return $(this.$el);
		},
	},
	methods: {
		bump() {
			this.add(1);
		},
		add(by) {
			this.count = this.count + by;
		},
	},
};
</script>

<script setup>
import { ref, computed, watch, inject } from "vue";

const count = ref(0);
const theme = inject("desk").theme;
const doubled = computed(() => format(count.value * 2));
const seen = [];
watch(count, (value) => seen.push(value), { flush: "sync" });

function format(value) {
	return `${theme}:${value}`;
}
</script>

<template>
	<span class="counter" @click="bump()">{{ count }}|{{ doubled }}</span>
</template>
