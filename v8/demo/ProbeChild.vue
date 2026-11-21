<script>
import { inject } from "vue";

export default {
	name: "frappe.ui.ProbeChild",
	data() {
		return { n: 0 };
	},
	setup() {
		return { section: inject("section", null), desk: inject("desk", null) };
	},
	methods: {
		explode() {
			throw new Error("handler failed");
		},
		bump() {
			this.n++;
			this.flush();
		},
	},
};
</script>

<template>
	<div class="probe-child" @dblclick="explode()">{{ desk ? desk.theme : "no-desk" }}|{{ section ? section.label : "no-section" }}|{{ n }}</div>
</template>
