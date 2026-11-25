// speed2/profile/under.cjs <labelRegex> <profile> : self time of matching frames split by which known driver is on the stack
const fs = require("fs");
const { resolve } = require("./analyze.cjs");
const [re, file] = process.argv.slice(2); const R = new RegExp(re);
const p = JSON.parse(fs.readFileSync(file, "utf8"));
const nodes = new Map(p.nodes.map((n) => [n.id, n])); const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const self = new Map(); for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) || 0) + (p.timeDeltas[i] || 0));
const D = [["flushJobs (Vue scheduler)", /flushJobs @/], ["syncUpdate (es runtime)", /runtime\.js:294 /], ["render() (Vue)", /^render @/]];
const by = new Map();
for (const [id, us] of self) {
	if (!R.test(resolve(nodes.get(id).callFrame).label)) continue;
	let k = "other"; for (let x = parent.get(id); x != null; x = parent.get(x)) { const l = resolve(nodes.get(x).callFrame).label || ""; const d = D.find(([, r]) => r.test(l)); if (d) { k = d[0]; break; } }
	by.set(k, (by.get(k) || 0) + us);
}
for (const [k, v] of by) console.log((v / 1000).toFixed(1).padStart(8), k);
