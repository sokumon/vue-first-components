// Vue keeps empty text nodes (a list's start and end anchors) and comments (a v-if placeholder) in
// the elements it draws children into. Legacy callers replace the content of those elements
// (page.menu.empty(), $breadcrumbs.empty(), btn_primary.html(...), system_console.js's
// `$btn.text(__("Executing..."))`, el.innerHTML = ...), and the next render needs those nodes: a
// patch that meets a removed anchor throws, and leaves the component's render broken for good.
// Elements marked here get them back, in their order, after any write that replaces their content:
// jQuery's .empty() / .html(x) / .text(x), and the native textContent / innerHTML / innerText /
// replaceChildren() underneath them. What the write removed goes as before: jQuery cleans it
// (cleanData drops template-drawn items from the page's state), and a native write is cleaned the
// same way, so state and DOM agree whichever way a caller cleared the element.
//
//   v-keep   marks an element whose children Vue patches
//   v-tail   v-keep, and the list that ends the element appends new items at the element's end,
//            after content legacy code appended there (frappe's renderer skips an anchor marked TAIL)
const TAIL = Symbol.for("frappe.ui.append_at_end");
const marked = new WeakSet();

export const keep = {
	created(el) {
		marked.add(el);
	},
};
export const tail = {
	created(el, binding, vnode) {
		marked.add(el);
		const kids = vnode.children;
		const last = Array.isArray(kids) && kids[kids.length - 1];
		if (last && last.anchor && last.anchor.nodeType === 3) last.anchor[TAIL] = true;
	},
};

const vue_nodes = (el) => [...el.childNodes].filter((n) => (n.nodeType === 3 && n.data === "") || n.nodeType === 8);

// jQuery cleans before it writes; a native write inside a jQuery call must not clean again
let in_jquery = 0;

function keep_anchors(name) {
	const fn = $.fn[name];
	if (fn.frappe_ui_anchors) return;
	$.fn[name] = function (value) {
		// getters: .html(), .text(), and .html(fn)/.text(fn), which call the setter themselves
		if (name !== "empty" && (arguments.length === 0 || value === undefined || typeof value === "function"))
			return fn.apply(this, arguments);
		const kept = [];
		for (let i = 0; i < this.length; i++) if (marked.has(this[i])) kept.push([this[i], vue_nodes(this[i])]);
		in_jquery++;
		let out;
		try {
			out = fn.apply(this, arguments);
		} finally {
			in_jquery--;
		}
		for (const [el, nodes] of kept) for (const n of nodes) el.appendChild(n);
		return out;
	};
	$.fn[name].frappe_ui_anchors = true;
}
keep_anchors("empty");
keep_anchors("html");
keep_anchors("text");

// the native writes: every one of them removes all children
function before_native_clear(el) {
	const nodes = vue_nodes(el);
	if (!in_jquery && el.firstElementChild) $.cleanData(el.getElementsByTagName("*"));
	return nodes;
}
function keep_on_set(proto, prop) {
	const d = Object.getOwnPropertyDescriptor(proto, prop);
	if (!d || !d.set || d.set.frappe_ui_anchors) return;
	const set = function (value) {
		if (!marked.has(this)) return d.set.call(this, value);
		const nodes = before_native_clear(this);
		d.set.call(this, value);
		for (const n of nodes) this.appendChild(n);
	};
	set.frappe_ui_anchors = true;
	Object.defineProperty(proto, prop, { ...d, set });
}
keep_on_set(Node.prototype, "textContent");
keep_on_set(Element.prototype, "innerHTML");
keep_on_set(HTMLElement.prototype, "innerText");
{
	const replace = Element.prototype.replaceChildren;
	if (replace && !replace.frappe_ui_anchors) {
		Element.prototype.replaceChildren = function () {
			if (!marked.has(this)) return replace.apply(this, arguments);
			const nodes = before_native_clear(this);
			const out = replace.apply(this, arguments);
			for (const n of nodes) this.appendChild(n);
			return out;
		};
		Element.prototype.replaceChildren.frappe_ui_anchors = true;
	}
}

// what a caller put before Vue's first anchor (after .html(x) the kept anchors follow it): legacy
// rebuilt such an element's content, so it goes
export function drop_before_anchors(el) {
	if (!el) return;
	while (el.firstChild && !(el.firstChild.nodeType === 3 && el.firstChild.data === "") && el.firstChild.nodeType !== 8) {
		if (el.firstChild.nodeType === 1) $(el.firstChild).remove();
		else el.firstChild.remove();
	}
}
