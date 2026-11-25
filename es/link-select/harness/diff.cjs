// Compare two harness runs: node diff.cjs ../results/harness-legacy.json ../results/harness-A.json [--all]
// Classes: behaviour (obs values), api (public surface), structure (legacy markup apps reach into),
// events (jQuery events on $input / form + df handlers), requests (search/validate calls), errors (new
// console errors), timing (informational). Exit 1 if behaviour, api or errors differ.
const fs = require("fs");
const [fa, fb] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ALL = process.argv.includes("--all");
const A = JSON.parse(fs.readFileSync(fa, "utf8"));
const B = JSON.parse(fs.readFileSync(fb, "utf8"));
const norm = (v) => JSON.parse(JSON.stringify(v ?? null).replace(/new-[a-z0-9-]+?-[a-z0-9]{6,}/g, "new-*").replace(/\b[0-9a-z]{10}\b(?=")/g, (m) => (/\d/.test(m) && /[a-z]/.test(m) ? "<hash>" : m)));
function walk(a, b, p, out) {
	if (JSON.stringify(a) === JSON.stringify(b)) return;
	if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
		for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p ? p + "." + k : k, out);
		return;
	}
	out.push([p, a, b]);
}
const cls = (p) => (/(^|\.)structure(\.|$)/.test(p) ? "structure" : /(^|\.)api(\.|$)/.test(p) ? "api" : "behaviour");
const counts = { behaviour: 0, api: 0, structure: 0, events: 0, requests: 0, errors: 0 };
const lines = [];
const timing = [];
const j = (x) => { const s = JSON.stringify(x); return s && s.length > 160 ? s.slice(0, 157) + "..." : s; };
for (const flow of new Set([...Object.keys(A.flows), ...Object.keys(B.flows)])) {
	const fa = A.flows[flow], fb = B.flows[flow];
	if (!fa || !fb) { lines.push(`- **${flow}**: not run in ${fa ? "B" : "A"} (not compared)`); continue; }
	timing.push([flow, fa.ms, fb.ms]);
	if (fa.fatal !== fb.fatal) { lines.push(`- **${flow}** fatal: ${j(fa.fatal)} -> ${j(fb.fatal)}`); counts.behaviour++; }
	const sb = Object.fromEntries(fb.steps.map((s) => [s.name, s]));
	for (const sa of fa.steps) {
		const s2 = sb[sa.name];
		if (!s2) { lines.push(`- ${flow} / ${sa.name}: missing in B`); counts.behaviour++; continue; }
		const out = [];
		walk(norm(sa.obs), norm(s2.obs), "", out);
		for (const [p, x, y] of out) { const c = cls(p); counts[c]++; if (c !== "structure" || ALL) lines.push(`- [${c}] ${flow} / ${sa.name} / \`${p}\`: ${j(x)} -> ${j(y)}`); }
		// events: drop per-keystroke "input", collapse repeats (a variant may fire open once per search, not per key)
		const ev = (es) => es.filter((e) => !/:input$/.test(e)).filter((e, i, a) => e !== a[i - 1]);
		if (JSON.stringify(ev(sa.events)) !== JSON.stringify(ev(s2.events))) { counts.events++; lines.push(`- [events] ${flow} / ${sa.name}: ${j(ev(sa.events))} -> ${j(ev(s2.events))}`); }
		const rq = (rs) => rs.map((r) => [r.method, r.doctype, r.query, r.filters]);
		if (JSON.stringify(rq(sa.requests)) !== JSON.stringify(rq(s2.requests))) { counts.requests++; if (ALL) lines.push(`- [requests] ${flow} / ${sa.name}: ${j(rq(sa.requests))} -> ${j(rq(s2.requests))}`); }
		if ((s2.fallbacks || []).length && !(sa.fallbacks || []).length) lines.push(`- [note] ${flow} / ${sa.name}: input covered, focused instead of clicked: ${j(s2.fallbacks)}`);
		const newerr = s2.errors.filter((e) => !sa.errors.includes(e));
		if (newerr.length) { counts.errors += newerr.length; lines.push(`- [errors] ${flow} / ${sa.name}: ${j(newerr)}`); }
	}
}
console.log(`# ${A.label} vs ${B.label}\n`);
console.log("| class | differences |\n|---|---:|");
for (const [k, v] of Object.entries(counts)) console.log(`| ${k} | ${v} |`);
console.log("\n| flow | A ms | B ms |\n|---|---:|---:|");
for (const [f, a, b] of timing) console.log(`| ${f} | ${a} | ${b} |`);
console.log("\n## Differences" + (ALL ? "" : " (structure and requests counted only; --all lists them)") + "\n");
console.log(lines.join("\n") || "none");
process.exit(counts.behaviour || counts.api || counts.errors ? 1 : 0);
