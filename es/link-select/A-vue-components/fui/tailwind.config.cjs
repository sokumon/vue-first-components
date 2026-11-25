// only the classes the components A uses can produce (Combobox, Select and what they import)
const preset = require("frappe-ui/tailwind").default || require("frappe-ui/tailwind");
const F = "/home/claude/vue-first-components/wc/node_modules/frappe-ui/src/";
module.exports = {
	presets: [preset],
	corePlugins: { preflight: false },
	content: [F + "components/Combobox/*.{vue,ts}", F + "components/Select/*.{vue,ts}", F + "components/shared/**/*.{vue,ts}", F + "components/InputLabeling/**/*.{vue,ts}", F + "components/ItemListRow/**/*.{vue,ts}", F + "components/Spinner/**/*.{vue,ts}", F + "composables/*.ts", F + "utils/*.ts", "/home/claude/vue-first-components/wc/three-ways/A-vue-components/src/tw_a/*.vue"],
};
