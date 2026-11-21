<script setup>
defineProps(["label", "n"]);
</script>

<template>
	<span class="plain-row">{{ label }} {{ n }}</span>
</template>
