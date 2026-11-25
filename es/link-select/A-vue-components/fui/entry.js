import "./style.css";
// frappe-ui components variant A draws Link and Select with, used unchanged (npm frappe-ui 1.2.0,
// the same copy wc/jq builds from). `vue` stays external: Desk's esbuild resolves it to one-vue's frappe.Vue.
export { Combobox, Select, portalTargetKey } from "frappe-ui";
