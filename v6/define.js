// Turns a compiled .vue's options into its frappe.ui class. The build calls this; nobody writes it.
const { shallowReactive, getCurrentInstance, effectScope, proxyRefs } = require("vue");

let uid = 0;
frappe.ui.views = shallowReactive(new Set());

class Component {
	static setups = [];

	constructor(opts = {}) {
		Object.assign(this, this.$initial_data(), opts);
		const self = shallowReactive(this);
		self.uid = ++uid;
		self.$run_setup();
		self.created();
		if (self.renders()) {
			frappe.ui.views.add(self);
			self.flush();
			self.mounted();
		}
		return self;
	}

	$initial_data() {
		return {};
	}

	// Runs the file's <script setup>; what it declares reads as `this.x` in methods.
	$run_setup() {
		this.$scope = effectScope();
		this.$setup_state = {};
		this.$scope.run(() =>
			frappe.ui.app.runWithContext(() => {
				for (const setup of this.constructor.setups) {
					const bindings = setup(this, { expose() {} });
					for (const key of Object.keys(bindings)) bind_setup_field(this, key);
					Object.assign(this.$setup_state, bindings);
				}
			})
		);
		this.$setup_state = proxyRefs(this.$setup_state);
	}

	created() {}

	mounted() {}

	renders() {
		return true;
	}

	get host() {
		return $(this.parent || this.container)[0];
	}

	get $el() {
		return view_instance(this)?.subTree.el;
	}

	get frappe() {
		return frappe;
	}

	__(...args) {
		return __(...args);
	}

	// Runs the outlet and this view's pending render now, for callers that read the DOM next.
	flush() {
		frappe.ui.outlet.job();
		view_instance(this)?.job();
	}

	destroy() {
		this.$scope.stop();
		frappe.ui.views.delete(this);
		frappe.ui.outlet.job();
	}
}

function bind_setup_field(controller, key) {
	if (key in controller) return;
	Object.defineProperty(controller, key, {
		configurable: true,
		get: () => controller.$setup_state[key],
		set: (value) => (controller.$setup_state[key] = value),
	});
}

function view_instance(controller) {
	const teleport = frappe.ui.outlet.subTree.children.find((vnode) => vnode.key === controller.uid);
	return teleport?.children?.[0]?.component;
}

const classes = new WeakMap();

frappe.ui.define = function (options) {
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
	if (options.render) Class.view = view_for(options);
	Class.setups = options.setup ? [...Parent.setups, options.setup] : Parent.setups;

	classes.set(options, Class);
	assign_path(options.name, Class);
	return Class;
};

function view_for(options) {
	return {
		name: options.name,
		props: ["controller"],
		setup(props) {
			const instance = getCurrentInstance();
			const { controller } = props;
			return () =>
				options.render(controller, instance.renderCache, controller, controller.$setup_state, controller, controller);
		},
	};
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
