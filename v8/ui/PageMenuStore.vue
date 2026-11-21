<!--
One of a page's hidden menu stores (the Menu, the Actions menu, a custom button group's): the
<ul class="dropdown-menu"> page.js's add_dropdown_item() wrote <li><a class="grey-link dropdown-item">
rows into, drawn from the store's state. frappe.ui.Dropdown reads these rows on every open
(Page.build_dropdown_options), so callers that hold a returned <a> and call .text() / .toggle() /
.addClass("disabled") on it still change what the menu shows.

Rows: in the order legacy put them in the <ul>. The store's `head` holds the user items and the
user-action divider: a user item goes before that divider, which is put first when the store has
none (legacy: `parent.find(".dropdown-divider.user-action")`, else prependTo(parent)), so a caller
who removed the divider gets legacy's order back: new user items, a new divider, then what was there.
Its `rows` hold the standard items and add_divider()'s dividers, appended. v-part records each row
into the page's $parts.

Its own component so that adding a row renders this list, not the whole page (a form's refresh
adds a dozen). A row is drawn once (v-memo): adding the next one does not patch the ones already
there. The rows are plain elements, not a component each: a component per row cost more than the
row, and a directive (v-part) on a component's vnode makes Vue update it on every render.
-->
<script>
import Icon from "./Icon.vue";
import { tail } from "./anchors.js";

export default {
	name: "PageMenuStore",
	components: { Icon },
	directives: { tail },
	props: {
		store: { type: Object, required: true },
		ul_class: { type: String, default: "dropdown-menu" },
	},
	methods: {
		// store.head / store.rows are plain arrays; store.rev counts their changes, and the render reads
		// it here. Not a computed: it would return the same array after a change, and a computed whose
		// value did not change does not render its readers
		part(name) {
			return this.store.rev, this.store[name];
		},
		row_class(it) {
			if (it.divider) return it.user ? "dropdown-divider user-action visible-xs" : "dropdown-divider";
			if (it.user) return it.hidden_xl ? "user-action hidden-xl" : "user-action";
			return it.hidden_xl ? "hidden-xl" : undefined;
		},
		// the legacy handler: (e) => { if (e.ctrlKey || e.metaKey) open_in_new_tab = true; return click(); }
		activate(item, e) {
			if (e.ctrlKey || e.metaKey) {
				frappe.open_in_new_tab = true;
			}
			const click = item.click;
			if (click() === false) {
				e.preventDefault();
				e.stopPropagation();
			}
		},
	},
};
</script>

<template>
	<ul v-part:[store.key] v-tail :class="ul_class" role="presentation">
		<li v-for="it in part('head')" :key="it.key" v-memo="[it.hidden_xl]" v-part:[it.key] :class="row_class(it)">
			<a v-if="!it.divider" class="grey-link dropdown-item" href="#" onclick="return false;" @click="activate(it, $event)">
				<span v-if="it.icon" class="menu-item-icon flex align-items-center justify-items-center"><Icon :name="it.icon" /></span>
				<span class="menu-item-label" :data-label="it.data_label" v-html="it.label"></span>
				<span v-if="it.shortcut_label" class="menu-item-shortcut" v-html="it.shortcut_label"></span>
			</a>
		</li>
		<li v-for="it in part('rows')" :key="it.key" v-memo="[it.hidden_xl]" v-part:[it.key] :class="row_class(it)">
			<a v-if="!it.divider" class="grey-link dropdown-item" href="#" onclick="return false;" @click="activate(it, $event)">
				<span v-if="it.icon" class="menu-item-icon flex align-items-center justify-items-center"><Icon :name="it.icon" /></span>
				<span class="menu-item-label" :data-label="it.data_label" v-html="it.label"></span>
				<span v-if="it.shortcut_label" class="menu-item-shortcut" v-html="it.shortcut_label"></span>
			</a>
		</li>
	</ul>
</template>
