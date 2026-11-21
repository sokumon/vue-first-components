<script>
export default {
	name: "frappe.ui.VueProbe",
	// v8: only data() keys are reactive (the v5 probe set `this.buttons` in created())
	data() {
		return { buttons: [] };
	},
	computed: {
		wrapper() {
			return $(this.$el);
		},
	},
	methods: {
		bump() {
			this.add(1);
		},
		add(by) {
			this.count = this.count + by;
		},
		add_button(label, action) {
			this.buttons = [...this.buttons, { label, action }];
			this.flush();
			return this.wrapper.find(`[data-label="${label}"]`);
		},
	},
};
</script>

<script setup>
import { ref, computed } from "vue";

const count = ref(0);
const doubled = computed(() => count.value * 2);
</script>

<template>
	<div class="vue-probe" @click="bump()">
		<span class="numbers">{{ count }}|{{ doubled }}|{{ __("Save") }}</span>
		<button v-for="b in buttons" :key="b.label" :data-label="b.label" class="btn btn-default" @click.stop="b.action">
			{{ b.label }}
		</button>
		<div class="filled"></div>
	</div>
</template>
