<!-- A view whose own pre watcher fixes its state before its render (a common Vue pattern). -->
<script>
import { watch } from "vue";

export default {
	name: "frappe.ui.Picker",
	data() {
		return { items: ["a", "b", "c"], index: 2 };
	},
	setup(self) {
		watch(
			() => self.items,
			(items) => {
				if (self.index >= items.length) self.index = 0;
			}
		);
		return {};
	},
};
</script>

<template>
	<b class="picker">{{ items[index].toUpperCase() }}</b>
</template>
