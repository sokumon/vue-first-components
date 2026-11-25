// speed2/profile/callers.cjs <labelRegex> <profile> [depth=4] : self time of matching frames grouped by caller chain
const fs = require("fs");
const { resolve } = require("./analyze.cjs");
const [re, file, depth = 4] = process.argv.slice(2); const R = new RegExp(re);
const p = JSON.parse(fs.readFileSync(file, "utf8"));
const nodes = new Map(p.nodes.map((n) => [n.id, n])); const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const self = new Map(); for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) || 0) + (p.timeDeltas[i] || 0));
const by = new Map();
for (const [id, us] of self) {
	const r = resolve(nodes.get(id).callFrame);
	if (!R.test(r.label)) continue;
	const chain = []; let x = parent.get(id);
	while (x != null && chain.length < +depth) { const q = resolve(nodes.get(x).callFrame); chain.push((q.label || "").split("  |")[0]); x = parent.get(x); }
	const k = chain.join(" < "); by.set(k, (by.get(k) || 0) + us);
}
for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log((v / 1000).toFixed(1).padStart(8), k);
