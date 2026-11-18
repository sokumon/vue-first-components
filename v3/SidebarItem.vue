<script setup>
defineProps({ row: Object });
</script>

<template>
	<div :id="row.item.id" :class="row.container_class()" :item-name="row.item.label" :data-id="row.item.label" @click="row.container_click()">
		<div class="standard-sidebar-item" :class="{ indent: row.item.indent }">
			<div v-if="row.item.type === 'Section Break' && row.item.indent != 1" class="item-anchor section-break">
				<span class="sidebar-item-label">{{ row.item.label }}</span>
				<div class="sidebar-item-control">
					<button
						class="btn-reset drop-icon"
						:data-state="row.collapsed ? 'closed' : 'open'"
						:aria-expanded="String(!row.collapsed)"
						@click="row.collapsed ? row.open() : row.close()"
						v-html="frappe.utils.icon('chevron-down', 'sm')"
					></button>
				</div>
			</div>
			<div v-else-if="row.item.type === 'Spacer'" class="item-anchor" style="pointer-events: none"></div>
			<a
				v-else
				:href="row.path || undefined"
				class="item-anchor"
				:data-link-type="row.item.link_type || ''"
				:title="row.rail_label()"
				:aria-label="row.rail_label()"
				@click="row.click()"
			>
				<span
					v-if="row.item.icon && !row.item.show_arrow && !row.hide_icon"
					class="sidebar-item-icon"
					:item-icon="row.item.icon"
					v-html="frappe.utils.icon(row.item.icon, 'sm')"
				></span>
				<span class="sidebar-item-label">{{ row.item.label }}</span>
				<span v-if="row.item.suffix" class="sidebar-item-suffix" v-html="row.item.suffix"></span>
				<div v-if="!row.item.show_arrow" class="sidebar-item-control"></div>
			</a>
		</div>
		<div class="sidebar-child-item nested-container" :style="row.collapsed ? { display: 'none' } : null"></div>
	</div>
</template>
