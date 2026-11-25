// Design sketch only (not applied anywhere). Glue-level changes for B-es-tags/desk/es_link.bundle.js.
// Ids match the proposals: G1 Select idle options, G2 lazy Select, G3 batched mounts, G5 coalesced Select sync.

// ---------------------------------------------------------------- G1: Select "idle options"
// While the es-select is neither focused nor open it renders with only the selected option (or none):
// reka renders the closed list's items into a DocumentFragment to collect them, which is what makes
// mount and every value change cost ~1 ms per option (and the quadratic flushPreFlushCbs scan).
// frappe-ui's trigger label comes from its own `selectedOption` (computed from props.options), so
// one option shows the same label. The full list is pushed (and flushed synchronously) on pointerenter,
// pointerdown (capture, before reka's trigger handler opens the list) and focusin (before typeahead keys).
// host.options keeps reading the FULL list (b-ui check 3 reads _es_host.options): an own accessor on
// the host instance shadows the prototype one and calls it for the rendered value.
const proto_options = Object.getOwnPropertyDescriptor(customElements.get("es-select").prototype, "options");
function idle_options(host) {
	let full = [];
	let expanded = false;
	const render = () => {
		const v = host.modelValue;
		proto_options.set.call(host, expanded ? full : full.filter((o) => o.value === v).slice(0, 1));
	};
	Object.defineProperty(host, "options", {
		configurable: true,
		get: () => full,
		set(v) { full = v || []; render(); },
	});
	host._es_render_options = render; // called by sync_select after a modelValue change while collapsed
	const expand = () => { if (expanded) return; expanded = true; render(); ES.flush(); };
	host.addEventListener("pointerenter", expand);
	host.addEventListener("pointerdown", expand, true);
	host.addEventListener("focusin", expand, true);
	// collapse lazily: only when the next value/options change arrives while idle, so the shrink rides on
	// a render that was going to happen anyway (no extra render on blur)
	host._es_idle = () => !host._es_open && !host.contains(document.activeElement) && !host.matches(":hover");
	host.addEventListener("update:open", (e) => (host._es_open = !!e.detail));
	return {
		maybe_collapse() { if (expanded && host._es_idle()) expanded = false; render(); },
	};
}
// sync_select: after setting host.modelValue, call ctl._es_idle.maybe_collapse() instead of relying on
// the options setter alone (the selected option changes with the value even when the list does not).

// ---------------------------------------------------------------- G2 + G3: one lazy scheduler, batched mounts
// Select pending state = the legacy <select> exactly as legacy draws it (no es-select-control class, so
// glue.css does not hide it): no stand-in markup at all, $input is already the real thing.
// Mount triggers: rAF visibility check (before first paint), IntersectionObserver, focus/pointerdown on the
// native <select>, `show.bs.modal` (re-queues the rAF check so dialog fields mount before the dialog's
// first frame), and a lazy getter on ctl._es_host (forced, as Link's LAZY_KEYS).
const lazy = new Set(); // Link and Select controls
function mount_batch(ctls) {
	// phase 1 inside ES.batch: create + connect hosts; onConnect/addTop/insert_host only queue renders
	ES.batch(() => ctls.forEach((c) => c.es_prepare()));
	// ES.batch rendered every new bucket/host once, parents first; now the inner <input>/<button> exist
	ctls.forEach((c) => c.es_finish()); // Link: $input/route_value/handlers/es_setup_combobox; Select: listeners
}
function run_check() {
	const shown = [];
	for (const c of lazy) if (c._es_anchor().getClientRects().length) shown.push(c); // one forced layout
	for (const c of shown) lazy.delete(c);
	// time-slice what the IntersectionObserver delivers after the first frame (dialogs, scroll) at ~8 ms
	// per task; the rAF (pre-paint) path mounts everything it found at once so the first frame is final
	mount_batch(shown);
}
// Link.make_input (eager) splits at insert_host(host):
//   es_prepare(): build host + $lf, prepend into input_area, insert_host(host)     [renders deferred]
//   es_finish():  $input = $(host).find("input").first() ... es_setup_combobox, bind_change_event
// Single forced mounts (getter, focus) keep calling prepare+finish back to back outside ES.batch.

// ---------------------------------------------------------------- G5: coalesced Select mirroring
// One MutationObserver for all Selects (target -> ctl in a WeakMap) and one microtask per burst:
const sel_mo = new MutationObserver((recs) => { for (const r of recs) queue_sync(owner_of(r.target)); });
const sync_q = new Set();
function queue_sync(ctl) {
	if (!ctl || !ctl._es_host) return;
	if (!sync_q.size) queueMicrotask(() => { const l = [...sync_q]; sync_q.clear(); l.forEach(sync_select); });
	sync_q.add(ctl);
}
// change/select-change handlers and the set_formatted_input wrapper call queue_sync; the trailing
// sync_select(this) in make_input is dropped (options/value were set on the host before its first render).
// The microtask runs before the runtime's dirty-flush microtask it queues, so the render stays one batch.
// ES.flush() callers that need the mirror now (none in Desk; b-ui waits 50 ms) can call flush_sync().
