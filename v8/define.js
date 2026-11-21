// v8 "composition": every frappe.ui controller's view is a component in ONE app made with createApp.
//
// Where a view sits in the tree:
//   - drawn by a parent's template (`<ControlData :df="df"/>` in a Section's template): an ordinary
//     child component. Its setup constructs the controller. Vue mounts and unmounts it.
//   - drawn by `new X({parent: el})`: mounted right there, synchronously, as a child of the
//     controller whose DOM contains `el` (else of the controller being built, when `el` is detached;
//     else of the app's root). It is mounted with the renderer's own patch(), passing that owner's
//     instance as parentComponent: the same call Vue makes for any child, minus the parent
//     re-rendering, so adding one costs the same at 10 or 10 000 siblings.
// Either way `instance.parent` is real: provide/inject, errorCaptured and the app's errorHandler see
// one tree.
//
// What `new` does, synchronously, whether or not a Vue flush is running:
//   assign options -> patch(view) [setup: <script setup>, created(); first render; children]
//   -> template-drawn children's mounted() -> mounted()
// mounted() is called by `new`, not by Vue's post-flush queue, so it runs before `new` returns even
// inside another component's onMounted. Template refs are not used for parts: `v-part:name` records
// an element in `this.$parts` from the directive's `created` hook, which Vue calls synchronously.
import {
	h,
	shallowReactive,
	shallowRef,
	watch,
	proxyRefs,
	KeepAlive,
	getCurrentInstance,
	onBeforeUnmount,
	onBeforeMount,
	onUpdated,
	onMounted,
	markRaw,
	inject,
	computed,
	isRef,
	isReactive,
	toRaw,
	onErrorCaptured,
	getCurrentScope,
	callWithErrorHandling,
	queuePostFlushCb,
} from "vue";
import * as Vue from "vue";
// pauseTracking/resetTracking: public exports of @vue/reactivity (reactivity.d.ts:321). The bundle must
// resolve "@vue/reactivity" to the copy runtime-core imports (one module instance), or the pause does
// nothing; verify() checks that. `new` and flush() run without the caller's effect tracking them, so a
// `new` from inside a render, computed or watch getter does not subscribe the caller to the
// controller's state (that looped: "Maximum recursive updates exceeded").
import * as reactivity from "@vue/reactivity";
import renderer from "./renderer.js";

// Switches for the jsdom spike and benches only (FUI_PAUSE=0, FUI_APART=0); the desk never sets them.
const flag = (name) => (globalThis.process?.env?.[name] ?? globalThis[name]) !== "0";
const PAUSE = flag("FUI_PAUSE");
const APART = flag("FUI_APART");
const pauseTracking = PAUSE ? reactivity.pauseTracking : () => {};
const resetTracking = PAUSE ? reactivity.resetTracking : () => {};

const FUI = Symbol("frappe.ui controller"); // on a controller's top element(s)
let internals = null; // { p: patch, um: unmount, ... }: what Vue hands KeepAlive
let root = null; // the app's root instance: owner of views drawn where no controller is
let uid = 0;

// ------------------------------------------------------------------ the one app
// KeepAlive is the one public component Vue gives its renderer to (mountComponent sets
// instance.ctx.renderer for it, runtime-core.cjs.js:6088-6090). An empty KeepAlive is rendered once at
// the root; a function ref on it is called synchronously during that patch (setRef :1823-1824) and
// reads the renderer off KeepAlive's instance.
const take_renderer = (proxy) => {
	if (proxy && !internals) internals = proxy.$.ctx.renderer;
};

frappe.ui.create_app = function (App, props) {
	const app = renderer.createApp({
		name: "FrappeDesk",
		setup() {
			root = getCurrentInstance();
			return () => [h(KeepAlive, { ref: take_renderer }), App ? h(App, props) : null];
		},
	});
	app.directive("part", part_directive);
	app.mixin(due_mixin);
	chain_error_handler(app.config);
	watch_jquery_cleanup();
	const mount = app.mount;
	app.mount = function (...args) {
		const out = mount.apply(this, args);
		verify();
		frappe.ui.vue_verified = true;
		return out;
	};
	frappe.ui.app = app;
	return app;
};

// Fails loudly, at app.mount, when the Vue in use no longer behaves as this runtime needs:
//   - KeepAlive's ctx.renderer exists, with patch(n1, n2, container, ...) and unmount(vnode, parent, ...)
//     (their .length counts the parameters before the first default: 3 and 3 in 3.5.x);
//   - patch() with a parentComponent mounts a child whose instance.parent and provides come from it;
//   - a mounted component has instance.job (runIfDirty) and a writable effect.scheduler; its render
//     effect has the RUNNING flag (2) while it renders, and not after;
//   - a watcher made in setup is listed in the setup's effect scope (scope.effects), and an
//     onBeforeUnmount hook in instance.bum (sweep reads both);
//   - unmount() removes it.
const VERIFY_KEY = Symbol("frappe.ui verify");
function verify() {
	const fail = (what) => {
		throw new Error(`frappe.ui: this Vue is not one the frappe.ui runtime supports (${what}). Checked against Vue 3.5.43.`);
	};
	if (!root) fail("root instance");
	if (typeof internals?.p !== "function" || typeof internals?.um !== "function") fail("KeepAlive ctx.renderer.p/um");
	if (internals.p.length !== 3 || internals.um.length !== 3) fail("patch/unmount signatures");
	if (PAUSE) {
		// "@vue/reactivity" must be the copy runtime-core uses: a paused read inside vue's own computed
		// must not become a dependency of it
		const source = shallowRef(0);
		const read = computed(() => {
			pauseTracking();
			try {
				return source.value;
			} finally {
				resetTracking();
			}
		});
		read.value;
		source.value = 1;
		if (read.value !== 0) fail("@vue/reactivity is not the copy vue uses (pauseTracking)");
	}
	let seen = null;
	const Probe = {
		setup() {
			const i = getCurrentInstance();
			const scope = getCurrentScope();
			const before = scope?.effects?.length;
			watch(shallowRef(0), () => {});
			onBeforeUnmount(() => {});
			seen = { parent: i.parent, injected: inject(VERIFY_KEY, null), i, watchers: scope?.effects?.length - before };
			return () => {
				seen.running = patching(i);
				return h("i");
			};
		},
	};
	root.provides[VERIFY_KEY] = true; // root's own provides object; removed below
	try {
		const box = document.createDocumentFragment();
		const vnode = h(Probe);
		internals.p(null, vnode, box, null, root, null, undefined);
		if (!seen || seen.parent !== root || seen.injected !== true) fail("patch() with a parentComponent");
		if (typeof seen.i.job !== "function" || !seen.i.effect || !("scheduler" in seen.i.effect)) fail("instance.job / effect.scheduler");
		if (seen.running !== true || patching(seen.i)) fail("effect.flags RUNNING");
		if (seen.watchers !== 1) fail("a component's watchers in its effect scope's effects");
		if (seen.i.bum?.length !== 1) fail("instance.bum (beforeUnmount hooks)");
		internals.um(vnode, root, null, true);
		if (box.firstChild) fail("unmount()");
	} finally {
		delete root.provides[VERIFY_KEY];
	}
}

// v-part:name -> this.$parts.name, while the element is drawn. `created` runs during patch, after the
// element's children exist, before `new`/flush() returns; `beforeUnmount` too. Used in a plain
// component's template (a region a class split out of its own, frappe.ui.Page's menus), it records into
// the nearest controller above it.
const controller_of = new WeakMap(); // view proxy -> controller
function part_owner(instance) {
	for (let p = instance; p; p = p.$parent) {
		const c = controller_of.get(p);
		if (c) return c;
	}
	return null;
}
const part_directive = {
	created(el, { arg, instance }) {
		if (!arg) return; // a component that takes its part name as a prop, given none
		const c = part_owner(instance);
		if (c) c.$fui.parts[arg] = el;
	},
	beforeUnmount(el, { arg, instance }) {
		if (!arg) return;
		const c = part_owner(instance);
		// deleted, not set to null: a page that adds and removes items for hours keeps no key per item
		if (c && c.$fui.parts[arg] === el) delete c.$fui.parts[arg];
	},
};

// Errors while `new` draws (setup, created(), a render, a child) make `new` throw, as legacy
// constructors did; Vue would log them and go on. Everything else goes to the app's own handler,
// which callers may still set as usual.
let drawing = null;
function chain_error_handler(config) {
	let user = config.errorHandler;
	const handler = (err, vm, info) => {
		if (drawing && !drawing.$fui.error && within(vm, drawing)) return void (drawing.$fui.error = err);
		if (drawing && drawing.$fui.error === err) return; // noted on its way up (note_draw_error)
		if (user) return user(err, vm, info);
		console.error(err);
	};
	Object.defineProperty(config, "errorHandler", { configurable: true, enumerable: true, get: () => handler, set: (fn) => (user = fn) });
}
// a view drawn by `new` sees its descendants' errors first (errorCaptured), before any boundary above
function note_draw_error(err, vm) {
	if (drawing && !drawing.$fui.error && within(vm, drawing)) drawing.$fui.error = err;
}
function within(vm, c) {
	if (!vm) return true;
	const target = c.$fui.view?.proxy;
	for (let p = vm; p; p = p.$parent) if (p === target) return true;
	return false;
}
function report(error) {
	frappe.ui.app.config.errorHandler(error, null, "frappe.ui destroy");
}

// ------------------------------------------------------------------ the controller
let adopting = null; // set while a parent's template constructs a controller in its view's setup
const building = []; // controllers whose created()/mounted() is running

class Component {
	static setups = [];

	constructor(opts = {}) {
		const fui = {
			state: shallowReactive(this.$initial_data()),
			parts: {},
			uid: ++uid,
			view: null, // the view's component instance
			vnode: null, // set when `new` mounted the view (not a parent's template)
			owner: null,
			owned: null,
			host: null,
			rendering: false,
			destroyed: false,
			unmounted: false,
			error: null,
			setup_state: null,
			entry: null,
			on_ready: null,
			refreshing: 0,
		};
		// markRaw: frappe's own Vue code keeps controls in reactive state (the form builder's `frm` ref).
		// A reactive proxy's get must return a non-configurable, non-writable property's own value
		// (a Proxy invariant), and Vue would wrap fui; a raw fui is returned as it is.
		Object.defineProperty(this, "$fui", { value: markRaw(fui) });
		const in_template = adopting;
		adopting = null;
		// legacy `$.extend(this, opts)`: inherited enumerable keys too, undefined values skipped
		for (const key in opts) if (opts[key] !== undefined && key !== "__proto__") this[key] = opts[key];
		wrap_destroys(Object.getPrototypeOf(this));
		if (in_template) return; // the view's setup goes on from here
		if (!template_of(this.constructor)) {
			build(this, () => this.created());
			build(this, () => this.mounted());
			return;
		}
		draw(this);
	}

	$initial_data() {
		return {};
	}
	created() {}
	mounted() {}

	get $parts() {
		return this.$fui.parts;
	}
	get $el() {
		return this.$fui.view?.vnode.el;
	}
	get $slots() {
		return this.$fui.view?.slots || {};
	}
	get frappe() {
		return frappe;
	}
	__(...args) {
		return __(...args);
	}

	// Brings this view's DOM up to date now: its own render if what it shows changed, then any child
	// component whose own state changed (a <Transition>, a slot), then mounted() of children its
	// template just added. Nothing changed: no render, no DOM write.
	flush() {
		const fui = this.$fui;
		const view = fui.view;
		if (!view || fui.destroyed || fui.rendering || !view.job || view.isUnmounted || patching(view)) return;
		const from = pending.length;
		pauseTracking();
		try {
			apart.delete(view);
			view.job(); // runIfDirty
			flush_below(view);
			settle(from);
		} finally {
			resetTracking();
		}
		mark(this);
	}

	destroy() {
		const fui = this.$fui;
		if (fui.destroyed) return;
		fui.destroyed = true;
		try {
			destroy_owned(fui);
		} finally {
			if (fui.vnode) {
				// drawn by `new`: unmount it from where it was mounted. Destroyed while its own patch runs
				// (destroy() in created()): it draws nothing, and draw() unmounts it when the patch returns.
				if (fui.patching) fui.state.__dead = true;
				else if (!fui.unmounted && fui.vnode.component) internals.um(fui.vnode, fui.parent_instance || root, null, true);
				fui.owner?.owned?.delete(toRaw(this));
			} else if (fui.view && !fui.unmounted) {
				// drawn by a parent's template, which still lists it: it draws nothing from now on
				fui.state.__dead = true;
				fui.view.job?.();
			}
			unmark(this);
		}
	}
}

function build(c, fn) {
	building.push(c);
	try {
		fn();
	} finally {
		building.pop();
	}
}

function draw(c) {
	const fui = c.$fui;
	const host = to_element(c.parent || c.container);
	const owner = owner_for(host);
	fui.vnode = h(view_of(c.constructor), { controller: c });
	fui.owner = owner;
	fui.host = host || null;
	const outer = drawing;
	drawing = c;
	const from = pending.length;
	pauseTracking();
	try {
		fui.parent_instance = parent_instance(owner);
		fui.patching = true;
		try {
			// `appendTo(undefined)` left the wrapper detached, for the caller to place: a fragment does that
			internals.p(null, fui.vnode, host || document.createDocumentFragment(), null, fui.parent_instance, null, namespace_of(host));
		} catch (e) {
			fail(c, e);
		} finally {
			fui.patching = false;
		}
		if (fui.destroyed && !fui.unmounted && fui.vnode.component) internals.um(fui.vnode, fui.parent_instance, null, true);
		if (!fui.error && !fui.destroyed) {
			if (owner) (owner.owned ||= new Set()).add(c);
			mark(c);
			try {
				settle(from);
				build(c, () => c.mounted());
				mark(c);
			} catch (e) {
				fail(c, e);
			}
		}
	} finally {
		drawing = outer;
		resetTracking();
	}
	if (fui.error) {
		const error = fui.error;
		try {
			c.destroy();
		} catch {}
		throw error;
	}
}

function fail(c, e) {
	if (!c.$fui.error) c.$fui.error = e;
}

// The controller that owns `el`: the nearest one whose DOM contains it. A detached element belongs
// to the controller being built (it will append it into its own DOM); anything else to the root.
// The parent a view drawn by `new` gets, as an owner record { instance, owned }:
//   1. the controller whose DOM contains `el` (the DOM decides, as a template would);
//   2. a detached `el`: the controller being built, which will append it into its own DOM;
//   3. code running in a component's setup or hook (a Vue component's onMounted): that component,
//      when `el` is inside its DOM or detached;
//   4. the app's root.
// The owner destroys what it owns when it goes, if it is still in the owner's DOM then (see
// destroy_owned). The root owns nothing: nothing global keeps a controller alive.
function owner_for(el) {
	const by_dom = dom_owner(el);
	if (by_dom) return by_dom;
	const detached = el && !el.isConnected;
	if (detached && building.length) return building[building.length - 1].$fui;
	const current = getCurrentInstance();
	if (current && current !== root) {
		const c = view_controller.get(current);
		if (c) return c.$fui;
		const top = current.proxy?.$el;
		if (detached || (top && el && (top === el || top.contains?.(el) || top.parentNode?.contains(el)))) return instance_owner(current);
	}
	return null;
}
// Vue's parent for the view: the owner's instance, unless the owner hasn't rendered yet (`new` in its
// setup or created()). Mounting an element-rooted child reads the parent's subTree (setScopeId,
// runtime-core.cjs.js:5797-5800), which is null until the first render; the view then goes under the
// nearest ancestor that has rendered. The owner still destroys it; only the owner's own provide()
// is out of its reach.
function parent_instance(owner) {
	let inst = owner ? owner.view : root;
	while (inst && !inst.subTree) inst = inst.parent;
	return inst || root;
}
const instance_owners = new WeakMap(); // a plain component that created controllers in its setup or hooks
function instance_owner(instance) {
	let rec = instance_owners.get(instance);
	if (!rec) {
		rec = { instance, owned: null, view: instance };
		instance_owners.set(instance, rec);
		onBeforeUnmount(() => destroy_owned(rec), instance);
	}
	return rec;
}

function to_element(parent) {
	if (!parent) return undefined;
	if (parent.nodeType) return parent;
	return $(parent)[0];
}

function namespace_of(el) {
	return el && el.namespaceURI === "http://www.w3.org/2000/svg" && el.tagName !== "foreignObject" ? "svg" : undefined;
}

// ------------------------------------------------------------------ the view: one component per class
const templates = new WeakMap(); // class -> the options of the .vue that has its template
const views = new WeakMap(); // class -> its view component
const classes = new WeakMap(); // .vue options -> class
const view_controller = new WeakMap(); // view instance -> controller

function template_of(Class) {
	for (let k = Class; k && k !== Component; k = Object.getPrototypeOf(k)) {
		const options = templates.get(k);
		if (options) return options;
	}
	return null;
}

function view_of(Class) {
	let view = views.get(Class);
	if (view) return view;
	const options = template_of(Class);
	const components = {};
	for (const [key, value] of Object.entries(options.components || {})) components[key] = classes.has(value) ? view_of(classes.get(value)) : value;
	const template = options.render;
	view = markRaw({
		name: Class.name,
		inheritAttrs: false,
		props: { controller: null },
		components,
		directives: options.directives,
		setup: (props, ctx) => setup_view(Class, props, ctx),
		// the class's compiled template, with the controller as `_ctx`. $setup is Vue's setupState: the
		// view's setup returns the class's <script setup> bindings, so `ref="x"` on a setup ref fills it
		render(proxy, cache, props, setup_state) {
			const c = controller_of.get(proxy);
			const fui = c?.$fui;
			if (!fui || fui.state.__dead) return null;
			fui.rendering = true;
			try {
				return template(c, cache, props, setup_state, c, c);
			} catch (e) {
				// its own render error goes up from its parent: an error boundary there may stop it
				// before the app's handler, and `new` must still throw it
				note_draw_error(e, proxy);
				throw e;
			} finally {
				fui.rendering = false;
			}
		},
	});
	views.set(Class, view);
	return view;
}

function setup_view(Class, props, ctx) {
	const instance = getCurrentInstance();
	let c = props.controller;
	const in_template = !c;
	const scope = getCurrentScope();
	if (in_template) {
		const { onReady, ...opts } = ctx.attrs;
		adopting = instance;
		c = new Class(opts);
		if (onReady) c.$fui.on_ready = onReady;
	}
	const fui = c.$fui;
	fui.view = instance;
	fui.scope = scope;
	controller_of.set(instance.proxy, c);
	view_controller.set(instance, c);
	try {
		build(c, () => {
			run_setups(c, ctx);
			c.created();
		});
	} catch (e) {
		// `new` rethrows it; Vue would log it and warn about a missing render
		if (!drawing) throw e;
		fail(drawing, e);
		return () => null;
	}
	if (!in_template && drawing === c) onErrorCaptured(note_draw_error);
	onBeforeUnmount(() => view_unmounting(c));
	onUpdated(() => mark(c));
	if (APART) onBeforeMount(() => schedule_apart(instance));
	if (in_template) {
		// its mounted() runs once its DOM exists: after the patch that mounts it, children first
		const entry = (fui.entry = { c, kids: [], done: false });
		let p = instance.parent;
		while (p && !view_controller.has(p)) p = p.parent;
		const up = p && view_controller.get(p).$fui.entry;
		if (up && !up.done) up.kids.push(entry);
		else pending.push(entry);
		onMounted(() => settle(0, true)); // when Vue's own scheduler mounted it
	}
	// an object: Vue makes it the instance's setupState (string template refs fill setup refs)
	return fui.setup_bindings || undefined;
}

function view_unmounting(c) {
	const fui = c.$fui;
	fui.unmounted = true;
	if (!fui.destroyed) {
		try {
			c.destroy(); // a legacy destroy() override still gets its call
		} catch (e) {
			report(e);
		}
	}
	destroy_owned(fui);
}

// An owner takes with it only what is still in its DOM. A child drawn into a detached host (rules 2
// and 3 of owner_for) may have been placed somewhere else: frappe's Dialog builds its fields into a
// detached modal and appends it to <body> on show(). Such a child is not the owner's to destroy (with
// legacy controls nothing would destroy it); when it now sits in another controller's DOM, that one
// owns it from here on.
function destroy_owned(rec) {
	const owned = rec.owned;
	if (!owned?.size) return;
	const list = [...owned];
	owned.clear();
	for (const child of list) {
		const node = top_node(child);
		if (node && !owner_holds(rec, node)) {
			const next = dom_owner(node);
			child.$fui.owner = next !== rec ? next : null;
			if (child.$fui.owner) (next.owned ||= new Set()).add(child);
			continue;
		}
		try {
			child.destroy();
		} catch (e) {
			report(e);
		}
	}
}
function owner_holds(rec, node) {
	const inst = rec.view;
	if (inst && vnode_holds(inst.subTree, node)) return true;
	const w = inst && view_controller.get(inst)?.$wrapper?.[0];
	return !!(w && (w === node || w.contains(node)));
}
function vnode_holds(vnode, node) {
	if (!vnode) return false;
	if (vnode.component) return vnode_holds(vnode.component.subTree, node);
	const el = vnode.el;
	if (!el) return false;
	if (el.nodeType === 1) return el === node || el.contains(node);
	// a fragment: the nodes from its start anchor to its end anchor
	for (let n = el; n; n = n.nextSibling) {
		if (n === node || (n.nodeType === 1 && n.contains(node))) return true;
		if (n === vnode.anchor || !vnode.anchor) break;
	}
	return false;
}
// rule 1 of owner_for: the controller whose DOM contains `el`
function dom_owner(el) {
	for (let n = el; n; n = n.parentNode) {
		const c = n[FUI];
		if (c && !c.$fui.destroyed && is_top(c, n)) return c.$fui;
	}
	return null;
}

// Template-drawn controllers waiting for their mounted(). `from`: only those registered since a
// patch began, so a `new` nested inside some setup never runs mounted() for a view that its outer
// patch is still mounting. `all`: Vue's own scheduler mounted them (post-flush fallback).
// Each entry runs whatever its siblings do: a mounted() that throws (df.on_make, a subclass's make)
// does not keep the later ones from mounting, as one legacy constructor's error never stopped the
// next one. The first error is rethrown once all have run.
let pending = [];
let settling = 0;
function settle(from, all = false) {
	if (all && (drawing || settling)) return;
	const errors = [];
	while (pending.length > from) {
		const list = pending.splice(all ? 0 : from);
		settling++;
		try {
			for (const entry of list) run_entry(entry, errors);
		} finally {
			settling--;
		}
	}
	if (errors.length) throw errors[0];
}
function run_entry(entry, errors) {
	for (const kid of entry.kids) run_entry(kid, errors);
	entry.done = true;
	const c = entry.c;
	if (c.$fui.destroyed) return;
	try {
		build(c, () => c.mounted());
		mark(c);
		c.$fui.on_ready?.(c);
	} catch (e) {
		errors.push(e);
	}
}

// The view's render effect is running: its render, or the patch of its subtree (a child's setup or
// created() is inside it). Running its job again there would patch the subtree it is patching.
// A lifecycle hook of the view or of a descendant runs outside it (Vue sets currentInstance there,
// which is why the current instance is not the test). EffectFlags.RUNNING is @internal; verify()
// checks it.
const RUNNING = 2;
function patching(instance) {
	return !!(instance.effect && instance.effect.flags & RUNNING);
}

// Child components whose own state changed since they last rendered, parents first. Every component
// of the app notes itself in `due` when its render effect is scheduled (its scheduler is wrapped at
// beforeMount, a global mixin; a view's apart scheduler notes too), so a flush() finds them without
// walking its subtree: a flush with nothing due costs nothing, whatever the size of the view (the
// first v8 build walked every vnode of the subtree on every flush, which made a page's toolbar
// quadratic to build). Only components in the view's own subtree are rendered: those its template
// drew, not controllers drawn with `new` under it. A component the tick has rendered since, or that
// has gone, leaves `due` at the next flush() or after Vue's flush.
const due = new Set();
let due_sweep = false;
function note_due(instance) {
	due.add(instance);
	if (!due_sweep) {
		due_sweep = true;
		queuePostFlushCb(sweep_due);
	}
}
function sweep_due() {
	due_sweep = false;
	for (const instance of due) if (instance.isUnmounted || !instance.effect?.dirty) due.delete(instance);
}
const due_mixin = {
	beforeMount() {
		const instance = this.$;
		const effect = instance.effect;
		const scheduler = effect?.scheduler;
		if (!scheduler || scheduler.notes_due) return;
		const noting = () => {
			note_due(instance);
			scheduler();
		};
		noting.notes_due = true;
		effect.scheduler = noting;
	},
};
// drawn by the view's template: no controller drawn with `new` between it and the view
function in_subtree(instance, view) {
	for (let p = instance; p; p = p.parent) {
		if (p === view) return true;
		if (view_controller.get(p)?.$fui.vnode) return false;
	}
	return false;
}
function flush_below(view) {
	if (!due.size) return;
	const list = [...due];
	if (list.length > 1) list.sort((a, b) => a.uid - b.uid);
	for (const child of list) {
		// the view itself: flush() just ran its job
		if (child === view || child.isUnmounted) {
			due.delete(child);
			continue;
		}
		if (!in_subtree(child, view)) continue;
		due.delete(child);
		if (child.job && !patching(child) && !view_controller.get(child)?.$fui.rendering) child.job();
	}
}

// <script setup> or `setup(self, ctx)`: run inside the view's setup, so provide/inject and hooks
// belong to the view. What it returns reads as this.x.
function run_setups(c, ctx) {
	const setups = c.constructor.setups;
	if (!setups.length) return {};
	const bindings = {};
	for (const setup of setups) {
		const returned = setup(c, ctx) || {};
		const imports = setup_imports.get(setup);
		for (const key of Object.keys(returned)) {
			Object.defineProperty(bindings, key, { ...Object.getOwnPropertyDescriptor(returned, key), enumerable: true });
			if (imports ? imports.has(key) : looks_imported(returned, key)) continue; // its imports are not this.x
			if (!(key in c)) {
				Object.defineProperty(c, key, {
					configurable: true,
					get: () => c.$fui.setup_state[key],
					set: (value) => (c.$fui.setup_state[key] = value),
				});
			}
		}
	}
	c.$fui.setup_state = proxyRefs(bindings);
	c.$fui.setup_bindings = bindings;
	return bindings;
}

// The build may list a file's imports as `__imports` (compileScript's `imports`). Without that list,
// guess from what compileScript returns (from v5): `import { ref } from "vue"` is vue's own `ref` under
// its own name, a .vue import is a compiled component (it has __file), and any other import is a
// getter with no setter (a local `let` has both). Local objects, class instances, local components
// and `const later = nextTick` stay this.x.
const setup_imports = new WeakMap();
function looks_imported(returned, key) {
	const d = Object.getOwnPropertyDescriptor(returned, key);
	if (d.get) return !d.set;
	const v = d.value;
	if (typeof v === "function") return Vue[key] === v;
	if (!v || typeof v !== "object" || isRef(v) || isReactive(v)) return false;
	const proto = Object.getPrototypeOf(v);
	return (proto === Object.prototype || proto === null) && Object.hasOwn(v, "__file");
}

// ------------------------------------------------------------------ views wait apart from Vue's job queue
// A setter on a view's state would queue the view's job (effect.scheduler = () => queueJob(job),
// runtime-core.cjs.js:6332). flush() then runs it early, but the job stays queued, and every child
// component that gets new props during a flush() calls flushPreFlushCbs(child)
// (updateComponentPreRender :6348), which scans the whole queue (:337-360). With n rows set and then
// flushed, that is n x n. So a view's scheduler only notes the view here, and flush() takes it off.
// At the tick, one pre watcher made outside any component (job id -1, so Vue runs it first, getId
// :396) takes the views still waiting, before post-flush hooks, as any component:
//   - a view with no watchers of its own (most: every control) has no pre watcher to wait for: the
//     pulse renders it right there, parents first (uid order), each under Vue's error handling as its
//     own job (one failing patch leaves the others current). Handing those to Vue's queue would put n
//     jobs there at once, and every child that gets new props during their patches scans the queue
//     (flushPreFlushCbs): n x n again;
//   - a view whose effect scope lists watchers besides its render effect goes to the scheduler Vue
//     gave it (queueJob), so it renders at its place in Vue's queue, after its own pre watchers
//     (same id, PRE first).
// FUI_APART=0 keeps Vue's scheduler for every view.
const apart = new Map(); // view instance -> Vue's own scheduler for it
const pulse = shallowRef(0);
let pulsing = false;
watch(
	pulse,
	() => {
		pulsing = false;
		const waiting = [...apart];
		apart.clear();
		if (waiting.length > 1) waiting.sort((a, b) => a[0].uid - b[0].uid);
		for (const [view, vue_schedule] of waiting) {
			const fui = view_controller.get(view)?.$fui;
			if (view.isUnmounted || fui?.unmounted) continue;
			if (fui?.scope?.effects?.length > 1) vue_schedule(); // queueJob(view.job), after its own pre watchers
			else callWithErrorHandling(view.job, view, 15 /* COMPONENT_UPDATE */); // runIfDirty
		}
	},
	{ flush: "pre" }
);
function schedule_apart(instance) {
	const vue_schedule = instance.effect.scheduler;
	instance.effect.scheduler = () => {
		note_due(instance);
		apart.set(instance, vue_schedule);
		if (!pulsing) {
			pulsing = true;
			pulse.value++;
		}
	};
	instance.effect.scheduler.notes_due = true;
}

// ------------------------------------------------------------------ native DOM removal: frappe.ui.sweep()
// jQuery removal is seen as it happens (cleanData below). Native removal (el.remove(), innerHTML,
// Bootstrap's removeChild) is not. sweep() destroys a controller whose top element (or, for a
// placeholder-only view, its host) was in the document at the previous sweep and is not now, unless
// it went out with jQuery's .detach() (the caller means to put it back). The desk calls it at idle
// (frappe.ui.start_sweeping()); the registry holds WeakRefs, so it keeps nothing alive.
//
// Only a controller whose view holds something outside itself is swept: watchers in its effect scope
// besides its render effect (a watch on a store keeps the view alive from the store's side), or
// unmount hooks of its own (they let go of a window listener, a timer, ...). One that holds nothing
// (every control) is collected like any object once nothing references it, and is never destroyed
// on a guess: frappe moves DOM natively and puts it back. The filter popover keeps its rows and
// appends them to a new panel on every open, after removing the old panel with panel.remove(); a
// sweep in between destroyed live filter controls (legacy controls are never destroyed that way).
function holds_outside(c) {
	const view = c.$fui.view;
	if (!view) return false;
	return c.$fui.scope?.effects?.length > 1 || view.bum?.length > 1 || !!view.um?.length;
}
const swept = new Set(); // WeakRef<controller>
const detached_roots = new WeakSet();
function sweep_register(c) {
	if (c.$fui.ref) return;
	c.$fui.ref = new WeakRef(c);
	swept.add(c.$fui.ref);
}
function top_node(c) {
	const el = c.$fui.view?.vnode.el;
	if (el?.nodeType === 1) return el;
	return c.$wrapper?.[0] || c.$fui.host || null;
}
// Out with .detach() and not put anywhere since: the top of the tree the node is in now is an element
// jQuery detached. One that was put back and then went out with something else is not spared (the
// top is then that something else).
function detached_on_purpose(node) {
	let top = node;
	while (top.parentNode) top = top.parentNode;
	return detached_roots.has(top);
}
frappe.ui.sweep = function () {
	const gone = [];
	for (const ref of swept) {
		const c = ref.deref();
		if (!c || c.$fui.destroyed) {
			swept.delete(ref);
			continue;
		}
		const node = top_node(c);
		if (!node || !holds_outside(c)) continue;
		if (node.isConnected) c.$fui.was_connected = true;
		else if (c.$fui.was_connected && !detached_on_purpose(node)) gone.push(c);
	}
	destroy_all(gone);
	return gone.length;
};
frappe.ui.start_sweeping = function (every = 2000) {
	const idle = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 0));
	const tick = () => idle(() => (frappe.ui.sweep(), setTimeout(tick, every)));
	setTimeout(tick, every);
};

// ------------------------------------------------------------------ jQuery removes DOM: the controller goes
// A controller's top elements (its view's root element, and its $wrapper when a legacy subclass built
// its own) carry it. jQuery cleans every element it removes before removing it; a cleaned top
// destroys its controller, and Vue leaves those nodes for jQuery to remove.
function is_top(c, el) {
	return c.$fui.view?.vnode.el === el || (c.$wrapper && c.$wrapper[0] === el);
}
const placeholder_hosts = new WeakMap(); // host -> views that have no element at the top
function mark(c) {
	c = toRaw(c); // a method called through a reactive proxy of the controller
	const fui = c.$fui;
	if (fui.destroyed) return;
	sweep_register(c);
	const el = fui.view?.vnode.el;
	let has_element = false;
	if (el?.nodeType === 1) (el[FUI] = c), (has_element = true);
	const w = c.$wrapper?.[0];
	if (w?.nodeType === 1) (w[FUI] = c), (has_element = true);
	if (fui.host) {
		let here = placeholder_hosts.get(fui.host);
		if (!has_element) (here || placeholder_hosts.set(fui.host, (here = new Set())).get(fui.host)).add(c);
		else here?.delete(c);
	}
}
function unmark(c) {
	c = toRaw(c);
	const el = c.$fui.view?.vnode.el;
	if (el && el[FUI] === c) el[FUI] = null;
	const w = c.$wrapper?.[0];
	if (w && w[FUI] === c) w[FUI] = null;
	if (c.$fui.host) placeholder_hosts.get(c.$fui.host)?.delete(c);
}

const destroying = new WeakSet();
function destroy_all(list) {
	for (const c of list) {
		if (c.$fui.destroyed || destroying.has(c)) continue;
		try {
			c.destroy();
		} catch (e) {
			report(e);
		}
	}
}

function watch_jquery_cleanup() {
	const clean = $.cleanData;
	if (clean.frappe_ui) return;
	$.cleanData = function (elems) {
		let found;
		for (let i = 0, el; (el = elems[i]) != null; i++) {
			const c = el[FUI];
			if (c && !c.$fui.destroyed && !destroying.has(c) && is_top(c, el)) (found ||= []).push(c);
			const here = placeholder_hosts.get(el);
			if (here?.size) (found ||= []).push(...here);
		}
		if (found) renderer.leaving_to_jquery(elems, () => destroy_all(found));
		return clean.apply(this, arguments);
	};
	$.cleanData.frappe_ui = true;
	// .empty()/.html() clean what is inside, never the element: views with no element at their top,
	// drawn straight into it, are found by their host
	// Such a view's unmount takes its DOM natively, before jQuery cleans what is inside, so the
	// controllers in that DOM (frappe.ui.Page's add_field controls, a form's fields) are destroyed
	// here first, as jQuery's cleanData would have destroyed them.
	const clear = (el) => {
		const here = placeholder_hosts.get(el);
		if (!here?.size) return;
		const inside = [];
		for (const n of el.getElementsByTagName("*")) {
			const c = n[FUI];
			if (c && !c.$fui.destroyed && is_top(c, n)) inside.push(c);
			const nested = placeholder_hosts.get(n);
			if (nested?.size) inside.push(...nested);
		}
		destroy_all(inside);
		destroy_all([...here]);
	};
	const empty = $.fn.empty;
	$.fn.empty = function () {
		for (let i = 0; i < this.length; i++) clear(this[i]);
		return empty.apply(this, arguments);
	};
	const detach = $.fn.detach;
	$.fn.detach = function () {
		for (let i = 0; i < this.length; i++) detached_roots.add(this[i]);
		return detach.apply(this, arguments);
	};
	const html = $.fn.html;
	$.fn.html = function (value) {
		if (value !== undefined && typeof value !== "function") for (let i = 0; i < this.length; i++) clear(this[i]);
		return html.apply(this, arguments);
	};
}

// A destroy() override that removes its own DOM through jQuery reaches cleanData, which must not
// call it again: every destroy() on the chain marks the controller while it runs (from v5).
const wrapped = new WeakSet();
function wrap_destroys(proto) {
	for (; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
		const fn = Object.getOwnPropertyDescriptor(proto, "destroy")?.value;
		if (typeof fn !== "function" || wrapped.has(fn)) continue;
		const outer = function (...args) {
			const self = toRaw(this);
			const mine = !destroying.has(self);
			if (mine) destroying.add(self);
			try {
				return fn.apply(this, args);
			} finally {
				if (mine) destroying.delete(self);
			}
		};
		wrapped.add(outer);
		Object.defineProperty(proto, "destroy", { configurable: true, writable: true, value: outer });
	}
}

// ------------------------------------------------------------------ define: .vue options -> class
frappe.ui.define = function (options) {
	const Parent = classes.get(options.extends) || Component;
	const name = options.name.split(".").pop();
	const Class = { [name]: class extends Parent {} }[name];
	const proto = Class.prototype;
	// object-literal methods use `super.x()`: their home object's prototype is the parent's prototype
	const methods = options.methods || {};
	Object.setPrototypeOf(methods, Parent.prototype);
	for (const [key, fn] of Object.entries(methods)) define_hidden(proto, key, fn);
	for (const key of ["created", "mounted"]) if (options[key]) define_hidden(proto, key, options[key]);
	for (const [key, getter] of Object.entries(options.computed || {})) define_field(proto, key, getter);
	// declared state: reads and writes of these keys are reactive; every other field is a plain field
	const own = options.data ? options.data.call(Object.create(proto)) : {};
	for (const key of Object.keys(own)) {
		Object.defineProperty(proto, key, {
			configurable: true,
			get() {
				return this.$fui.state[key];
			},
			set(value) {
				this.$fui.state[key] = value;
			},
		});
	}
	define_hidden(proto, "$initial_data", function () {
		return { ...Parent.prototype.$initial_data.call(this), ...options.data?.call(this) };
	});
	for (const [key, value] of Object.entries(options.static || {})) Class[key] = value;
	// inherit_view: a file that only adds behaviour draws with its parent's template. The desk's
	// esbuild Vue plugin needs a <template> in every .vue (and has no <template extends>), so such a
	// file has an empty one and says so here.
	if (options.render && !options.inherit_view) templates.set(Class, options);
	if (options.setup && options.__imports) setup_imports.set(options.setup, new Set(options.__imports));
	Class.setups = options.setup ? [...Parent.setups, options.setup] : Parent.setups;
	classes.set(options, Class);
	const parts = options.name.split(".");
	const last = parts.pop();
	parts.reduce((o, k) => (o[k] ||= {}), globalThis)[last] = Class;
	return Class;
};
frappe.ui.view_of = view_of;


// A computed reads from the view until a caller assigns its own, as legacy subclasses do (from v5).
// `{ get, set }` keeps a legacy setter as it was (base_control's `set perm()` only logs).
function define_field(proto, key, getter) {
	if (typeof getter === "object") {
		Object.defineProperty(proto, key, { configurable: true, get: getter.get, set: getter.set });
		return;
	}
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

export { Component };
export const get_internals = () => internals;
