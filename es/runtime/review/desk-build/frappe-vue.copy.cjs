// vue.bundle.js is the only bundle that carries Vue. Every other bundle, of every app,
// imports "vue" and its runtime packages from a shim that reads frappe.vue_modules, and
// assets.json records which bundles do ("<bundle>:requires"), so the loaders bring
// vue.bundle.js first.

const path = require("path");
const fs = require("fs");
const esbuild = require(process.env.HOME + "/fb/frappe-bench/apps/frappe/node_modules/esbuild");

const VUE_BUNDLE = "vue.bundle.js";
const VUE_ENTRY = path.join(process.env.HOME, "fb/frappe-bench/apps/frappe/frappe/public/js", VUE_BUNDLE);
const NAMESPACE = "frappe-vue";
// marks a built file that needs vue.bundle.js, for --using-cached builds that have no metafile
const MARKER = "frappe-vue-shim:" + VUE_BUNDLE;

const SHIMMED = {
	vue: "vue",
	"@vue/runtime-dom": "vue",
	"@vue/runtime-core": "vue",
	"@vue/reactivity": "@vue/reactivity",
	"@vue/shared": "@vue/shared",
	"vue/dist/vue.runtime.esm-bundler.js": "vue",
	"vue/dist/vue.runtime.esm-browser.js": "vue",
	"vue/dist/vue.runtime.esm-browser.prod.js": "vue",
	// the builds with the template compiler get the runtime: see COMPILER_NOTE
	"vue/dist/vue.esm-bundler.js": "vue",
	"vue/dist/vue.esm-browser.js": "vue",
	"vue/dist/vue.esm-browser.prod.js": "vue",
};
const COMPILER_BUILD = /^vue\/dist\/vue\.esm-(bundler|browser)/;
const COMPILER_NOTE =
	`Desk's one Vue (${VUE_BUNDLE}) is the runtime-only build, as Desk's own was: compile` +
	" templates at build time in .vue files instead of with compile() or a template string.";
const FILTER = new RegExp(
	"^(" +
		Object.keys(SHIMMED)
			.map((s) => s.replace(/[./]/g, "\\$&"))
			.join("|") +
		")$"
);
// files only vue.bundle.js reaches: inside them the real packages resolve as usual. Not the
// rest of these packages, such as vue/jsx-runtime, which a bundle imports itself
const VUE_PACKAGE_DIR =
	/[\\/]node_modules[\\/](vue|@vue[\\/](runtime-core|runtime-dom|reactivity|shared))[\\/]dist[\\/]/;

let export_names; // { specifier: [names] }, read once per process

async function get_export_names(specifier) {
	export_names ||= {};
	if (!export_names[specifier]) {
		const result = await esbuild.build({
			stdin: {
				contents: `export * from ${JSON.stringify(specifier)};`,
				resolveDir: path.dirname(VUE_ENTRY),
			},
			nodePaths: [path.join(process.env.HOME, "fb/frappe-bench/apps/frappe/node_modules")],
			bundle: true,
			write: false,
			metafile: true,
			format: "esm",
			logLevel: "silent",
			outfile: "names.js",
			define: { "process.env.NODE_ENV": '"production"' },
		});
		export_names[specifier] = Object.values(result.metafile.outputs)
			.flatMap((output) => output.exports || [])
			.filter((name) => name !== "default");
	}
	return export_names[specifier];
}

function shim_source(specifier, names) {
	const module_key = SHIMMED[specifier];
	const lines = [
		`/*! ${MARKER} */`,
		`const modules = globalThis.frappe && globalThis.frappe.vue_modules;`,
		`const m = modules && modules[${JSON.stringify(module_key)}];`,
		`if (!m) {`,
		`	const script = typeof document !== "undefined" && document.currentScript;`,
		`	throw new Error(`,
		`		"Desk's Vue (frappe.Vue, from ${VUE_BUNDLE}) is not loaded" +`,
		`			(script && script.src ? " before " + script.src : "") +`,
		`			". A bundle that imports " + ${JSON.stringify(JSON.stringify(specifier))} +`,
		`			" must be loaded with frappe.require(), frappe.assets.load_asset() or include_script()," +`,
		`			" which load ${VUE_BUNDLE} first, or after a <script> for ${VUE_BUNDLE}."`,
		`	);`,
		`}`,
	];
	// pure calls, so a bundle keeps only the names it uses
	lines.push(`function pick(name) {`, `	return m[name];`, `}`);
	const exported = [];
	names.forEach((name, i) => {
		lines.push(`const v${i} = /* @__PURE__ */ pick(${JSON.stringify(name)});`);
		exported.push(`v${i} as ${JSON.stringify(name)}`);
	});
	lines.push(`export { ${exported.join(", ")} };`);
	return lines.join("\n");
}

function imports_compile(importer, specifier) {
	let source;
	try {
		source = fs.readFileSync(importer, "utf-8");
	} catch {
		return false;
	}
	const from = specifier.replace(/[./]/g, "\\$&");
	return new RegExp(
		`\\b(import|export)\\s*\\{[^}]*\\bcompile\\b[^}]*\\}\\s*from\\s*["']${from}["']`
	).test(source);
}

function is_vue3(package_json) {
	try {
		const { version } = JSON.parse(fs.readFileSync(package_json, "utf-8"));
		return version.split(".")[0] === "3";
	} catch {
		return true;
	}
}

const plugin = {
	name: "frappe-vue",
	setup(build) {
		const version_by_dir = new Map();

		build.onResolve({ filter: FILTER }, async (args) => {
			if (args.pluginData?.frappe_vue_skip) return;
			if (args.importer === VUE_ENTRY || VUE_PACKAGE_DIR.test(args.importer)) return;

			// an app pinned to another Vue major keeps its own copy
			if (args.path === "vue" && args.resolveDir) {
				if (!version_by_dir.has(args.resolveDir)) {
					const own = await build.resolve("vue", {
						resolveDir: args.resolveDir,
						kind: args.kind,
						pluginData: { frappe_vue_skip: true },
					});
					const pkg = own.errors.length
						? null
						: own.path.replace(/[\\/]dist[\\/].*$|[\\/]index\.m?js$/, "") +
						  "/package.json";
					version_by_dir.set(args.resolveDir, !pkg || is_vue3(pkg));
				}
				if (!version_by_dir.get(args.resolveDir)) return;
			}
			if (COMPILER_BUILD.test(args.path)) {
				const text = `${args.path} resolves to ${VUE_BUNDLE}. ${COMPILER_NOTE}`;
				if (imports_compile(args.importer, args.path)) return { errors: [{ text }] };
				return { path: args.path, namespace: NAMESPACE, warnings: [{ text }] };
			}
			return { path: args.path, namespace: NAMESPACE };
		});

		build.onLoad({ filter: /.*/, namespace: NAMESPACE }, async (args) => {
			let names = await get_export_names(SHIMMED[args.path] === "vue" ? "vue" : args.path);
			// the runtime's compile() only warns at run time: a `* as Vue` import gets no compile
			if (COMPILER_BUILD.test(args.path)) names = names.filter((name) => name !== "compile");
			return { contents: shim_source(args.path, names), loader: "js" };
		});
	},
};

function get_vue_requires(metafile) {
	const requires = {};
	for (const output in metafile.outputs) {
		const info = metafile.outputs[output];
		if (!info.entryPoint || !output.endsWith(".js")) continue;
		const key = path.basename(info.entryPoint);
		if (key === VUE_BUNDLE) continue;
		requires[key] = Object.keys(info.inputs).some((input) =>
			input.startsWith(NAMESPACE + ":")
		);
	}
	return requires;
}

const requires_key = (bundle) => `${bundle}:requires`;

function apply_vue_requires(assets_json, requires) {
	for (const [bundle, needs_vue] of Object.entries(requires)) {
		if (needs_vue) assets_json[requires_key(bundle)] = VUE_BUNDLE;
		else delete assets_json[requires_key(bundle)];
	}
	return assets_json;
}

// --using-cached has no metafile: the shim leaves MARKER in every file built with it
function file_requires_vue(file) {
	return fs.readFileSync(file, "utf-8").includes(MARKER);
}

module.exports = {
	plugin,
	VUE_BUNDLE,
	get_vue_requires,
	apply_vue_requires,
	requires_key,
	file_requires_vue,
};
