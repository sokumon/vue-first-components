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
		self.make(opts);
		if (self.renders()) {
			frappe.ui.views.add(self);
			self.flush();
			self.rendered();
		}
		return self;
	}

	// State the first draw reads.
	make() {}

	renders() {
		return true;
	}

	// Runs once the view is in the document.
	rendered() {}

	get host() {
		return $(this.parent || this.container)[0];
	}

	// The view's root element.
	get el() {
		return view_instance(this)?.subTree.el;
	}

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
	const teleport = frappe.ui.outlet.subTree.children.find((vnode) => vnode.key === controller.uid);
	return teleport?.children?.[0]?.component;
}
