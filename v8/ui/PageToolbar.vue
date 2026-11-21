<!--
A page's toolbar containers, .custom-actions and .custom-mobile-actions (page.html), with what page.js
appended into them: add_inner_message()'s message, then the entries (PageToolbarEntry: inner buttons,
add_button()s, inner button groups, custom button groups). Its own component so that adding a button
renders the toolbar, not the whole page; each entry is a component too, so that render only lists
them. The state is the page's (toolbar_items / mobile_groups, inner_message); v-part records every
element into the page's $parts.
-->
<script>
import PageToolbarEntry from "./PageToolbarEntry.vue";
import { tail } from "./anchors.js";

export default {
	name: "PageToolbar",
	components: { PageToolbarEntry },
	directives: { tail },
	props: {
		page: { type: Object, required: true },
		mobile: { type: Boolean, default: false },
	},
};
</script>

<template>
	<div v-if="mobile" v-part:custom_mobile_actions v-tail class="custom-mobile-actions">
		<PageToolbarEntry v-for="e in page.mobile_groups" :key="e.key" :e="e" />
	</div>
	<div
		v-else
		v-part:custom_actions
		v-tail
		class="custom-actions hidden-xs hidden-md"
		:class="{ hide: !page.toolbar_shown }"
	>
		<span
			v-if="page.inner_message !== null"
			:key="page.inner_message_gen"
			v-part:inner_message
			class="inner-page-message text-muted small"
			v-html="page.inner_message"
		></span>
		<PageToolbarEntry v-for="e in page.toolbar_items" :key="e.key" :e="e" />
	</div>
</template>
