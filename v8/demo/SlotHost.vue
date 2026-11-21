<!-- A class whose state is read only inside a child component's slot: flush() has to run the child's own render. -->
<script>
import { h } from "vue";
const Box = { name: "Box", setup: (_, { slots }) => () => h("div", { class: "box" }, slots.default()) };

export default {
	name: "frappe.ui.SlotHost",
	components: { Box },
	data() {
		return { n: 0, show: true };
	},
};
</script>

<template>
	<Box v-if="show"><span class="n">{{ n }}</span></Box>
</template>
