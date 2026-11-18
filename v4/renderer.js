// Vue's DOM renderer, made to share its nodes with jQuery: a node keeps the parent Vue gave it,
// Vue adds and removes only the classes it set, and its listeners are jQuery's, so .trigger and .off reach them.
const { createRenderer, nodeOps, patchProp } = require("vue");

const vue_parent = Symbol("vue_parent");
const vue_classes = Symbol("vue_classes");
const vue_listeners = Symbol("vue_listeners");
const NATIVE_ONLY = /(Once|Passive|Capture)$/;

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
		if (/^on[A-Z]/.test(key) && !NATIVE_ONLY.test(key)) return patch_listener(el, key, next);
		patchProp(el, key, prev, next, namespace, parentComponent);
	},
});

function patch_class(el, value) {
	const next = new Set(String(value ?? "").split(/\s+/).filter(Boolean));
	for (const name of el[vue_classes] || []) if (!next.has(name)) el.classList.remove(name);
	for (const name of next) el.classList.add(name);
	el[vue_classes] = next;
}

function patch_listener(el, key, handler) {
	const listeners = (el[vue_listeners] ||= {});
	const type = key.slice(2).replace(/\B([A-Z])/g, "-$1").toLowerCase();
	if (!listeners[key] && handler) {
		listeners[key] = { handler };
		$(el).on(`${type}.vue`, (event) => listeners[key].handler(event.originalEvent || event));
	} else if (listeners[key] && handler) {
		listeners[key].handler = handler;
	} else if (listeners[key]) {
		$(el).off(`${type}.vue`);
		delete listeners[key];
	}
}

module.exports = desk_renderer;
