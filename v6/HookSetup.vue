<script>
export default { name: "frappe.ui.HookSetup" };
</script>

<script setup>
import { onMounted, useTemplateRef } from "vue";

const box = useTemplateRef("box");
const calls = [];
onMounted(() => calls.push("mounted"));
</script>

<template>
	<div ref="box" class="hook-box"></div>
</template>
