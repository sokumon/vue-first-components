<script setup>
defineProps({ sidebar: Object });
</script>

<template>
	<div class="body-sidebar" :class="{ expanded: sidebar.expanded }">
		<div class="sidebar-header">
			{{ sidebar.header_title() }}
			<ul class="menu">
				<li v-for="m in sidebar.menu_items()" :key="m.label">{{ m.label }}</li>
			</ul>
		</div>
		<div class="sidebar-items" v-show="sidebar.current_module">
			<a v-for="item in sidebar.items" :key="item.label" class="sidebar-item">{{ item.label }}</a>
		</div>
		<button class="collapse" @click="sidebar.toggle_width()">c</button>
	</div>
</template>
