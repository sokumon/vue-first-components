<script setup>
defineProps({ probe: Object });
</script>

<template>
	<ul class="rows">
		<li v-for="row in probe.rows" :key="row" :data-row="row">{{ row }}</li>
	</ul>
	<div class="filled"></div>
	<div class="holder"><span class="vue-child">{{ probe.label }}</span><em v-if="probe.extra">extra</em></div>
</template>
