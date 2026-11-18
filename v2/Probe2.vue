<script setup>
defineProps({ probe: Object });
</script>

<template>
	<div class="holder" :class="{ active: probe.on }">
		<span>{{ probe.label }}</span>
		<em v-if="probe.extra">extra</em>
	</div>
	<ul class="rows">
		<li v-for="row in probe.rows" :key="row" :data-row="row">{{ row }}</li>
	</ul>
</template>
