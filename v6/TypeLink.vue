<script>
export default {
	name: "frappe.ui.sidebar_item.TypeLink",
	created() {
			this.nested_items = this.item.nested_items || [];
			this.current_module = frappe.app.sidebar.current_module;
			this.prepare();
			this.path = this.get_path();
			this.set_suffix();
			this.hide_icon = !!(this.item.child && this.item.parent?.indent);
			if (!this.item.icon && !this.hide_icon) this.item.icon = "list";
	},
	computed: {
		wrapper() {
				return $(this.$el);
		},
	},
	methods: {
		prepare() {},
		container_click() {},
		renders() {
				return !!this.path || !!this.item.standard;
		},
		get_path() {
				return frappe.ui.sidebar_item.get_route(this.item, false, this.current_module);
		},
		container_class() {
				return ["sidebar-item-container", this.item.is_editable && "is-draggable"];
		},
		rail_label() {
				return frappe.app.sidebar.is_rail() ? this.item.label : undefined;
		},
		click() {
				if (this.path && frappe.is_mobile()) frappe.app.sidebar.close();
		},
		set_suffix() {
				if (this.item.suffix?.keyboard_shortcut) {
					this.item.suffix = this.get_shortcut_html(this.item.suffix.keyboard_shortcut);
				}
		},
		get_shortcut_html(shortcut) {
				return `<span class="keyboard-shortcut">${frappe.ui.keys.get_shortcut_label(shortcut)}</span>`;
		},
	},
};
</script>

<template>
	<div :id="item.id" :class="container_class()" :item-name="item.label" :data-id="item.label" @click="container_click()">
		<div class="standard-sidebar-item" :class="{ indent: item.indent }">
			<div v-if="item.type === 'Section Break' && item.indent != 1" class="item-anchor section-break">
				<span class="sidebar-item-label">{{ item.label }}</span>
				<div class="sidebar-item-control">
					<button
						class="btn-reset drop-icon"
						:data-state="collapsed ? 'closed' : 'open'"
						:aria-expanded="String(!collapsed)"
						@click="collapsed ? open() : close()"
						v-html="frappe.utils.icon('chevron-down', 'sm')"
					></button>
				</div>
			</div>
			<div v-else-if="item.type === 'Spacer'" class="item-anchor" style="pointer-events: none"></div>
			<a
				v-else
				:href="path || undefined"
				class="item-anchor"
				:data-link-type="item.link_type || ''"
				:title="rail_label()"
				:aria-label="rail_label()"
				@click="click()"
			>
				<span
					v-if="item.icon && !item.show_arrow && !hide_icon"
					class="sidebar-item-icon"
					:item-icon="item.icon"
					v-html="frappe.utils.icon(item.icon, 'sm')"
				></span>
				<span class="sidebar-item-label">{{ item.label }}</span>
				<span v-if="item.suffix" class="sidebar-item-suffix" v-html="item.suffix"></span>
				<div v-if="!item.show_arrow" class="sidebar-item-control"></div>
			</a>
		</div>
		<div class="sidebar-child-item nested-container" :style="collapsed ? { display: 'none' } : null"></div>
	</div>
</template>
