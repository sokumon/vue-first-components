// Turns a compiled .vue's options into its frappe.ui class. The build calls this; nobody writes it.
//
// Each controller is its own small Vue root. `new` runs, in one synchronous render():
//   the view's setup: the file's <script setup>, then created(), then renders()
//   the first render, whose top-level nodes are then appended to `host`
//   onMounted hooks and template refs, then the class's mounted()
// Nothing global holds a controller, so creating one costs the same at 10 or 10 000 of them, and one
// that its caller dropped is collected with its DOM.
const Vue = require("vue");
const { h, shallowReactive, toRaw, effectScope, proxyRefs, markRaw, getCurrentInstance } = Vue;
const { render, mount_point, leaving_to_jquery } = require("./renderer.js");
const internals = require("./vue_internals.js");

let uid = 0;
frappe.ui.vue_internals_problems = internals.verify(render);

class Component {
	static setups = [];

	constructor(opts = {}) {
		Object.assign(this, this.$initial_data(), opts);
		internal(this, "uid", ++uid);
		const self = shallowReactive(this);
		internal(this, "$self", self);
		wrap_destroys(Object.getPrototypeOf(this));
		if (this.constructor.view) {
			draw(this, self);
			if (!this.$destroyed && this.$renders) {
				// Created from inside a running post flush (another view's onMounted, say), the view's own
				// onMounted and refs land when that flush ends; mounted() follows them there.
				if (this.$view_mounted) self.mounted();
				else internal(this, "$mount_pending", true);
			}
		} else {
			internal(this, "$scope", effectScope(true));
			try {
				this.$scope.run(() => frappe.ui.app.runWithContext(() => run_setups(this, self, { expose() {} })));
				self.created();
			} catch (e) {
				this.$scope.stop();
				throw e;
			}
			if (self.renders() && !this.$destroyed) self.mounted();
		}
		return self;
	}

	$initial_data() {
		return {};
	}

	created() {}

	mounted() {}

	renders() {
		return true;
	}

	// Where the view goes: `parent` or `container`, as anything $() takes. Read once, when the view
	// first draws, after created().
	get host() {
		const raw = toRaw(this);
		return raw.$host || to_element(raw.parent || raw.container);
	}

	get $el() {
		return toRaw(this).$view?.component?.subTree?.el;
	}

	// the view's template refs (ref="x"), Vue's public $refs
	get $refs() {
		return toRaw(this).$view?.component?.proxy?.$refs || {};
	}

	get frappe() {
		return frappe;
	}

	__(...args) {
		return __(...args);
	}

	// Brings this view's DOM up to date now, for callers that read it next: watchers, the view's
	// render and any child render queued by the same change (a <Transition>, a slot), then post-flush
	// work (transition enter hooks, onMounted/onUpdated, template refs), until nothing changes.
	flush() {
		const raw = toRaw(this);
		const view = raw.$view?.component;
		if (!view || raw.$destroyed) return;
		internals.settle(view, render);
	}

	destroy() {
		const raw = toRaw(this);
		if (raw.$destroyed) return;
		// called while `new` is still drawing (from created(), renders() or setup): draw() finishes it
		if (raw.$mount_point && !raw.$mount_point._vnode) return internal(raw, "$destroy_pending", true);
		internal(raw, "$destroyed", true);
		if (raw.$host) placeholder_hosts.get(raw.$host)?.delete(raw);
		// a nested destroy() that throws still lets this view come down, then the error surfaces
		try {
			if (raw.$view?.component) destroy_nested(raw);
		} finally {
			if (raw.$mount_point) render(null, raw.$mount_point);
			raw.$scope?.stop();
		}
	}
}

function draw(raw, self) {
	const view = h(raw.constructor.view, { controller: self });
	view.appContext = draw_context();
	internal(raw, "$view", view);
	internal(raw, "$mount_point", mount_point(() => place(raw, self)));
	const outer = drawing;
	drawing = raw;
	try {
		try {
			render(view, raw.$mount_point);
		} catch (e) {
			fail(raw, e);
		}
		if (!raw.$setup_failed && !raw.$destroy_pending && raw.$renders) {
			// before any deferred mounted hook, so jQuery removal finds the view straight away
			index_roots(raw);
			try {
				// inside a running flush, render() left the post work queued: append it to that flush;
				// otherwise watchers and onMounted hooks may have changed what the view shows
				if (!raw.$view_mounted) internals.flush_queues(render);
				else internals.settle(view.component, render);
			} catch (e) {
				fail(raw, e);
			}
		}
	} finally {
		drawing = outer;
	}
	if (raw.$setup_failed) {
		internal(raw, "$destroyed", true);
		if (raw.$mount_point._vnode) {
			try {
				destroy_nested(raw); // controllers its onMounted hooks already drew into it
			} catch (e) {
				report(e);
			} finally {
				try {
					render(null, raw.$mount_point);
				} catch {}
			}
		} else view.component?.scope.stop();
		throw raw.$setup_error;
	}
	if (raw.$destroy_pending) return raw.destroy.call(self);
}

function report(error) {
	const handler = frappe.ui.app._context.config.errorHandler;
	handler ? handler(error, null, "frappe.ui destroy") : console.error(error);
}

// Anything that goes wrong while `new` draws (setup, created(), renders(), the first render, an
// onMounted hook, a child component) makes `new` throw, as legacy constructors did. Vue would log it
// and carry on, so views get an app context whose errorHandler hands such errors to draw().
let drawing = null; // the controller `new` is drawing, innermost
let context_for = null;
function draw_context() {
	const base = frappe.ui.app._context;
	if (context_for?.base === base) return context_for.context;
	const context = Object.create(base); // same provides, components and globals as the app
	context.config = Object.create(base.config);
	context.config.errorHandler = (err, instance, info) => {
		// only errors from the view being drawn (each view is its own $root); another view's queued
		// re-render can run during this draw too, and its errors are not this constructor's
		const own = !instance || instance.$root === drawing?.$view?.component?.proxy;
		if (drawing && !drawing.$setup_failed && own) return fail(drawing, err);
		if (base.config.errorHandler) return base.config.errorHandler(err, instance, info);
		console.error(err);
	};
	context_for = { base, context };
	return context;
}

function fail(raw, error) {
	if (raw.$setup_failed) return;
	internal(raw, "$setup_failed", true);
	internal(raw, "$setup_error", error);
}

// Called when the view's first top-level node is inserted: setup, created() and renders() have run.
// A view that doesn't render, or has nowhere to go, keeps its placeholder offstage.
function place(raw, self) {
	if (raw.$renders && !raw.$host) {
		internal(raw, "$host", self.host); // a subclass may override `host`
	}
	if (raw.$renders && raw.$host) return raw.$host;
	if (raw.$renders) console.warn(`${raw.constructor.name}: no parent or container to draw into`);
	return place_offstage(raw);
}

function place_offstage(raw) {
	if (!raw.$offstage) internal(raw, "$offstage", document.createDocumentFragment());
	return raw.$offstage;
}

// Whatever the old `$(this.parent || this.container)[0]` took: an element, a jQuery object, a
// selector with jQuery's extensions (":first", ":visible"), or HTML.
function to_element(parent) {
	if (!parent) return undefined;
	if (typeof $ === "function") return $(parent)[0];
	return typeof parent === "string" ? document.querySelector(parent) : parent;
}

// The file's <script setup>, run inside the view's setup, so hooks, inject and template refs belong
// to the view. What it declares reads as `this.x` in methods; its imports don't.
function run_setups(raw, self, ctx) {
	const bindings = {};
	for (const setup of raw.constructor.setups) {
		const returned = setup(self, ctx);
		const imports = setup_imports.get(setup);
		for (const key of Object.keys(returned)) {
			Object.defineProperty(bindings, key, { ...Object.getOwnPropertyDescriptor(returned, key), enumerable: true });
			if (!(imports ? imports.has(key) : looks_imported(returned, key))) bind_setup_field(raw, key);
		}
	}
	internal(raw, "$setup_state", proxyRefs(bindings));
	return bindings;
}

// The build lists a file's imports as `__imports` (compileScript's `imports`). Without that list,
// guess from what compileScript returns: `import { ref } from "vue"` is vue's own `ref` under its
// own name, a .vue import is a compiled component (it has __file), and any other import is a getter
// with no setter (a local `let` has both). Local objects, class instances (a Dialog), local
// components and `const later = nextTick` stay this.x.
const setup_imports = new WeakMap();
function looks_imported(returned, key) {
	const d = Object.getOwnPropertyDescriptor(returned, key);
	if (d.get) return !d.set;
	const v = d.value;
	if (typeof v === "function") return Vue[key] === v;
	if (!v || typeof v !== "object" || Vue.isRef(v) || Vue.isReactive(v)) return false;
	// a compiled .vue file: the build always sets __file on it
	const proto = Object.getPrototypeOf(v);
	return (proto === Object.prototype || proto === null) && Object.hasOwn(v, "__file");
}

function bind_setup_field(raw, key) {
	if (key in raw) return;
	Object.defineProperty(raw, key, {
		configurable: true,
		get: () => raw.$setup_state[key],
		set: (value) => (raw.$setup_state[key] = value),
	});
}

// Bookkeeping lives on the raw object, non-enumerable: not tracked, not copied, not reactive.
function internal(raw, key, value) {
	Object.defineProperty(raw, key, { configurable: true, writable: true, value });
}

// Legacy code drops controllers and lets jQuery remove their DOM (.html(), .empty(), .remove(),
// .replaceWith()). jQuery cleans every element it removes, before removing it, so a cleaned element
// that is one of a view's top-level nodes destroys its controller. jQuery then does the removing.
// .detach() doesn't clean, so a detached view lives on, as its jQuery handlers do.
//
// `owner` maps a view's top-level nodes to the view, wherever legacy code has since moved them. It
// is refreshed whenever the top can change: the view's own render, and a child component at the top
// re-rendering by itself. An entry is checked against the view's current top before it counts.
const owner = new WeakMap();
const watched = new WeakSet();
// Views whose top has no element (a placeholder comment, a Teleport, an empty fragment): jQuery never
// cleans their nodes, so they are found by their host instead.
const placeholder_hosts = new WeakMap(); // host element -> such views drawn into it
function index_roots(raw) {
	const view = raw.$view?.component;
	if (!view || raw.$destroyed) return;
	const nodes = internals.root_nodes(view);
	for (const node of nodes) owner.set(node, raw);
	const elementless = !nodes.some((node) => node.nodeType === 1);
	if (raw.$host) {
		let here = placeholder_hosts.get(raw.$host);
		if (elementless) (here || placeholder_hosts.set(raw.$host, (here = new Set())).get(raw.$host)).add(raw);
		else here?.delete(raw);
	}
	for (const child of internals.root_components(view)) {
		if (watched.has(child)) continue;
		watched.add(child);
		Vue.onUpdated(() => index_roots(raw), child);
	}
}

// The live controllers whose top-level nodes include some of `nodes`. Each view's top is computed
// once per call, so a view with thousands of top-level rows costs one pass, not one per row.
// A controller already being destroyed is left alone: a destroy() override that removes its own DOM
// through jQuery would otherwise be called again from here, without end.
const destroying = new WeakSet();
function owners_of(nodes, skip) {
	let found;
	const tops = new Map();
	for (let i = 0, node; (node = nodes[i]) != null; i++) {
		const raw = owner.get(node);
		if (!raw || raw === skip || raw.$destroyed || destroying.has(raw) || found?.has(raw)) continue;
		let top = tops.get(raw);
		if (!top) tops.set(raw, (top = new Set(internals.root_nodes(raw.$view.component))));
		if (top.has(node)) (found ||= new Set()).add(raw);
	}
	for (let i = 0, node; (node = nodes[i]) != null; i++) {
		for (const raw of placeholder_hosts.get(node) || []) if (raw !== skip && !raw.$destroyed && !destroying.has(raw)) (found ||= new Set()).add(raw);
	}
	return found;
}

// One destroy() that throws doesn't stop the others; its error is reported.
function destroy_all(found) {
	for (const raw of found) {
		try {
			raw.$self.destroy();
		} catch (e) {
			report(e);
		}
	}
}

// Every destroy() on a controller's prototype chain, including a later `class X extends` override,
// marks the controller as being destroyed for as long as it runs: an override that removes its own
// DOM through jQuery reaches $.cleanData, which must not call it a second time.
const wrapped_destroys = new WeakSet();
function wrap_destroys(proto) {
	for (; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
		const fn = Object.getOwnPropertyDescriptor(proto, "destroy")?.value;
		if (typeof fn !== "function" || wrapped_destroys.has(fn)) continue;
		const wrapped = function (...args) {
			const raw = toRaw(this);
			const mine = !destroying.has(raw);
			if (mine) destroying.add(raw);
			try {
				return fn.apply(this, args);
			} finally {
				if (mine) destroying.delete(raw);
			}
		};
		wrapped_destroys.add(wrapped);
		Object.defineProperty(proto, "destroy", { configurable: true, writable: true, value: wrapped });
	}
}

function watch_jquery_cleanup() {
	const clean = $.cleanData;
	if (clean.frappe_ui) return;
	$.cleanData = function (elems) {
		const found = owners_of(elems);
		if (found) leaving_to_jquery(elems, () => destroy_all(found));
		return clean.apply(this, arguments);
	};
	$.cleanData.frappe_ui = true;

	// .empty() and .html() clean what is inside an element, never the element: a placeholder-only
	// view drawn straight into it is found here
	// only where jQuery really writes: .html(undefined), or a function returning undefined, doesn't
	const clear = (el) => {
		const here = placeholder_hosts.get(el);
		if (here?.size) destroy_all([...here].filter((raw) => !raw.$destroyed && !destroying.has(raw)));
	};
	const empty = $.fn.empty;
	$.fn.empty = function () {
		for (let i = 0; i < this.length; i++) clear(this[i]);
		return empty.apply(this, arguments);
	};
	const html = $.fn.html;
	$.fn.html = function (...args) {
		const value = args[0];
		if (typeof value === "function") {
			args[0] = function (i, old) {
				const out = value.call(this, i, old);
				if (out !== undefined) clear(this);
				return out;
			};
		} else if (value !== undefined) for (let i = 0; i < this.length; i++) clear(this[i]);
		return html.apply(this, args);
	};

	const detach = $.fn.detach;
	$.fn.detach = function () {
		for (let i = 0; i < this.length; i++) parked.add(this[i]);
		return detach.apply(this, arguments);
	};
}

// Vue removes a destroyed view's DOM itself, so jQuery never cleans it: controllers drawn inside
// it (into one of its elements, or into its teleported content) are destroyed here.
function destroy_nested(raw) {
	for (const region of internals.element_regions(raw.$view.component)) {
		const found = owners_of([region, ...region.getElementsByTagName("*")], raw);
		if (found) destroy_all(found);
	}
}

const classes = new WeakMap();

frappe.ui.define = function (options) {
	watch_jquery_cleanup();
	const Parent = classes.get(options.extends) || Component;
	const Class = { [short_name(options)]: class extends Parent {} }[short_name(options)];
	const proto = Class.prototype;

	const methods = options.methods || {};
	Object.setPrototypeOf(methods, Parent.prototype);
	for (const key of Object.keys(methods)) define_hidden(proto, key, methods[key]);
	for (const key of ["created", "mounted"]) {
		if (options[key]) define_hidden(proto, key, options[key]);
	}
	for (const [key, getter] of Object.entries(options.computed || {})) define_field(proto, key, getter);
	define_hidden(proto, "$initial_data", function () {
		return { ...Parent.prototype.$initial_data.call(this), ...options.data?.call(this) };
	});
	// class fields legacy subclasses read and override: `static horizontal = true`
	for (const [key, value] of Object.entries(options.static || {})) Class[key] = value;
	// inherit_view: a file that only adds behaviour keeps its parent's view (desk's esbuild Vue plugin
	// refuses a .vue with no <template>, so such a file carries an empty one)
	if (options.render && !options.inherit_view) Class.view = markRaw(view_for(options));
	if (options.setup && options.__imports) setup_imports.set(options.setup, new Set(options.__imports));
	Class.setups = options.setup ? [...Parent.setups, options.setup] : Parent.setups;

	classes.set(options, Class);
	assign_path(options.name, Class);
	return Class;
};

function view_for(options) {
	return {
		name: options.name,
		props: ["controller"],
		setup(props, ctx) {
			const self = props.controller;
			const raw = toRaw(self);
			let bindings;
			try {
				bindings = run_setups(raw, self, ctx);
				self.created();
				internal(raw, "$renders", !raw.$destroy_pending && !!self.renders());
			} catch (e) {
				// Vue would log it and carry on; `new` rethrows it instead, as it always has
				internal(raw, "$setup_failed", true);
				internal(raw, "$setup_error", e);
				internal(raw, "$renders", false);
			}
			// a view that doesn't draw doesn't mount: its setup's onMounted would find no template
			if (!raw.$renders) internals.drop_mount_hooks(getCurrentInstance());
			// returned as the view's setupState too, so `ref="x"` on a setup ref() fills it
			return bindings || {};
		},
		render(_ctx, cache) {
			const self = this.$.props.controller;
			const raw = toRaw(self);
			if (!raw.$renders || raw.$destroyed || raw.$destroy_pending) return null;
			if (lost_root(this.$, raw)) {
				// jQuery took the nodes out one by one; put them side by side again, offstage, so Vue
				// can take them down
				const offstage = place_offstage(raw);
				for (const node of internals.top_nodes(this.$)) offstage.appendChild(node);
				queueMicrotask(() => self.destroy());
				return null;
			}
			return options.render(self, cache, self, raw.$setup_state, self, self);
		},
		beforeMount() {
			internals.schedule_apart(this.$);
		},
		updated() {
			index_roots(toRaw(this.$.props.controller));
		},
		mounted() {
			const raw = toRaw(this.$.props.controller);
			internal(raw, "$view_mounted", true);
			index_roots(raw);
			if (raw.$mount_pending) {
				internal(raw, "$mount_pending", false);
				if (!raw.$destroyed) raw.$self.mounted();
			}
		},
	};
}

// A view showing only placeholders (a root v-if that is false, a fragment of them) has no element
// for jQuery to clean. When legacy code empties the host, they go with it; drawing again would put
// the view back into a host its caller emptied, so the view is destroyed instead. Nodes parked
// with .detach() are being kept, not emptied.
const parked = new WeakSet();
function lost_root(instance, raw) {
	if (!instance.isMounted || !raw.$host) return false;
	const tree = instance.subTree;
	const nodes = [...internals.root_nodes(instance), tree.el, tree.anchor].filter(Boolean);
	for (const node of nodes) if (node.parentNode) parked.delete(node);
	return nodes.length > 0 && nodes.every((node) => node.nodeType !== 1 && !node.parentNode && !parked.has(node));
}

// A field reads from the view until a caller assigns its own, as legacy subclasses do.
function define_field(proto, key, getter) {
	const assigned = Symbol(key);
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			return assigned in this ? this[assigned] : getter.call(this);
		},
		set(value) {
			this[assigned] = value;
		},
	});
}

function define_hidden(proto, key, value) {
	Object.defineProperty(proto, key, { configurable: true, writable: true, value });
}

function short_name(options) {
	return options.name.split(".").pop();
}

function assign_path(path, value) {
	const parts = path.split(".");
	const last = parts.pop();
	parts.reduce((object, key) => (object[key] ||= {}), globalThis)[last] = value;
}

module.exports = { Component };
