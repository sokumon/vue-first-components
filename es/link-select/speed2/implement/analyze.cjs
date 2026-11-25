// speed2/profile/analyze.cjs <a.cpuprofile> [more...] : source-mapped breakdown of a CPU profile.
// Maps every frame through the bench's dist/*.js.map; frames in es_link's copy of es-link.js are mapped
// once more through smbuild/es-link.js.map (a Vite --sourcemap build whose code is byte-identical to
// B-es-tags/build/dist/es-link.js), so they resolve to runtime.js / frappe-ui / reka-ui sources.
// Prints: self time per category (native frames folded into their JS caller), top mapped functions by
// self time, and inclusive time of the runtime/glue functions of interest.
// env JSON=1 prints one JSON object per profile instead.
const fs = require("fs");
const path = require("path");
const { SourceMapConsumer } = require("/home/claude/vue-first-components/wc/node_modules/source-map-js");
const DIST = path.join(process.env.HOME, "fb/frappe-bench/sites/assets/frappe/dist/js");
const SM = new SourceMapConsumer(JSON.parse(fs.readFileSync(path.join(__dirname, "smbuild/es-link.js.map"), "utf8")));
const maps = new Map();
function mapOf(url) {
	const f = url.split("/").pop().split("?")[0];
	if (!maps.has(f)) {
		let m = null;
		try { m = new SourceMapConsumer(JSON.parse(fs.readFileSync(path.join(DIST, f + ".map"), "utf8"))); } catch {}
		maps.set(f, m);
	}
	return maps.get(f);
}
const lineCache = new Map();
function srcLine(cons, source, line) {
	const k = source + ":" + line;
	if (!lineCache.has(k)) {
		let t = "";
		try { t = (cons.sourceContentFor(source, true) || "").split("\n")[line - 1] || ""; } catch {}
		lineCache.set(k, t.trim().slice(0, 70));
	}
	return lineCache.get(k);
}
const memo = new Map();
function resolve(cf) {
	const key = cf.url + ":" + cf.lineNumber + ":" + cf.columnNumber + ":" + cf.functionName;
	if (memo.has(key)) return memo.get(key);
	let r;
	if (!cf.url) r = { cat: "native", src: "", label: cf.functionName || "(anon native)" };
	else {
		const m = /assets\/frappe\/dist\/js\//.test(cf.url) ? mapOf(cf.url) : null;
		let p = m && m.originalPositionFor({ line: cf.lineNumber + 1, column: cf.columnNumber });
		let cons = m;
		if (p && p.source && p.source.endsWith("es_link/es-link.js")) {
			const q = SM.originalPositionFor({ line: p.line, column: p.column });
			if (q && q.source) { p = q; cons = SM; }
		}
		if (p && p.source) {
			const s = p.source.replace(/^.*node_modules\//, "").replace(/^(\.\.\/)+/, "").replace(/^apps\/frappe\/frappe\/public\/js\//, "desk:");
			const name = p.name || cf.functionName || "";
			r = { cat: category(s), src: s, label: `${name || "(anon)"} @ ${s.split("/").slice(-2).join("/")}:${p.line}  | ${srcLine(cons, p.source, p.line)}` , name, file: s };
		} else r = { cat: cf.url.includes("/assets/") ? "desk-unmapped" : "other-url", src: cf.url, label: `${cf.functionName || "(anon)"} @ ${cf.url.split("/").pop()}:${cf.lineNumber + 1}` };
	}
	memo.set(key, r);
	return r;
}
function category(s) {
	if (/src\/runtime\.js$|src\/entry\.js$/.test(s)) return "es-runtime";
	if (/^frappe-ui\//.test(s)) return "frappe-ui";
	if (/^reka-ui\//.test(s)) return "reka-ui";
	if (/^@floating-ui\//.test(s)) return "floating-ui";
	if (/^@vueuse\//.test(s)) return "vueuse";
	if (/^@vue\/reactivity/.test(s)) return "vue-reactivity";
	if (/^@vue\/|^vue\//.test(s) || s === "frappe-vue:vue") return "vue-core";
	if (/es_link\.bundle\.js$/.test(s)) return "es-glue";
	if (/jquery/i.test(s)) return "jquery";
	if (/^desk:/.test(s)) return "desk";
	return "other-js";
}

function analyze(file, opts = {}) {
	const p = JSON.parse(fs.readFileSync(file, "utf8"));
	const nodes = new Map(p.nodes.map((n) => [n.id, n]));
	const parent = new Map();
	for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
	const self = new Map();
	for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) || 0) + (p.timeDeltas[i] || 0));
	const special = (n) => /^\((idle|program|garbage collector|root)\)$/.test(n.callFrame.functionName) ? n.callFrame.functionName : null;
	// nearest JS ancestor's category for native frames
	const jsCat = new Map();
	const catOf = (id) => {
		if (jsCat.has(id)) return jsCat.get(id);
		const n = nodes.get(id);
		const r = resolve(n.callFrame);
		let c;
		if (special(n)) c = special(n);
		else if (r.cat !== "native") c = r.cat;
		else c = parent.has(id) ? catOf(parent.get(id)) : "native";
		if (c === "(root)") c = "native-top";
		jsCat.set(id, c);
		return c;
	};
	const total = { all: 0 };
	const bySelfCat = new Map(), byFolded = new Map(), byFn = new Map(), byNative = new Map();
	for (const [id, us] of self) {
		const n = nodes.get(id);
		const sp = special(n);
		if (sp === "(idle)") continue;
		total.all += us;
		const r = resolve(n.callFrame);
		const sc = sp || r.cat;
		bySelfCat.set(sc, (bySelfCat.get(sc) || 0) + us);
		const fc = sp || catOf(id);
		byFolded.set(fc, (byFolded.get(fc) || 0) + us);
		const lab = sp || r.label;
		byFn.set(lab, (byFn.get(lab) || 0) + us);
		if (r.cat === "native" && !sp) { const k = `${r.label} <- ${fc}`; byNative.set(k, (byNative.get(k) || 0) + us); }
	}
	// inclusive: per sample, the set of labels on its stack
	const want = opts.incl || DEFAULT_INCL;
	const incl = new Map();
	const stackLabels = new Map();
	const labelsOf = (id) => {
		if (stackLabels.has(id)) return stackLabels.get(id);
		const n = nodes.get(id);
		const r = resolve(n.callFrame);
		const up = parent.has(id) ? labelsOf(parent.get(id)) : new Set();
		const k = want.find((w) => w.test(r));
		let s = up;
		if (k && !up.has(k.name)) { s = new Set(up); s.add(k.name); }
		stackLabels.set(id, s);
		return s;
	};
	// inclusive by category too (time with any frame of that category on the stack)
	for (const [id, us] of self) {
		if (special(nodes.get(id)) === "(idle)") continue;
		for (const k of labelsOf(id)) incl.set(k, (incl.get(k) || 0) + us);
	}
	const ms = (m, n = 40) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +(v / 1000).toFixed(1)]);
	return { file: path.basename(file), total_ms: +(total.all / 1000).toFixed(1), self_cat: ms(bySelfCat), folded_cat: ms(byFolded), incl: ms(incl, 60), top_fn: ms(byFn, opts.top || 35), top_native: ms(byNative, 15) };
}
const I = (name, fn) => ({ name, test: fn });
const nm = (re, file) => (r) => !!r.name && re.test(r.name) && (!file || (r.file || "").match(file));
const DEFAULT_INCL = [
	// glue (es_link.bundle.js)
	I("glue Link.make_input (eager, mounts Combobox)", (r) => r.cat === "es-glue" && /make_input/.test(r.label) && /es-combobox|const host = document.createElement\("es-combobox"\)|^Link\.prototype\.make_input = function \(\) \{$/.test(r.label) && false),
	I("glue es_mount", nm(/es_mount/, /es_link/)),
	I("glue insert_host", nm(/^insert_host$/, /es_link/)),
	I("glue sync_select", nm(/^sync_select$/, /es_link/)),
	I("glue select_options", nm(/^select_options$/, /es_link/)),
	I("glue to_options", nm(/^to_options$/, /es_link/)),
	I("glue es_setup_combobox", nm(/es_setup_combobox/, /es_link/)),
	I("glue rAF visibility check (queue_check cb)", (r) => r.cat === "es-glue" && /requestAnimationFrame\(\(\) => \{|const shown = /.test(r.label)),
	I("glue lazy getters (LAZY_KEYS)", (r) => r.cat === "es-glue" && /get\(\) \{|getter/.test(r.label) && false),
	// runtime.js
	I("rt ensureApp", nm(/^ensureApp$/, /runtime/)),
	I("rt ES.mount", (r) => r.cat === "es-runtime" && /mount\(el\)/.test(r.label)),
	I("rt ES.flush", (r) => r.cat === "es-runtime" && /flush\(\) \{ drain\(\); flushDirty/.test(r.label)),
	I("rt addTop", nm(/^addTop$/, /runtime/)),
	I("rt syncUpdate", nm(/^syncUpdate$/, /runtime/)),
	I("rt flushDirty", nm(/^flushDirty$/, /runtime/)),
	I("rt processRecords (MO)", nm(/^processRecords$/, /runtime/)),
	I("rt drain", nm(/^drain$/, /runtime/)),
	I("rt entryOf", nm(/^entryOf$/, /runtime/)),
	I("rt takeSlots", nm(/^takeSlots$/, /runtime/)),
	I("rt teleportFor", nm(/^teleportFor$/, /runtime/)),
	I("rt onConnect", nm(/^onConnect$/, /runtime/)),
	I("rt onChildList", nm(/^onChildList$/, /runtime/)),
	I("rt exposeOnHost", nm(/^exposeOnHost$/, /runtime/)),
	I("rt scanNested", nm(/^scanNested$/, /runtime/)),
	I("rt applyScope/announce (template stamping)", nm(/^(applyScope|announce)$/, /runtime/)),
	I("rt vPlace hooks", (r) => r.cat === "es-runtime" && /beforeMount\(el|beforeUpdate\(el|beforeUnmount\(el/.test(r.label)),
	I("rt unionRect/getBoundingClientRect", nm(/^(unionRect|getBoundingClientRect|getClientRects)$/, /runtime/)),
	I("rt boxOf (IO/RO redirect)", nm(/^boxOf$/, /runtime/)),
	I("rt dirty.add microtask", (r) => r.cat === "es-runtime" && /queueMicrotask\(\(\) => \{ soon = false/.test(r.label)),
	I("rt prop setter", (r) => r.cat === "es-runtime" && /set\(v\) \{/.test(r.label)),
	// vue
	I("vue render() (spare post-flush)", (r) => r.cat === "vue-core" && /^render$/.test(r.name || "") ),
	I("vue flushPostFlushCbs", nm(/^flushPostFlushCbs$/)),
	I("vue setupComponent", nm(/^setupComponent$/)),
	I("vue mountComponent", nm(/^mountComponent$/)),
	I("vue TeleportImpl.process", (r) => r.cat === "vue-core" && /process\(n1, n2, container/.test(r.label)),
	I("vue patch", nm(/^patch$/)),
	I("vue renderComponentRoot", nm(/^renderComponentRoot$/)),
	I("vue (any) ", (r) => r.cat === "vue-core" || r.cat === "vue-reactivity"),
	I("frappe-ui (any)", (r) => r.cat === "frappe-ui"),
	I("reka-ui (any)", (r) => r.cat === "reka-ui"),
	I("es-runtime (any)", (r) => r.cat === "es-runtime"),
	I("es-glue (any)", (r) => r.cat === "es-glue"),
	I("frappe-ui Combobox.vue", (r) => /Combobox\/Combobox\.vue/.test(r.src)),
	I("frappe-ui Select.vue", (r) => /Select\/Select\.vue/.test(r.src)),
	I("reka Select*", (r) => /reka-ui\/.*\/Select\//.test(r.src)),
	I("reka Combobox*", (r) => /reka-ui\/.*\/Combobox\//.test(r.src)),
	I("reka Listbox*", (r) => /reka-ui\/.*\/Listbox\//.test(r.src)),
	I("reka Popper*", (r) => /reka-ui\/.*\/Popper\//.test(r.src)),
	I("reka Collection*", (r) => /reka-ui\/.*\/Collection\//.test(r.src)),
	I("desk ControlLink/Select legacy code", (r) => /form\/controls\/(link|select)\.js/.test(r.src)),
	I("desk make_control", nm(/^make_control$/)),
];
module.exports = { analyze, resolve };
if (require.main === module) {
	for (const f of process.argv.slice(2)) {
		const a = analyze(f);
		if (process.env.JSON) { console.log(JSON.stringify(a)); continue; }
		console.log(`\n=== ${a.file}  total (non-idle) ${a.total_ms} ms`);
		console.log("-- self by category (natives folded into JS caller):");
		for (const [k, v] of a.folded_cat) console.log(String(v).padStart(8), k);
		console.log("-- self by category (natives separate):", a.self_cat.map(([k, v]) => `${k} ${v}`).join(", "));
		console.log("-- inclusive:");
		for (const [k, v] of a.incl) console.log(String(v).padStart(8), k);
		console.log("-- top self functions:");
		for (const [k, v] of a.top_fn) console.log(String(v).padStart(8), k);
		console.log("-- top natives:");
		for (const [k, v] of a.top_native) console.log(String(v).padStart(8), k);
	}
}
