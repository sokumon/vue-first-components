// speed2/profile/cmp.cjs <label> <dt-slug> <first|reopen> : median over rounds of each category / inclusive key, es vs legacy
const fs = require("fs"), path = require("path");
const { analyze } = require("./analyze.cjs");
const [label, dt, kind] = process.argv.slice(2);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const files = (mode) => fs.readdirSync(path.join(__dirname, "out")).filter((f) => f.startsWith(`${label}-${dt}-${mode}-r`) && f.endsWith(`-${kind}.cpuprofile`)).map((f) => path.join(__dirname, "out", f));
const A = { es: files("es").map((f) => analyze(f)), legacy: files("legacy").map((f) => analyze(f)) };
const table = (sel) => {
	const keys = new Set();
	for (const m in A) for (const a of A[m]) for (const [k] of a[sel]) keys.add(k);
	const rows = [...keys].map((k) => {
		const v = (m) => med(A[m].map((a) => (a[sel].find((x) => x[0] === k) || [0, 0])[1]));
		return [k, v("es"), v("legacy")];
	}).filter((r) => r[1] >= 0.5 || r[2] >= 0.5).sort((a, b) => Math.abs(b[1] - b[2]) - Math.abs(a[1] - a[2]));
	for (const [k, e, l] of rows.slice(0, +(process.env.N || 30))) console.log(String(e.toFixed(1)).padStart(8), String(l.toFixed(1)).padStart(8), String((e - l).toFixed(1)).padStart(8), " ", k);
};
console.log(`== ${label} ${dt} ${kind}: n=${A.es.length}/${A.legacy.length}  total es ${med(A.es.map((a) => a.total_ms))} legacy ${med(A.legacy.map((a) => a.total_ms))}`);
console.log("     es   legacy    diff   -- folded category"); table("folded_cat");
console.log("     es   legacy    diff   -- inclusive"); table("incl");
console.log("     es   legacy    diff   -- top functions"); table("top_fn");
console.log("     es   legacy    diff   -- natives"); table("top_native");
