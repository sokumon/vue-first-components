// speed2/profile/sub.cjs <labelRegex> <profiles...> : self time inside the subtree(s) of frames whose mapped
// label matches, by category and by top function (sum over the given profiles / count).
const fs = require("fs");
const { resolve } = require("./analyze.cjs");
const [re, ...files] = process.argv.slice(2); const R = new RegExp(re);
const byCat = new Map(), byFn = new Map(); let tot = 0;
for (const f of files) {
	const p = JSON.parse(fs.readFileSync(f, "utf8"));
	const nodes = new Map(p.nodes.map((n) => [n.id, n])); const parent = new Map();
	for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
	const self = new Map(); for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) || 0) + (p.timeDeltas[i] || 0));
	const inSub = new Map();
	const isIn = (id) => { if (inSub.has(id)) return inSub.get(id); const r = resolve(nodes.get(id).callFrame); const v = R.test(r.label) || (parent.has(id) && isIn(parent.get(id))); inSub.set(id, v); return v; };
	const jsCat = (id) => { const r = resolve(nodes.get(id).callFrame); return r.cat !== "native" ? r.cat : parent.has(id) ? jsCat(parent.get(id)) : "native"; };
	for (const [id, us] of self) if (isIn(id)) {
		const r = resolve(nodes.get(id).callFrame); tot += us;
		const c = jsCat(id); byCat.set(c, (byCat.get(c) || 0) + us);
		const k = r.cat === "native" ? `${r.label} <- ${c}` : r.label; byFn.set(k, (byFn.get(k) || 0) + us);
	}
}
const n = files.length;
console.log(`subtree /${re}/ total ${(tot / 1000 / n).toFixed(1)} ms per profile`);
for (const [k, v] of [...byCat].sort((a, b) => b[1] - a[1])) console.log((v / 1000 / n).toFixed(1).padStart(8), k);
for (const [k, v] of [...byFn].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.N || 25))) console.log((v / 1000 / n).toFixed(1).padStart(8), k);
