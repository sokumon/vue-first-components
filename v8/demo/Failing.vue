<script>
export default {
	name: "frappe.ui.Failing",
	created() {
		if (this.boom) throw new Error("boom in created");
	},
};
</script>

<template>
	<div class="failing">{{ will_throw ? missing.deep : "ok" }}</div>
</template>
