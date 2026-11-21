// Vue's DOM renderer, made to share its nodes with jQuery (from v5/renderer.js, minus mount_point):
//   - a node keeps the parent Vue gave it, so Vue still finds a node that legacy code detached;
//   - Vue adds and removes only the classes that changed in its own binding, so a class jQuery
//     removed (Check's `removeClass("form-control")`) stays removed until the binding itself changes;
//   - `value` is written only when the bound value changes (the input owns what was typed or .val()-ed);
//   - listeners are jQuery's (namespace .vue), so .trigger() reaches them and .off() removes them;
//   - nodes jQuery is cleaning right now are left for jQuery to remove (its replaceWith needs them);
//   - a list's end anchor marked TAIL (a template's `v-tail`, frappe.ui.Page) takes new items at the
//     end of the container, after what legacy code appended there, as the legacy appends did.
import { createRenderer, nodeOps, patchProp, callWithAsyncErrorHandling } from "vue";

const vue_parent = Symbol("vue_parent");
const vue_classes = Symbol("vue_classes");
const vue_listeners = Symbol("vue_listeners");
const NATIVE_ONLY = /(Once|Passive|Capture)$/;
const TAIL = Symbol.for("frappe.ui.append_at_end");

let left_to_jquery = null;

const desk_renderer = createRenderer({
	...nodeOps,
	remove(child) {
		if (!left_to_jquery?.has(child)) nodeOps.remove(child);
	},
	insert(child, parent, anchor) {
		child[vue_parent] = parent;
		if (anchor && anchor[TAIL]) anchor = null;
		nodeOps.insert(child, parent, anchor?.parentNode === parent ? anchor : null);
	},
	parentNode(node) {
		return node.parentNode || node[vue_parent] || null;
	},
	patchProp(el, key, prev, next, namespace, parentComponent) {
		if (key === "class") return patch_class(el, next);
		if (key === "value" && prev === next && "_value" in el) return;
		if (key.charCodeAt(0) === 111 /* o */ && /^on[A-Z]/.test(key) && !NATIVE_ONLY.test(key)) return patch_listener(el, key, next, parentComponent);
		patchProp(el, key, prev, next, namespace, parentComponent);
	},
});

function patch_class(el, value) {
	const text = String(value ?? "");
	const prev = el[vue_classes];
	if (prev === undefined && !el.className) {
		el.className = text;
		el[vue_classes] = text;
		return;
	}
	if (prev === text) return;
	const before = new Set((prev || "").split(/\s+/).filter(Boolean));
	const next = new Set(text.split(/\s+/).filter(Boolean));
	for (const name of before) if (!next.has(name)) el.classList.remove(name);
	for (const name of next) if (!before.has(name)) el.classList.add(name);
	el[vue_classes] = text;
}

// errors go where Vue sends a template listener's errors: errorCaptured up the tree, then the app's errorHandler
function patch_listener(el, key, handler, instance) {
	const listeners = (el[vue_listeners] ||= {});
	const type = key.slice(2).replace(/\B([A-Z])/g, "-$1").toLowerCase();
	if (!listeners[key] && handler) {
		const record = (listeners[key] = { handler, instance });
		$(el).on(`${type}.vue`, (event) => {
			callWithAsyncErrorHandling(call_handlers, record.instance, 5 /* NATIVE_EVENT_HANDLER */, [record.handler, event.originalEvent || event]);
		});
	} else if (listeners[key] && handler) {
		listeners[key].handler = handler;
		listeners[key].instance = instance;
	} else if (listeners[key]) {
		$(el).off(`${type}.vue`);
		delete listeners[key];
	}
}

function call_handlers(handler, event) {
	if (!Array.isArray(handler)) return void handler(event);
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

desk_renderer.leaving_to_jquery = (nodes, fn) => {
	const outer = left_to_jquery;
	left_to_jquery = new Set(Array.prototype.slice.call(nodes)); // jsdom: iterating a live HTMLCollection is O(n^2)
	try {
		fn();
	} finally {
		left_to_jquery = outer;
	}
};
export default desk_renderer;
