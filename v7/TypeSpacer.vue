<script>
import TypeLink from "./TypeLink.vue";

export default {
	name: "frappe.ui.sidebar_item.TypeSpacer",
	extends: TypeLink,
	methods: {
		renders() {
				return true;
		},
	},
};
</script>
