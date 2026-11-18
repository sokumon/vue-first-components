<script>
import TypeLink from "./TypeLink.vue";

export default {
	name: "frappe.ui.sidebar_item.TypeButton",
	extends: TypeLink,
	methods: {
		container_class() {
				return this.item.class || super.container_class();
		},
		container_click() {
				this.item.onClick && this.item.onClick();
		},
	},
};
</script>
