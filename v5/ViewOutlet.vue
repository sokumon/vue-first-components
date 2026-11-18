<script setup>
import { getCurrentInstance } from "vue";

const views = frappe.ui.views;
frappe.ui.outlet = getCurrentInstance();
</script>

<template>
	<Teleport v-for="controller in views" :key="controller.uid" :to="controller.host">
		<component :is="controller.constructor.view" :controller="controller" />
	</Teleport>
</template>
