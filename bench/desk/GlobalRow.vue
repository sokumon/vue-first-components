<script>
export default { name: "frappe.ui.GlobalRow" };
</script>

<script setup>
import { store } from "./store.js";
</script>

<template>
	<span class="global-row">{{ label }} {{ store.n }}</span>
</template>
