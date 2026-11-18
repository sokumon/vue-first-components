<script>
import TypeLink from "./TypeLink.vue";

export default {
	name: "frappe.ui.sidebar_item.TypeSectionBreak",
	extends: TypeLink,
	mounted() {
			this.add_items();
	},
	methods: {
		prepare() {
				this.collapsed = false;
				this.items = [];
				this.$items = [];
		},
		renders() {
				return this.nested_items.length > 0;
		},
		container_class() {
				return ["sidebar-item-container", "section-item"];
		},
		add_items() {
				this.$nested_items = this.wrapper.find(".nested-container").first();
				this.nested_items.forEach((f) => {
					this.items.push(frappe.app.sidebar.make_sidebar_item({ container: this.$nested_items, item: f }));
				});
		},
		open() {
				this.collapsed = false;
				this.toggle();
		},
		close() {
				this.collapsed = true;
				this.toggle();
		},
		toggle() {
				this.flush();
		},
		destroy() {
				this.items.forEach((item) => item.destroy());
				super.destroy();
		},
	},
};
</script>
