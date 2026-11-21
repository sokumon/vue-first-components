// jsdom + Vue + compiler-sfc + jQuery from the Frappe checkout, and loaders that do what the desk build
// does: a .vue file is compiled (script without inlineTemplate, template with the script's
// bindings), a `name: "frappe.ui.*"` file is handed to frappe.ui.define, and ESM sources (the runtime,
// frappe's info_card.js) are turned into CommonJS with the esbuild the desk itself uses.
//
// One build-time extra the desk plugin does not have: <template extends="./Parent.vue"> with
// <template #name> blocks, spliced into the parent's <block name="name"> at build time. The three
// controls do not use it (ControlData has an empty template and `inherit_view: true`); it stays for
// demos that want it.
const path = require("path");
const FRAPPE = process.env.FRAPPE || path.resolve(process.env.HOME || "/", "fb/frappe-bench/apps/frappe");
const fs = require("fs"), Module = require("module");
const { JSDOM } = require(FRAPPE + "/flow/node_modules/jsdom");
const dom = new JSDOM('<!doctype html><body><div class="main-section"></div></body>', { url: "http://site.test/desk/item" });
for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "MutationObserver", "localStorage", "DocumentFragment", "Text", "Comment"])
	global[k] = k === "window" ? dom.window : dom.window[k];
const jq = require(FRAPPE + "/node_modules/jquery");
global.$ = global.jQuery = jq.fn ? jq : jq(dom.window);
const sfc = require(FRAPPE + "/node_modules/vue/compiler-sfc/index.js");
const esbuild = require(FRAPPE + "/node_modules/esbuild");
const FRAPPE_JS = FRAPPE + "/frappe/public/js/";
const resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
	if (req === "vue") return require.resolve(FRAPPE + "/node_modules/vue/index.js");
	if (req === "@vue/reactivity") return require.resolve(FRAPPE + "/node_modules/@vue/reactivity/index.js");
	// what the controls import from the desk, relative to frappe/public/js/vue_first8/controls/
	const m = /(?:\.\.\/)+frappe\/(form\/info_card)(?:\.js)?$/.exec(req);
	if (m) return FRAPPE_JS + "frappe/" + m[1] + ".js";
	return resolve.call(this, req, ...rest);
};
const to_cjs = (code, file) => esbuild.transformSync(code, { format: "cjs", loader: "js", sourcefile: file, target: "node20" }).code;
const ESM_HERE = __dirname + path.sep;
const js = require.extensions[".js"];
require.extensions[".js"] = (module, filename) => {
	if ((filename.startsWith(ESM_HERE) && !filename.includes("node_modules")) || filename.startsWith(FRAPPE_JS))
		return module._compile(to_cjs(fs.readFileSync(filename, "utf8"), filename), filename);
	return js(module, filename);
};

function template_source(filename) {
	const { descriptor } = sfc.parse(fs.readFileSync(filename, "utf8"), { filename });
	const tpl = descriptor.template;
	if (!tpl) return null;
	if (!tpl.attrs.extends) return tpl.content;
	const parent = template_source(path.resolve(path.dirname(filename), tpl.attrs.extends));
	const blocks = {};
	for (const m of tpl.content.matchAll(/<template #([\w-]+)>([\s\S]*?)<\/template>/g)) blocks[m[1]] = m[2];
	return parent.replace(/<block name="([\w-]+)"\s*(?:\/>|>([\s\S]*?)<\/block>)/g, (all, name) => (name in blocks ? `<block name="${name}">${blocks[name]}</block>` : all));
}
const strip_blocks = (src) => src.replace(/<block name="[\w-]+"\s*\/>/g, "").replace(/<block name="[\w-]+">([\s\S]*?)<\/block>/g, "$1");

require.extensions[".vue"] = (module, filename) => {
	const { descriptor } = sfc.parse(fs.readFileSync(filename, "utf8"), { filename });
	const id = path.basename(filename);
	const compiled = descriptor.scriptSetup || descriptor.script ? sfc.compileScript(descriptor, { id, inlineTemplate: false }) : null;
	let code = (compiled ? compiled.content : "export default {}").replace(/export default/, "const _sfc_main =");
	let source = template_source(filename);
	if (source != null) {
		source = strip_blocks(source);
		const out = sfc.compileTemplate({ source, filename, id, isProd: process.env.NODE_ENV === "production", compilerOptions: { bindingMetadata: compiled?.bindings } });
		if (out.errors.length) throw new Error(filename + ": " + out.errors.join("\n"));
		code += "\n" + out.code.replace("export function render", "function render") + "\n_sfc_main.render = render;\n";
	}
	code += `if (_sfc_main.name?.startsWith("frappe.ui.")) frappe.ui.define(_sfc_main);\nexport default _sfc_main;\n`;
	const cjs = to_cjs(code, filename).replace(/module\.exports = __toCommonJS\((\w+)\);/, "");
	module._compile(cjs + "\nmodule.exports = _sfc_main;", filename);
};

// ------------------------------------------------ the desk globals the classes lean on
global.__ = (s, args) => (args ? String(s).replace(/\{(\d+)\}/g, (_, i) => args[i]) : s);
global.cint = (v) => parseInt(v, 10) || 0;
global.cstr = (v) => (v == null ? "" : String(v));
global.is_null = (v) => v === null || v === undefined || v === "";
global.validate_url = (v) => /^https?:\/\//.test(v);
global.validate_email = (v) => /@/.test(v);
global.validate_phone = (v) => /^[+\d][\d\s-]*$/.test(v);
global.validate_name = (v) => !!v;
global.locals = {};
global.frappe = {
	provide: (ns) => ns.split(".").reduce((o, k) => (o[k] ||= {}), global),
	ui: { form: {} },
	app: {},
	defaults: { is_enabled: () => false },
	model: {
		plain_text_fieldtypes: ["Data", "Text", "Small Text", "Long Text"],
		no_value_type: ["Section Break", "Column Break", "HTML", "Table", "Button"],
		table_fields: ["Table"],
		get_value: () => undefined,
		can_write: () => true,
	},
	format: (value) => (value == null ? "" : String(value)),
	utils: {
		icon: (name, size) => `<svg class="icon icon-${size}" data-icon="${name}"></svg>`,
		escape_html: (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
		debounce: (fn) => fn,
		copy_to_clipboard: (t) => (frappe.utils.copied = t),
		has_unsafe_url_scheme: () => false,
		get_clipboard_data: () => "",
		get_formatted_iban: (v) => String(v).replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim(),
		split_emails: (v) => String(v).split(/[,\n]/).map((x) => x.trim()).filter(Boolean),
		unscrub: (s) => s,
	},
	require: () => Promise.resolve(),
	unscrub: (s) => s,
	run_serially: (fns) => fns.reduce((p, fn) => p.then(() => fn()), Promise.resolve()),
	is_mobile: () => false,
};

function boot({ App = null } = {}) {
	const Vue = require("vue");
	require("./define.js");
	const app = frappe.ui.create_app(App);
	app.provide("desk", { theme: "light" });
	app.mount($("<div data-fui-root>").appendTo("body")[0]);
	return { Vue, app };
}

module.exports = { boot, dom, sfc, FRAPPE };
