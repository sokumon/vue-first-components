// The only place the classes touch Vue internals. Vue has no public API for any of these:
//
//   settle(instance)            what flush() does: bring a view's DOM and its post-flush work up to
//                               date synchronously, the way a whole scheduler tick would
//   run_pending_renders(view)   run a component's queued render now, and those of its descendants
//                               (a <Transition> or a slot reads the same state and queues its own job)
//   flush_queues()              drain the pre queue (watchers) and post queue (enter hooks,
//                               onMounted/onUpdated, template refs)
//   drop_mount_hooks(instance)  forget a view's onBeforeMount/onMounted hooks
//   root_nodes(instance)        the DOM nodes at the top of a view, through child components
//   schedule_apart(instance)    queue a view's re-renders outside Vue's scheduler queue
//
// They rely on `instance.job`, `instance.effect` (`dirty`, `flags`, `scheduler`), `instance.scope`,
// `instance.subTree`, `instance.bm`/`m`, and
// on render() draining the pre/post queues before it returns (true since Vue 3.4). verify() checks
// them against the loaded Vue at startup, so an upgrade that changes them fails loudly instead of
// leaving flush() quietly a tick late.
const Vue = require("vue");
const { h, ref, watch, queuePostFlushCb, handleError, ErrorCodes, render: dom_render } = Vue;

const TESTED = /^3\.5\./;
const RECURSION_LIMIT = 100;
const RUNNING = 2; // EffectFlags.RUNNING

// True when a render ran.
function run_pending_renders(instance) {
	if (!instance.job) return false; // still in setup: nothing has rendered yet
	let ran = false;
	const visit = (inst) => {
		// skip a render that is running: flush() called from inside a template would re-enter it
		if (inst.effect && !(inst.effect.flags & RUNNING) && inst.effect.dirty) {
			inst.job();
			ran = true;
		}
		walk(inst.subTree);
	};
	const walk = (vnode) => {
		if (!vnode || typeof vnode !== "object") return;
		if (vnode.component) return visit(vnode.component);
		if (vnode.suspense) return walk(vnode.suspense.activeBranch);
		if (Array.isArray(vnode.children)) for (const c of vnode.children) walk(c);
	};
	visit(instance);
	return ran;
}

// render(null, el) on an empty container patches nothing, then flushes the pre and post queues.
// Each renderer skips that while it is itself flushing, so both are asked. Inside a running post
// flush (an onMounted, a flush:"post" watcher) Vue appends the work to that flush, so it lands when
// the flush ends, before whatever started it returns.
let drain_box;
function flush_queues(render = dom_render) {
	drain_box ||= document.createDocumentFragment();
	render(null, drain_box);
	if (render !== dom_render) dom_render(null, drain_box);
}

// Watchers run, the view and its children render, post work runs, and again while a watcher or a
// hook (onUpdated measuring the DOM, say) changed state the view shows.
function settle(instance, render) {
	flush_queues(render);
	for (let n = 0; run_pending_renders(instance); n++) {
		flush_queues(render);
		if (n === RECURSION_LIMIT) {
			console.error("frappe.ui: flush() gave up, a watcher or hook keeps changing what the view renders");
			break;
		}
	}
}

// Vue keeps one queue of render jobs for the page, and draining its pre queue (which flush() must do,
// for watchers) scans all of it. A job that flush() ran early stays in it until the tick ends. With
// every view in that queue, setting 3000 rows and then flushing each costs 3000 x 3000. So a view's
// re-renders queue here instead, and Vue's queue holds one job for all of them: a pre watcher made
// outside any component, which Vue runs ahead of every component's job in the tick, so views still
// render before the components inside them.
//
// A view with watchers of its own keeps Vue's scheduler: Vue runs a component's pre watchers before
// its render, and a watcher that fixes state up before the render (an index past a shortened list)
// relies on that. Once the shared job has run in a tick, a view dirtied again in the same tick also
// goes through Vue's scheduler, so the shared job never runs twice in a flush (Vue's dev build
// would count that against its recursion limit and drop it).
const apart = new Set();
let apart_scheduled = false;
let pulsed = false; // the shared job has run in the Vue flush that is running now
const pulse = ref(0);
watch(pulse, flush_apart, { flush: "pre" });

// Decided each time the view is scheduled: a watcher made later (in onMounted, in a nested
// effectScope) counts too, and a view whose watchers stopped goes back to the shared job.
function has_watchers(scope, render_effect) {
	return scope.effects.some((e) => e !== render_effect) || (scope.scopes || []).some((s) => has_watchers(s, render_effect));
}

function schedule_apart(instance) {
	const vue_scheduler = instance.effect.scheduler;
	instance.effect.scheduler = () => {
		if (pulsed || has_watchers(instance.scope, instance.effect)) return vue_scheduler();
		apart.add(instance);
		if (!apart_scheduled) {
			apart_scheduled = true;
			pulse.value++;
		}
	};
}

function flush_apart() {
	apart_scheduled = false;
	if (!pulsed) {
		pulsed = true;
		queuePostFlushCb(() => (pulsed = false));
	}
	const views = [...apart].sort((a, b) => a.uid - b.uid);
	apart.clear();
	for (const view of views) {
		if (view.isUnmounted) continue;
		// one view's error doesn't keep the others stale, and goes where Vue sends render errors
		try {
			view.job();
		} catch (e) {
			handleError(e, view, ErrorCodes.SCHEDULER);
		}
	}
}

function drop_mount_hooks(instance) {
	instance.bm = instance.m = null;
}

function root_nodes(instance) {
	const nodes = [];
	const walk = (vnode) => {
		if (!vnode || vnode.type?.__isTeleport) return; // a portal's content isn't this view's root
		if (vnode.component) return walk(vnode.component.subTree);
		if (Array.isArray(vnode.children) && typeof vnode.type === "symbol") return vnode.children.forEach(walk); // fragment
		if (vnode.el) nodes.push(vnode.el);
	};
	walk(instance.subTree);
	return nodes;
}

// Every DOM node at the top of a view, in order, fragment and Teleport anchors included: what Vue
// expects to find side by side when it removes the view.
function top_nodes(instance) {
	const out = [];
	const walk = (vnode) => {
		if (!vnode) return;
		if (vnode.component) return walk(vnode.component.subTree);
		const fragment = typeof vnode.type === "symbol" && Array.isArray(vnode.children);
		if (vnode.el) out.push(vnode.el);
		if (fragment) vnode.children.forEach(walk);
		if (vnode.anchor && (fragment || vnode.type?.__isTeleport)) out.push(vnode.anchor);
	};
	walk(instance.subTree);
	return out;
}

// The child components the walk to the view's top-level nodes goes through: when one of them
// re-renders by itself, the view's top can change without the view rendering.
function root_components(instance) {
	const out = [];
	const walk = (vnode) => {
		if (!vnode || vnode.type?.__isTeleport) return;
		if (vnode.component) {
			out.push(vnode.component);
			return walk(vnode.component.subTree);
		}
		if (Array.isArray(vnode.children) && typeof vnode.type === "symbol") vnode.children.forEach(walk);
	};
	walk(instance.subTree);
	return out;
}

// The outermost elements of each DOM region a view draws: its top-level elements and the content
// of every Teleport in it. Everything else it owns in the DOM is inside one of them.
function element_regions(instance) {
	const out = [];
	const walk = (vnode, inside) => {
		if (!vnode || typeof vnode !== "object") return;
		if (vnode.component) return walk(vnode.component.subTree, inside);
		if (vnode.suspense) return walk(vnode.suspense.activeBranch, inside);
		if (vnode.type?.__isTeleport) {
			if (Array.isArray(vnode.children)) for (const c of vnode.children) walk(c, false);
			return;
		}
		const is_el = vnode.el?.nodeType === 1 && typeof vnode.type === "string";
		if (is_el && !inside) out.push(vnode.el);
		if (Array.isArray(vnode.children)) for (const c of vnode.children) walk(c, inside || is_el);
	};
	walk(instance.subTree, false);
	return out;
}

// Mounts a view whose child renders a slot that reads state the view itself doesn't (what a
// <Transition> does) and a watcher that feeds it, changes the state, and expects the DOM updated
// and post-flush work done when settle returns.
function verify(render = dom_render) {
	const problems = [];
	if (!TESTED.test(Vue.version)) problems.push(`untested Vue ${Vue.version}`);
	try {
		const q = ref("");
		const shown = ref("");
		const log = [];
		const Child = { setup: (_, { slots }) => () => h("div", slots.default()) };
		const View = {
			setup() {
				watch(q, (v) => (shown.value = v + "!"));
				return () => h(Child, null, { default: () => (shown.value ? h("p", shown.value) : null) });
			},
		};
		const box = document.createDocumentFragment();
		const vnode = h(View);
		render(vnode, box);
		const instance = vnode.component;
		for (const key of ["job", "subTree", "effect", "scope", "m"]) if (!(key in instance)) problems.push(`instance.${key} missing`);
		if (typeof instance.effect?.scheduler !== "function") problems.push("instance.effect.scheduler missing");
		if (typeof instance.effect?.flags !== "number") problems.push("instance.effect.flags missing");
		q.value = "x";
		queuePostFlushCb(() => log.push("post"));
		settle(instance, render);
		if (box.querySelector("p")?.textContent !== "x!") problems.push("a watcher or a child's queued render did not run");
		if (!log.includes("post")) problems.push("render() no longer drains the post-flush queue");
		if (root_nodes(instance)[0] !== box.querySelector("div")) problems.push("root_nodes doesn't find the root");
		render(null, box);
	} catch (e) {
		problems.push(String(e));
	}
	if (problems.length) console.error(`frappe.ui: flush() may run a tick late on this Vue: ${problems.join("; ")}`);
	return problems;
}

module.exports = { settle, run_pending_renders, flush_queues, drop_mount_hooks, root_nodes, top_nodes, root_components, element_regions, schedule_apart, verify };
