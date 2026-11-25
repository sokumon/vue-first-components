// speed2/profile/incl_labels.cjs <profile> [catRegex] : inclusive ms per mapped function label (counted once per sample)
const fs = require("fs");
const { resolve } = require("./analyze.cjs");
const [file, catRe = "es-glue|es-runtime"] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(file, "utf8"));
const nodes = new Map(p.nodes.map((n) => [n.id, n])); const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const self = new Map(); for (let i = 0; i < p.samples.length; i++) self.set(p.samples[i], (self.get(p.samples[i]) || 0) + (p.timeDeltas[i] || 0));
const re = new RegExp(catRe); const incl = new Map(); const cache = new Map();
const labs = (id) => { if (cache.has(id)) return cache.get(id); const r = resolve(nodes.get(id).callFrame); let s = parent.has(id) ? labs(parent.get(id)) : new Set(); if (re.test(r.cat)) { s = new Set(s); s.add(r.label); } cache.set(id, s); return s; };
for (const [id, us] of self) { if (nodes.get(id).callFrame.functionName === "(idle)") continue; for (const k of labs(id)) incl.set(k, (incl.get(k) || 0) + us); }
for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.N || 50))) console.log((v / 1000).toFixed(1).padStart(8), k);
