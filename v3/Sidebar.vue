<script setup>
defineProps({ sidebar: Object });
</script>

<template>
	<div
		:style="sidebar.visible ? null : { display: 'none' }"
		class="body-sidebar-container"
		:class="{ expanded: !sidebar.is_rail(), 'sidebar-hidden': sidebar.is_hidden() }"
	>
		<div class="body-sidebar" :data-title="sidebar.current_module" :inert="sidebar.is_hidden() || null">
			<div class="standard-items-band"></div>
			<div class="body-sidebar-top">
				<div class="sidebar-items"></div>
			</div>
			<div class="body-sidebar-cards"></div>
			<div class="body-sidebar-bottom">
				<div class="promotional-banners"></div>
				<div class="nav-item dropdown-navbar-user dropdown-mobile mt-3">
					<a class="align-center btn-reset flex nav-link sidebar-user-button" :aria-label="__('User Menu')">
						<div v-html="frappe.avatar(frappe.session.user, 'avatar-medium')"></div>
						<div v-show="!sidebar.is_rail()" class="avatar-name-email overflow-hidden">
							<span class="d-block text-truncate">{{ frappe.session.user_fullname }}</span>
							<span class="d-block text-truncate">{{ frappe.session.user_email }}</span>
						</div>
					</a>
				</div>
			</div>
		</div>
		<div class="sidebar-edge" aria-hidden="true" @click="sidebar.toggle_width()"></div>
		<button
			class="btn-reset sidebar-collapse-arrow"
			type="button"
			:title="sidebar.arrow_label()"
			:aria-label="sidebar.arrow_label()"
			@click="sidebar.toggle_width()"
			v-html="frappe.utils.icon('chevron-left', 'xs')"
		></button>
		<div class="overlay" @click="sidebar.close()"></div>
	</div>
</template>
