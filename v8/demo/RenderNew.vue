<!-- A class whose render creates a legacy control (as a computed or a helper called from a template
might). The control's state must not become a dependency of this render. -->
<script>
export default {
	name: "frappe.ui.RenderNew",
	data() {
		return { tick: 0 };
	},
	created() {
		this.calls = 0;
		this.kids = [];
	},
	methods: {
		make_kid() {
			this.calls++;
			const box = document.createElement("div");
			const kid = new frappe.ui.form.ControlData({ df: { fieldtype: "Data", fieldname: "rn" + this.calls, label: "RN" }, parent: box, render_input: 1 });
			this.kids.push(kid);
			return kid.$input?.length ? "ready" : "no";
		},
	},
};
</script>

<template>
	<div class="render-new">{{ make_kid() }} {{ tick }}</div>
</template>
