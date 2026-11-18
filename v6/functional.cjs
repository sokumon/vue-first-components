// Functional components against controllers. Run with --expose-gc.
const fs = require("fs");
const src = fs.readFileSync("spike5_real.cjs", "utf8");
new Function("require", "__filename", "__dirname", src.slice(0, src.indexOf("let pass")))(require, __filename, __dirname);
const Vue = require("vue");
const { h, render, reactive, nextTick, getCurrentInstance } = Vue;
const renderer = require("./renderer.js");
const ok = (name, pass) => console.log(`${pass ? "ok  " : "FAIL"} ${name}`);

// a template-only .vue, turned into a functional component by one wrapper
const leaf_options = require("./BadgeLeaf.vue");
const functional_from = ({ render: template }) => (props) => {
	const instance = getCurrentInstance();
	return template(props, instance.renderCache, props, {}, {}, {});
};
const BadgeLeaf = functional_from(leaf_options);

function draw(component, props) {
	const box = document.createElement("div");
	const vnode = h(component, props);
	vnode.appContext = frappe.ui.app._context;
	renderer.render(vnode, box);
	return box;
}

(async () => {
	// --- does a functional component have its own update?
	let parent_renders = 0, child_renders = 0;
	const state = reactive({ label: "a", other: 0 });
	const Child = (props) => (child_renders++, h("i", state.label));
	const box = document.createElement("div");
	renderer.render(h({ render() { parent_renders++; return h("div", [h(Child), String(state.other)]); } }), box);
	state.label = "b";
	await nextTick();
	ok("a functional child re-renders alone when what it read changes", box.querySelector("i").textContent === "b" && child_renders === 2 && parent_renders === 1);
	let instance_seen = null;
	renderer.render(h((() => { instance_seen = getCurrentInstance(); return h("b"); })), document.createElement("div"));
	ok("it still gets a component instance from Vue", !!instance_seen && typeof instance_seen.update === "function");
	ok("...but no setup state, no proxy", instance_seen.proxy === null);

	// --- a template-only .vue as a functional leaf
	let picked = null;
	const leaf = $(draw(BadgeLeaf, { label: "Draft", variant: "red", onPick: (l) => (picked = l) })).children().first();
	ok("template-only .vue draws through a functional wrapper, synchronously", leaf.is(".leaf-badge[data-variant=red]") && leaf.text() === "Draft");
	leaf.addClass("mine").appendTo("body");
	ok("the node can be moved out and poked", leaf.parent().is("body") && leaf.hasClass("mine"));
	leaf.trigger("click");
	ok("its handler still runs after the move, through .trigger", picked === "Draft");
	ok("the same source gives the .html() string form", draw(BadgeLeaf, { label: "x", variant: "y" }).innerHTML === '<span class="leaf-badge" data-variant="y">x</span>');
	ok("nothing joined the outlet", ![...frappe.ui.views].some((v) => v.label === "Draft"));

	// --- lifetime
	if (global.gc) {
		const dropped = (make) => { const refs = []; for (let i = 0; i < 200; i++) refs.push(new WeakRef(make(i))); return refs; };
		const leaves = dropped((i) => draw(BadgeLeaf, { label: String(i) }).firstChild);
		const stateful_leaves = dropped((i) => draw(leaf_options, { label: String(i) }).firstChild);
		const host = document.createElement("div");
		const controllers = dropped((i) => new frappe.ui.Badge({ parent: host, label: String(i) }));
		await new Promise((r) => setTimeout(r, 0)); gc(); await new Promise((r) => setTimeout(r, 0)); gc();
		console.log(`GC: functional leaves still alive ${leaves.filter((r) => r.deref()).length}/200, stateful leaves still alive ${stateful_leaves.filter((r) => r.deref()).length}/200, controllers still alive ${controllers.filter((r) => r.deref()).length}/200`);
		[...frappe.ui.views].forEach((v) => v.label !== undefined && v.destroy());
	} else console.log("GC: run with --expose-gc");

	// --- cost, jsdom only: compare, don't read as browser numbers
	const time = (fn) => { const t = performance.now(); fn(); return Math.round(performance.now() - t); };
	for (const n of [100, 300, 1000]) {
		const a = document.createElement("div");
		const controller_ms = time(() => { for (let i = 0; i < n; i++) new frappe.ui.Badge({ parent: a, label: String(i) }); });
		const made = [...frappe.ui.views].filter((v) => v.label !== undefined);
		const one = made[0];
		const update_ms = time(() => { one.bump(); one.flush(); });
		const destroy_ms = time(() => made.forEach((v) => v.destroy()));
		const b = document.createElement("div");
		const rows = Array.from({ length: n }, (_, i) => ({ label: String(i) }));
		const fn_ms = time(() => renderer.render(h({ render: () => h("ul", rows.map((r) => h(BadgeLeaf, { key: r.label, label: r.label }))) }), b));
		const b2 = document.createElement("div");
		const stateful_ms = time(() => renderer.render(h({ render: () => h("ul", rows.map((r) => h(leaf_options, { key: r.label, label: r.label }))) }), b2));
		const d = document.createElement("div");
		const stateful_detached_ms = time(() => { for (let i = 0; i < n; i++) d.appendChild(draw(leaf_options, { label: String(i) }).firstChild); });
		const c = document.createElement("div");
		const detached_ms = time(() => { for (let i = 0; i < n; i++) c.appendChild(draw(BadgeLeaf, { label: String(i) }).firstChild); });
		console.log(`n=${String(n).padEnd(5)} controllers via outlet ${controller_ms}ms (one update ${update_ms}ms, destroy all ${destroy_ms}ms) | in one parent: functional ${fn_ms}ms, stateful ${stateful_ms}ms | detached: functional ${detached_ms}ms, stateful ${stateful_detached_ms}ms`);
	}
	process.exit(0);
})().catch((e) => (console.error(e), process.exit(1)));
