// speed2/profile/trace.cjs <label> [dt-slug] : renderer-main-thread time by kind in the first-open traces,
// median over rounds, es vs legacy. Exclusive (self) time per event, so style/layout forced from JS counts
// as style/layout, not script. "forced" = style/layout nested inside a script event.
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "out");
const [label, only] = process.argv.slice(2);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const KIND = (n) =>
	/^(UpdateLayoutTree|RecalculateStyles|ParseAuthorStyleSheet|StyleRecalc|ScheduleStyleRecalculation)$/.test(n) ? "style" :
	/^(Layout|UpdateLayout|LayoutShift|IntersectionObserverController::computeIntersections|ComputeIntersections)$/.test(n) ? "layout" :
	/^(Paint|PrePaint|Layerize|UpdateLayer|UpdateLayerTree|PaintImage|Commit|CompositeLayers|RasterTask|PaintSetup|Decode.*)$/.test(n) ? "paint/composite" :
	/GC|Scavenge|MarkCompact|Sweep|BlinkGC|MinorGC|MajorGC/.test(n) ? "gc" :
	/^(ParseHTML|ParseHTMLOnMainThread|HTMLDocumentParser)/.test(n) ? "parse-html" :
	/^(FunctionCall|EvaluateScript|v8\.|V8\.|RunMicrotasks|TimerFire|FireAnimationFrame|EventDispatch|XHRReadyStateChange|XHRLoad|TimeStamp|ResourceSendRequest|ResourceReceiveResponse|ResourceFinish|ResourceReceivedData|FireIdleCallback|ProfileCall|MutationObserver|HandlePostMessage|CpuProfiler|Profile|JSSample)/.test(n) ? "script" : "other";
function load(f) {
	const raw = JSON.parse(fs.readFileSync(f, "utf8"));
	const ev = raw.traceEvents || raw;
	// renderer main thread with the most FunctionCall events
	const names = new Map();
	for (const e of ev) if (e.ph === "M" && e.name === "thread_name") names.set(e.pid + ":" + e.tid, e.args.name);
	const cnt = new Map();
	for (const e of ev) if (e.name === "FunctionCall" && names.get(e.pid + ":" + e.tid) === "CrRendererMain") cnt.set(e.pid + ":" + e.tid, (cnt.get(e.pid + ":" + e.tid) || 0) + 1);
	const main = [...cnt].sort((a, b) => b[1] - a[1])[0][0];
	// complete events (X) and B/E pairs on main thread
	const xs = [];
	const open = [];
	for (const e of ev) {
		if (e.pid + ":" + e.tid !== main) continue;
		if (e.ph === "X" && e.dur != null) xs.push({ name: e.name, ts: e.ts, end: e.ts + e.dur, args: e.args });
		else if (e.ph === "B") open.push(e);
		else if (e.ph === "E") { const b = open.pop(); if (b) xs.push({ name: b.name, ts: b.ts, end: e.ts, args: b.args }); }
	}
	xs.sort((a, b) => a.ts - b.ts || b.end - a.end);
	// nesting: self time = dur - children
	const stack = [];
	const self = new Map(), forced = new Map(), counts = new Map();
	let t0 = Infinity, t1 = 0;
	const roots = [];
	for (const x of xs) {
		while (stack.length && stack[stack.length - 1].end <= x.ts) stack.pop();
		x.self = x.end - x.ts;
		x.parent = stack[stack.length - 1] || null;
		if (x.parent) x.parent.self -= x.end - x.ts; else roots.push(x);
		x.inScript = !!x.parent && (x.parent.inScript || KIND(x.parent.name) === "script");
		stack.push(x);
		t0 = Math.min(t0, x.ts); t1 = Math.max(t1, x.end);
	}
	let busy = 0;
	for (const r of roots) if (r.name !== "ThreadControllerImpl::RunTask" || true) busy += r.end - r.ts;
	for (const x of xs) {
		const k = KIND(x.name);
		if (x.self < 0) x.self = 0;
		self.set(k, (self.get(k) || 0) + x.self);
		if ((k === "style" || k === "layout") && x.inScript) forced.set(k, (forced.get(k) || 0) + x.self);
		if (k === "style" || k === "layout") counts.set(x.name, (counts.get(x.name) || 0) + 1);
		const nk = "ev:" + x.name;
		self.set(nk, (self.get(nk) || 0) + x.self);
	}
	const elementCount = xs.filter((x) => x.name === "UpdateLayoutTree").reduce((s, x) => s + ((x.args && x.args.elementCount) || 0), 0);
	return { self, forced, counts, elementCount, window: (t1 - t0) / 1000, busy: busy / 1000 };
}
module.exports = { load, KIND };
if (require.main !== module) return;
const dts = new Set(fs.readdirSync(OUT).filter((f) => f.startsWith(label + "-") && f.endsWith(".trace.json")).map((f) => f.slice(label.length + 1).replace(/-(es|legacy)-r\d+-first\.trace\.json$/, "")));
for (const dt of dts) {
	if (only && dt !== only) continue;
	const R = {};
	for (const mode of ["es", "legacy"]) R[mode] = fs.readdirSync(OUT).filter((f) => f.startsWith(`${label}-${dt}-${mode}-r`) && f.endsWith(".trace.json")).map((f) => load(path.join(OUT, f)));
	const keys = new Set();
	for (const m in R) for (const r of R[m]) for (const k of r.self.keys()) keys.add(k);
	const ms = (m, f) => med(R[m].map(f)) / 1000;
	console.log(`\n== ${dt} (n=${R.es.length}/${R.legacy.length})   main-thread busy es ${med(R.es.map((r) => r.busy)).toFixed(0)} legacy ${med(R.legacy.map((r) => r.busy)).toFixed(0)} ms`);
	console.log("       es   legacy     diff");
	const rows = [...keys].map((k) => [k, ms("es", (r) => r.self.get(k) || 0), ms("legacy", (r) => r.self.get(k) || 0)]);
	for (const [k, e, l] of rows.filter((r) => !r[0].startsWith("ev:")).sort((a, b) => b[1] - a[1])) console.log(e.toFixed(1).padStart(9), l.toFixed(1).padStart(8), (e - l).toFixed(1).padStart(8), "  " + k);
	for (const k of ["style", "layout"]) console.log(ms("es", (r) => r.forced.get(k) || 0).toFixed(1).padStart(9), ms("legacy", (r) => r.forced.get(k) || 0).toFixed(1).padStart(8), "         forced " + k + " (inside script)");
	for (const n of ["UpdateLayoutTree", "Layout"]) console.log(String(med(R.es.map((r) => r.counts.get(n) || 0))).padStart(9), String(med(R.legacy.map((r) => r.counts.get(n) || 0))).padStart(8), "         count " + n);
	console.log(String(med(R.es.map((r) => r.elementCount))).padStart(9), String(med(R.legacy.map((r) => r.elementCount))).padStart(8), "         elements restyled (sum)");
	console.log("  top events by |diff|:");
	for (const [k, e, l] of rows.filter((r) => r[0].startsWith("ev:")).sort((a, b) => Math.abs(b[1] - b[2]) - Math.abs(a[1] - a[2])).slice(0, 14)) console.log(e.toFixed(1).padStart(9), l.toFixed(1).padStart(8), (e - l).toFixed(1).padStart(8), "  " + k);
}
