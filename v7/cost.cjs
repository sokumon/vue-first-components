// Controllers without an outlet: cost and lifetime. Run with --expose-gc.
const fs = require("fs");
const src = fs.readFileSync("spike7.cjs", "utf8");
new Function("require", "__filename", "__dirname", src.slice(0, src.indexOf("let pass")))(require, __filename, __dirname);
const Vue = require("vue");
const time = (fn) => { const t = performance.now(); fn(); return Math.round(performance.now() - t); };
(async () => {
	const inject_ok = (() => { const c = new frappe.ui.Counter({ parent: document.createElement("div") }); return c.$setup_state.theme; })();
	console.log("inject from the app context:", inject_ok);
	frappe.app.sidebar = new frappe.ui.Sidebar();
	const dropped = (make) => { const refs = []; for (let i = 0; i < 200; i++) refs.push(new WeakRef(make(i))); return refs; };
	const host = document.createElement("div");
	const badges = dropped((i) => new frappe.ui.Badge({ parent: host, label: String(i) }));
	const row_host = document.createElement("div");
	const rows = dropped((i) => new frappe.ui.sidebar_item.TypeLink({ container: row_host, item: { label: String(i), link_to: "x", type: "Link" } }));
	const destroyed = dropped((i) => { const r = new frappe.ui.sidebar_item.TypeLink({ container: row_host, item: { label: String(i), link_to: "y", type: "Link" } }); r.destroy(); return r; });
	host.innerHTML = ""; row_host.innerHTML = "";
	for (let k = 0; k < 3; k++) { await new Promise((r) => setTimeout(r, 0)); gc(); }
	const alive = (refs) => refs.filter((r) => r.deref()).length;
	console.log(`GC, dropped without destroy(): badges ${alive(badges)}/200, rows reading the sidebar ${alive(rows)}/200 | rows after destroy(): ${alive(destroyed)}/200`);
	for (const n of [100, 300, 1000]) {
		const a = document.createElement("div");
		const made = [];
		const create_ms = time(() => { for (let i = 0; i < n; i++) made.push(new frappe.ui.Badge({ parent: a, label: String(i) })); });
		const update_ms = time(() => { made[0].bump(); made[0].flush(); });
		const destroy_ms = time(() => made.forEach((v) => v.destroy()));
		console.log(`n=${String(n).padEnd(5)} create ${create_ms}ms, one update ${update_ms}ms, destroy all ${destroy_ms}ms, order kept ${a.children.length === 0}`);
	}
	const b = document.createElement("div");
	const order = []; for (let i = 0; i < 5; i++) order.push(new frappe.ui.Badge({ parent: b, label: String(i) }));
	console.log("siblings in one container, in order:", [...b.querySelectorAll(".badge-x")].map((e) => e.textContent).join(","));
	process.exit(0);
})().catch((e) => (console.error(e), process.exit(1)));
