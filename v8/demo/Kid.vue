<!--
A class with a <script setup>-style onMounted that calls back: lets the spike run legacy calls from a
descendant's lifecycle hook (Vue sets currentInstance there).
-->
<script>
import { onMounted } from "vue";

export default {
	name: "frappe.ui.Kid",
	setup(self) {
		onMounted(() => self.on_mounted && self.on_mounted());
		return {};
	},
};
</script>

<template>
	<span class="kid">kid</span>
</template>
