<script setup>
import { ref } from "vue";

defineOptions({ name: "frappe.ui.PureSetup" });
const rows = ref([]);
function add_item(label) {
	rows.value = [...rows.value, label];
}
function make_sidebar() {
	add_item("Home");
}
defineExpose({ rows, add_item, make_sidebar });
</script>

<template>
	<ul class="pure"><li v-for="row in rows" :key="row">{{ row }}</li></ul>
</template>
