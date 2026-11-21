// Vue's DOM renderer, made to share its nodes with jQuery: a node keeps the parent Vue gave it,
// Vue adds and removes only the classes it set, a field's value is written only when the bound value
// changes, and its listeners are jQuery's, so .trigger and .off reach them.
// A controller renders into a mount_point(): its top-level nodes go wherever target() says when they are
// first inserted, which is after the view's setup has run. Later patches find them by their real parent.
const { createRenderer, nodeOps, patchProp } = require("vue");

const vue_parent = Symbol("vue_parent");
const vue_classes = Symbol("vue_classes");
const vue_listeners = Symbol("vue_listeners");
const NATIVE_ONLY = /(Once|Passive|Capture)$/;
const is_mount_point = Symbol("frappe.ui mount point");

function mount_point(target) {
	return { [is_mount_point]: true, target };
}

// Nodes jQuery is cleaning right now: it removes or replaces them itself, after cleanData returns.
let left_to_jquery = null;

const desk_renderer = createRenderer({
	...nodeOps,
	remove(child) {
		if (!left_to_jquery?.has(child)) nodeOps.remove(child);
	},
	insert(child, parent, anchor) {
		if (parent[is_mount_point]) parent = parent.target();
		child[vue_parent] = parent;
		nodeOps.insert(child, parent, anchor?.parentNode === parent ? anchor : null);
	},
	parentNode(node) {
		return node.parentNode || node[vue_parent] || null;
	},
	patchProp(el, key, prev, next, namespace, parentComponent) {
		if (key === "class") return patch_class(el, next);
		// Vue re-applies `value` on every render, even when it hasn't changed, and so would throw away
		// what legacy code (or the user) put in the field with .val() since. Only a changed value is written.
		if (key === "value" && prev === next && "_value" in el) return;
		if (/^on[A-Z]/.test(key) && !NATIVE_ONLY.test(key)) return patch_listener(el, key, next);
		patchProp(el, key, prev, next, namespace, parentComponent);
	},
});

function patch_class(el, value) {
	const text = String(value ?? "");
	const prev = el[vue_classes];
	// a fresh element: nobody else has touched its classes yet, so one write does it
	if (prev === undefined && !el.className) {
		el.className = text;
		el[vue_classes] = text;
		return;
	}
	if (prev === text) return;
	const next = new Set(text.split(/\s+/).filter(Boolean));
	const before = typeof prev === "string" ? prev.split(/\s+/).filter(Boolean) : prev || [];
	for (const name of before) if (!next.has(name)) el.classList.remove(name);
	for (const name of next) el.classList.add(name);
	el[vue_classes] = text;
}

function patch_listener(el, key, handler) {
	const listeners = (el[vue_listeners] ||= {});
	const type = key.slice(2).replace(/\B([A-Z])/g, "-$1").toLowerCase();
	if (!listeners[key] && handler) {
		listeners[key] = { handler };
		// no return value reaches jQuery, which would read `false` (from `@click="open = false"`) as preventDefault + stopPropagation
		$(el).on(`${type}.vue`, (event) => {
			call_handlers(listeners[key].handler, event.originalEvent || event);
		});
	} else if (listeners[key] && handler) {
		listeners[key].handler = handler;
	} else if (listeners[key]) {
		$(el).off(`${type}.vue`);
		delete listeners[key];
	}
}

// A merged listener (mergeProps) is an array; like Vue's invoker, stopImmediatePropagation skips the rest.
function call_handlers(handler, event) {
	if (!Array.isArray(handler)) {
		handler(event);
		return;
	}
	let stopped = false;
	const stop = event.stopImmediatePropagation;
	event.stopImmediatePropagation = () => {
		stop.call(event);
		stopped = true;
	};
	for (const fn of handler) {
		if (stopped) break;
		fn(event);
	}
}

desk_renderer.mount_point = mount_point;
// Runs fn (which unmounts views) without taking `nodes` out of the DOM: jQuery's replaceWith keeps a
// reference to the node's parent across cleanData and would throw if the node were already gone.
desk_renderer.leaving_to_jquery = (nodes, fn) => {
	const outer = left_to_jquery;
	left_to_jquery = new Set(nodes);
	try {
		fn();
	} finally {
		left_to_jquery = outer;
	}
};
module.exports = desk_renderer;
