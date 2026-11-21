<!-- A row whose template has a child component taking a prop: flushing it patches the child with new
props, the path where Vue scans its whole job queue (updateComponentPreRender -> flushPreFlushCbs). -->
<script>
import Badge from "./Badge.vue";

export default {
	name: "frappe.ui.RowKid",
	components: { Badge },
	data() {
		return { count: 0 };
	},
};
</script>

<template>
	<div class="row-kid">{{ label }}<Badge :n="count" /></div>
</template>
