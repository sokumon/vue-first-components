<script>
export default {
	name: "frappe.ui.PerfRow",
	data() {
		return { n: 0 };
	},
	methods: {
		set(n) {
			this.n = n;
		},
	},
};
</script>

<template>
	<span class="perf-row">{{ label }} {{ n }}</span>
</template>
