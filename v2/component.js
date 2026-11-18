// The base of a desk class: state and methods only. Its `static view` .vue draws it, from App's tree.
const { shallowReactive } = require("vue");

let uid = 0;
frappe.ui.views = shallowReactive(new Set());

frappe.ui.Component = class Component {
	static view = null;
	static prop = "controller";

	constructor(opts = {}) {
		Object.assign(this, opts);
		const self = shallowReactive(this);
		self.uid = ++uid;
		self.host = opts.parent ? $(opts.parent)[0] : document.createElement("div");
		self.make();
		frappe.ui.views.add(self);
		self.flush();
		return self;
	}

	make() {}

	// Runs the outlet and this view's pending render now, for callers that read the DOM next.
	flush() {
		frappe.ui.outlet.job();
		view_instance(this)?.job();
	}

	destroy() {
		frappe.ui.views.delete(this);
		frappe.ui.outlet.job();
	}
};

function view_instance(controller) {
	const teleport = frappe.ui.outlet.subTree.children.find((v) => v.key === controller.uid);
	return teleport?.children?.[0]?.component;
}
