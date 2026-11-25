// speed2/profile/formattr.cjs <label> [first|reopen] : per form, median (over rounds) of the es-specific
// inclusive buckets and self-time categories in the CPU profiles written by forms.cjs PROF=1.
const fs = require("fs"), path = require("path");
const { analyze } = require("./analyze.cjs");
const [label, kind = "first"] = process.argv.slice(2);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const L = (name, re) => ({ name, test: (r) => re.test(r.label || "") });
const C = (name, f) => ({ name, test: f });
const KEYS = [
	L("A  rAF visibility check (whole callback)", /es_link\.bundle\.js:566 /),
	L("A1   its getClientRects filter (forced style+layout)", /es_link\.bundle\.js:568 /),
	L("B  Link es_mount (all: rAF, forced, focus, IO)", /es_link\.bundle\.js:615 /),
	L("B1   eager Link make_input (inside es_mount)", /es_link\.bundle\.js:207 /),
	L("C  Select.make_input (glue, incl. legacy part)", /es_link\.bundle\.js:449 /),
	L("D  Link lazy make_input (stand-in)", /es_link\.bundle\.js:576 /),
	L("E  Link set_formatted_input wrapper", /es_link\.bundle\.js:639 /),
	L("F  Select set_formatted_input wrapper", /es_link\.bundle\.js:501 /),
	L("G  glue sync_select", /es_link\.bundle\.js:431 /),
	L("H  rt syncUpdate", /runtime\.js:294 /),
	L("H1   rt addTop (first mount of a host)", /runtime\.js:506 /),
	L("H2   rt flushDirty (re-render of dirty hosts)", /runtime\.js:309 /),
	L("H3   rt processRecords (MutationObserver)", /runtime\.js:276 /),
	L("H4   rt dirty microtask", /runtime\.js:801 /),
	L("I  vue flushJobs (Vue's own scheduler, async re-renders)", /flushJobs @/),
	L("I1  vue flushPreFlushCbs (queue scan)", /flushPreFlushCbs @/),
	L("J  vue render() incl. spare post-flush", /^render @ .*runtime-core/),
	C("K  any vue-core/reactivity frame", (r) => r.cat === "vue-core" || r.cat === "vue-reactivity"),
	C("K1 any reka-ui frame", (r) => r.cat === "reka-ui"),
	C("K2 any frappe-ui frame", (r) => r.cat === "frappe-ui"),
	C("K3 any es-runtime frame", (r) => r.cat === "es-runtime"),
	C("K4 any es-glue frame", (r) => r.cat === "es-glue"),
	L("L  jQuery css read (curCSS)", /curCSS @/),
	L("M  frappe.ui.form.Layout / make_control", /make_control @/),
];
const OUT = path.join(__dirname, "out");
const dts = [...new Set(fs.readdirSync(OUT).filter((f) => f.startsWith(label + "-") && f.endsWith(`-${kind}.cpuprofile`)).map((f) => f.slice(label.length + 1).replace(/-(es|legacy)-r\d+-\w+\.cpuprofile$/, "")))];
for (const dt of dts) {
	const R = {};
	for (const mode of ["es", "legacy"]) R[mode] = fs.readdirSync(OUT).filter((f) => f.startsWith(`${label}-${dt}-${mode}-r`) && f.endsWith(`-${kind}.cpuprofile`)).map((f) => analyze(path.join(OUT, f), { incl: KEYS, top: 5 }));
	const g = (m, sel, k) => med(R[m].map((a) => (a[sel].find((x) => x[0] === k) || [0, 0])[1]));
	console.log(`\n== ${dt} ${kind} (n=${R.es.length}/${R.legacy.length}) CPU total es ${med(R.es.map((a) => a.total_ms))} legacy ${med(R.legacy.map((a) => a.total_ms))}`);
	console.log("      es  legacy   (inclusive ms)");
	for (const k of KEYS) { const e = g("es", "incl", k.name), l = g("legacy", "incl", k.name); if (e || l) console.log(e.toFixed(1).padStart(8), l.toFixed(1).padStart(7), " ", k.name); }
	console.log("      es  legacy   diff (self by category, natives folded into caller)");
	const cats = new Set(); for (const m in R) for (const a of R[m]) for (const [k] of a.folded_cat) cats.add(k);
	for (const k of [...cats].sort((a, b) => (g("es", "folded_cat", b) - g("legacy", "folded_cat", b)) - (g("es", "folded_cat", a) - g("legacy", "folded_cat", a)))) {
		const e = g("es", "folded_cat", k), l = g("legacy", "folded_cat", k);
		console.log(e.toFixed(1).padStart(8), l.toFixed(1).padStart(7), (e - l).toFixed(1).padStart(7), " ", k);
	}
}
