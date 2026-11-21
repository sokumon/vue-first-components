<!--
A region of frappe.ui.Page's template that renders on its own. Slot content is rendered by the
component that renders the slot, so the state a region's markup reads (the breadcrumbs, the
indicator, a button's state, a menu's flags) is tracked by the region, not by the page: set_title
renders the breadcrumbs, set_indicator the indicator, set_primary_action the primary button group,
and the page's own template, which is most of page.html, is not rendered again. The markup stays in
Page.vue's template; directives and handlers in it belong to the page.
-->
<script>
export default { name: "PageRegion" };
</script>

<template>
	<slot />
</template>
