// What frappe-ui asks of vue-router, answered by the desk's own router. Menu items with `route`
// call router.push; a Button with `route` renders a RouterLink, which resolves the link, reads the
// current route to mark itself active, and calls push on click. Provide it on frappe.ui.app under
// vue-router's own keys (see install below).
//
// A route can be anything frappe.set_route takes: "/desk/todo?status=Open", "todo/x",
// ["List", "ToDo", { status: "Open" }], ["Form", "User", "Administrator"], or a vue-router style
// { path, query, hash }. Named routes ({ name, params }) have no desk equivalent and are refused.
const { shallowRef } = require("vue");

const router = () => window.frappe?.router;

// Runs one of frappe.router's helpers without the frappe.route_options it leaves behind.
function quietly(fn) {
	const saved = frappe.route_options;
	frappe.route_options = null;
	try {
		const value = fn();
		return { value, options: frappe.route_options };
	} finally {
		frappe.route_options = saved;
	}
}

function query_string(query) {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query || {})) {
		for (const v of [].concat(value)) {
			if (v != null) params.append(key, v !== null && typeof v === "object" ? JSON.stringify(v) : String(v));
		}
	}
	const s = params.toString();
	return s ? "?" + s : "";
}

// The absolute URL frappe.set_route(to) would go to, without navigating. `base` is the current
// route, for "?query" and "#hash" routes.
function href_of(to, base) {
	if (typeof to === "string") return absolute(to, base);
	if (Array.isArray(to)) {
		const r = router();
		if (!r?.make_url) return "/desk/" + to.filter((a) => typeof a !== "object").map(encodeURIComponent).join("/");
		const { value: path, options } = quietly(() => r.make_url(r.convert_from_standard_route(r.get_route_from_arguments([to]))));
		return path + query_string(options);
	}
	if (to && typeof to === "object") {
		if (to.path == null && to.fullPath == null) throw new Error(`frappe.ui: no desk route for ${JSON.stringify(to)}`);
		if (to.fullPath != null && to.path == null) return absolute(to.fullPath, base);
		const hash = to.hash ? (to.hash.startsWith("#") ? to.hash : "#" + to.hash) : "";
		return absolute(to.path, base) + query_string(to.query) + hash;
	}
	throw new Error(`frappe.ui: no desk route for ${String(to)}`);
}

// A route string as frappe.set_route reads it: "todo/x", "List/ToDo", "Form/User/x" and
// "/desk/<shell>/todo" all become the URL frappe would push. "?q" and "#h" are relative to the
// current route; other URLs ("https://...", "/files/x.pdf") stay as they are, and push() leaves the
// desk for them.
function absolute(path, base = window.location) {
	if (path.startsWith("?")) return base.pathname + path;
	if (path.startsWith("#")) return base.pathname + base.search + path;
	if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;
	if (path.startsWith("/") && !/^\/(desk|app)(\/|$|\?|#)/.test(path)) return path;
	const hash_at = path.indexOf("#");
	const hash = hash_at >= 0 ? path.slice(hash_at) : "";
	const rest = hash_at >= 0 ? path.slice(0, hash_at) : path;
	const query_at = rest.indexOf("?");
	const search = query_at >= 0 ? rest.slice(query_at) : "";
	const route = query_at >= 0 ? rest.slice(0, query_at) : rest;
	const r = router();
	if (!r?.make_url) return (route.startsWith("/") ? route : "/desk/" + route) + search + hash;
	// keeps a shell the route names, as set_route does ("/desk/build/user" stays in Build)
	const { value } = quietly(() => {
		const { route: parts, shell } = r.read_route_arguments([route]);
		const url = r.make_url(r.convert_from_standard_route(parts));
		return r.keep_shell_moved_into ? r.keep_shell_moved_into(url, shell) : url;
	});
	return value + search + hash;
}

// A URL the desk router handles: same origin, under /desk or /app.
function in_desk(href) {
	const url = new URL(href, window.location.origin);
	return url.origin === window.location.origin && /^\/(desk|app)(\/|$)/.test(url.pathname);
}

// The shell a desk URL names, if any.
function shell_of(href) {
	const r = router();
	if (!r?.read_route_arguments) return null;
	return quietly(() => r.read_route_arguments([new URL(href, window.location.origin).pathname]).shell).value;
}

// Where a URL lands in the desk, without the shell or /desk prefix: "/desk/build/todo" and
// "/desk/todo" are the same place.
function route_key(href) {
	const path = new URL(href, window.location.origin).pathname;
	const r = router();
	if (!r?.read_route_arguments) return path.replace(/\/$/, "");
	return quietly(() => r.read_route_arguments([path]).route.join("/")).value;
}

// One stand-in route record per desk route, so RouterLink can tell when it points at the current page.
const records = new Map();
function record_for(key) {
	if (!records.has(key)) records.set(key, { path: "/" + key, name: undefined, meta: {}, children: [], aliasOf: undefined, components: {}, props: {}, instances: {}, leaveGuards: new Set(), updateGuards: new Set(), enterCallbacks: {} });
	return records.get(key);
}

function location_of(href) {
	const url = new URL(href, window.location.origin);
	const query = {};
	for (const [k, v] of url.searchParams) query[k] = k in query ? [].concat(query[k], v) : v;
	const desk = in_desk(url.href);
	const fullPath = url.origin === window.location.origin ? url.pathname + url.search + url.hash : url.href;
	const key = desk ? route_key(fullPath) : "url:" + url.href; // a file or another site is never the current desk page
	return { path: url.pathname, fullPath, href: fullPath, query, hash: url.hash, params: {}, meta: {}, name: undefined, redirectedFrom: undefined, matched: [record_for(key)] };
}

// Whether the desk already shows `href`: the same route and query, in the shell on screen.
function showing(href) {
	if (!in_desk(href)) return false;
	const here = new URL(window.location.href);
	const there = new URL(href, window.location.origin);
	const shell = shell_of(there.href);
	if (shell && shell !== router()?.current_shell) return false;
	const same_query = [...new URLSearchParams(here.search)].sort().join("&") === [...new URLSearchParams(there.search)].sort().join("&");
	return route_key(here.href) === route_key(there.href) && same_query;
}

// Whether the desk is still at the URL set_route pushed (whatever shell it has written in since).
function showing_same(pushed) {
	const now = new URL(window.location.href);
	const then = new URL(pushed);
	const query = (u) => [...u.searchParams].sort().join("&");
	return route_key(now.href) === route_key(then.href) && query(now) === query(then);
}

const after_this_event = () => new Promise((resolve) => setTimeout(resolve, 0));

function create_desk_router() {
	const current_route = shallowRef(location_of(window.location.href));
	const sync = () => (current_route.value = location_of(window.location.href));
	router()?.on?.("change", sync);
	window.addEventListener("popstate", sync);

	const navigate = async (to, replace) => {
		const href = href_of(to, window.location); // throws, so the promise rejects, for a route the desk can't take
		// a file, another site: leave the desk (RouterLink has already stopped the browser doing it)
		if (!in_desk(href) || typeof frappe?.set_route !== "function") {
			return replace ? window.location.replace(href) : window.location.assign(href);
		}
		// A RouterLink click on an <a> also reaches frappe's body-level link handler, which routes
		// from the href, unless something stopped the click on the way. Let the event finish, and
		// route only if nothing moved and the desk isn't there yet, so a click navigates exactly
		// once either way. (A push to the page already showing changes at most its hash.)
		// frappe's handler puts a hash before the query, though; such a link is routed here instead.
		const [path, hash] = href.split("#");
		if (!replace) {
			const event = window.event;
			const link_click = event?.type === "click" && event.currentTarget?.tagName === "A";
			if (link_click && hash && path.includes("?")) event.stopPropagation();
			else {
				const before = window.location.href;
				await after_this_event();
				if (window.location.href !== before) return sync();
				if (showing(href)) {
					if (("#" + (hash || "")).replace(/^#$/, "") !== window.location.hash) {
						// a new hash on the same page: a history entry, and hashchange for a form's tabs
						if (hash) window.location.hash = hash;
						else history.pushState(history.state, "", window.location.pathname + window.location.search);
					}
					return sync();
				}
			}
		}
		if (replace) (frappe.route_flags ||= {}).replace_route = true;
		// arrays go through as arrays: frappe reads route_options and Form names from them
		const pending = frappe.set_route(Array.isArray(to) ? to : path);
		const pushed = window.location.href; // set_route pushes its URL before it resolves
		await pending;
		// set_route would put a route_hash before the query; the hash goes on after it, and only if
		// the desk is still where this push took it
		if (hash && showing_same(pushed)) history.replaceState(history.state, "", window.location.pathname + window.location.search + "#" + hash);
		sync();
	};
	return {
		currentRoute: current_route,
		options: {},
		resolve: (to) => location_of(href_of(to, new URL(current_route.value.fullPath, window.location.origin))),
		push: (to) => navigate(to, false),
		replace: (to) => navigate(to, true),
		back: () => history.back(),
		go: (n) => history.go(n),
		isReady: () => Promise.resolve(),
	};
}

// keys: { routerKey, routeLocationKey } from the vue-router copy frappe-ui was built with
function install(app, keys) {
	const desk_router = create_desk_router();
	if (keys.routerKey) app.provide(keys.routerKey, desk_router);
	if (keys.routeLocationKey) {
		const live = {};
		for (const key of Object.keys(location_of("/"))) {
			Object.defineProperty(live, key, { enumerable: true, get: () => desk_router.currentRoute.value[key] });
		}
		app.provide(keys.routeLocationKey, live);
	}
	return desk_router;
}

module.exports = { create_desk_router, install, href_of, location_of };
