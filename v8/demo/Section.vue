<!--
A parent class that draws child classes from its template: its fields are ControlData views in a
v-for, and a ProbeChild. It provides itself as "section" to everything below it, template-drawn or
created imperatively into its body.
-->
<script>
import { provide } from "vue";
import ControlData from "../controls/ControlData.vue";
import ProbeChild from "./ProbeChild.vue";

export default {
	name: "frappe.ui.Section",
	components: { ControlData, ProbeChild },
	data() {
		return { fields: [], collapsed: false, label: "", probe: false };
	},
	setup(self) {
		provide("section", self);
		return {};
	},
	created() {
		this.fields_dict = {};
		this.ready_order = [];
		this.fields = this.df_list || [];
	},
	mounted() {
		this.body = this.$parts.body;
		this.fields_at_mounted = Object.keys(this.fields_dict);
	},
	methods: {
		on_ready(control) {
			this.fields_dict[control.df.fieldname] = control;
			this.ready_order.push(control.df.fieldname);
		},
		add_field(df) {
			this.fields = [...this.fields, df];
			this.flush();
			return this.fields_dict[df.fieldname];
		},
		remove_field(fieldname) {
			this.fields = this.fields.filter((df) => df.fieldname !== fieldname);
			this.flush();
		},
	},
};
</script>

<template>
	<div v-part:section class="form-section" :class="{ collapsed }">
		<div class="section-head">{{ label }}</div>
		<div v-part:body class="section-body">
			<ControlData v-for="df in fields" :key="df.fieldname" :df="df" :render_input="1" @ready="on_ready($event)" />
		</div>
		<ProbeChild v-if="probe" />
	</div>
</template>
