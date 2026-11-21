<script>
export default {
	name: "frappe.ui.SetupProbe",
	data() {
		return { label: "x" };
	},
	mounted() {
		this.child = new frappe.ui.PerfRow({ parent: this.$el, label: "child" });
	},
	methods: {
		set_label(label) {
			this.label = label;
		},
	},
};
</script>

<script setup>
import { ref, onMounted, onUpdated, useTemplateRef, inject } from "vue";
import { Button } from "./fui-lib.js";

const calls = [];
const box = useTemplateRef("box");
const legacy_box = ref(null);
const route = inject("no-such-key", "none");
onMounted(() => calls.push("mounted:" + !!box.value));
onUpdated(() => calls.push("updated"));
let counter = 0;
function bump_local() {
	counter++;
}
</script>

<template>
	<div class="setup-probe">
		<div ref="box" class="sp-box">{{ label }}</div>
		<div ref="legacy_box" class="sp-legacy"></div>
		<Button class="sp-route-btn" label="Go" route="/desk/role" />
	</div>
</template>
