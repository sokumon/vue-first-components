// Vue's DOM renderer, made to share its nodes with jQuery: a node keeps the parent Vue gave it,
// and Vue adds and removes only the classes it set.
const { createRenderer, nodeOps, patchProp } = require("vue");

const vue_parent = Symbol("vue_parent");
const vue_classes = Symbol("vue_classes");

const desk_renderer = createRenderer({
	...nodeOps,
	insert(child, parent, anchor) {
		child[vue_parent] = parent;
		nodeOps.insert(child, parent, anchor?.parentNode === parent ? anchor : null);
	},
	parentNode(node) {
		return node.parentNode || node[vue_parent] || null;
	},
	patchProp(el, key, prev, next, namespace, parentComponent) {
		if (key === "class") return patch_class(el, next);
		patchProp(el, key, prev, next, namespace, parentComponent);
	},
});

function patch_class(el, value) {
	const next = new Set(String(value ?? "").split(/\s+/).filter(Boolean));
	for (const name of el[vue_classes] || []) if (!next.has(name)) el.classList.remove(name);
	for (const name of next) el.classList.add(name);
	el[vue_classes] = next;
}

module.exports = desk_renderer;
