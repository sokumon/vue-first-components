<script setup>
import { inject } from "vue";

defineProps({ page: Object });
const desk = inject("desk");
</script>

<template>
	<div class="page-head" :data-theme="desk.theme">
		<h3 class="title-text">{{ page.title_label() }}</h3>
		<span v-if="page.indicator" class="indicator-pill" :class="page.indicator.color">{{ page.indicator.label }}</span>
		<div class="inner-group-button">
			<button v-for="b in page.inner_buttons" :key="b.label" class="btn btn-default btn-xs" :data-label="b.label" @click="b.action">
				{{ b.label }}
			</button>
		</div>
	</div>
	<div class="layout-main">
		<div class="layout-side-section"></div>
		<div class="layout-main-section-wrapper">
			<div class="layout-main-section"></div>
		</div>
	</div>
</template>
