<script>
export default {
	name: "frappe.ui.Badge",
	props: ["label"],
	data() {
		return { clicks: 0 };
	},
	computed: {
		text() {
			return `${this.label} (${this.clicks})`;
		},
	},
	methods: {
		bump() {
			this.clicks = this.clicks + 1;
		},
	},
};
</script>

<template>
	<span class="badge-x" @click="bump()">{{ text }}</span>
</template>
