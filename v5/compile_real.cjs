const FRAPPE = process.env.FRAPPE || require("path").resolve(__dirname, "../../../frappe");
const fs = require("fs");
const sfc = require(FRAPPE + "/node_modules/vue/compiler-sfc/index.js");
for (const filename of ["Sidebar.vue", "Badge.vue"]) {
	const { descriptor } = sfc.parse(fs.readFileSync(filename, "utf8"), { filename });
	const script = sfc.compileScript(descriptor, { id: "x" });
	const t = sfc.compileTemplate({ id: "x", source: descriptor.template.content, filename, compilerOptions: { bindingMetadata: script.bindings } });
	const names = (re) => [...new Set(t.code.match(re) || [])].join(" ");
	console.log(filename, "\n  signature:", t.code.match(/export function render\([^)]*\)/)[0]);
	console.log("  bindings:", JSON.stringify(script.bindings).slice(0, 300));
	console.log("  $options:", names(/\$options\.\w+/g));
	console.log("  $data:", names(/\$data\.\w+/g));
	console.log("  $props:", names(/\$props\.\w+/g));
	console.log("  _ctx:", names(/_ctx\.\w+/g));
	console.log("  script changed by compileScript:", script.content.trim() !== descriptor.script.content.trim());
}
