<!--
One entry of a page's toolbar (PageToolbar): an inner button or add_button() (EsButton), an inner
button group (a button and the hidden .dropdown-menu store of <a> items), or a custom button group
(a button and a PageMenuStore). Its own component so that adding an entry, or an item to one group,
renders that entry and not every entry of the toolbar: the toolbar's render only lists the entries,
and each entry's props are the same object as before, so Vue skips the ones that did not change.
v-part records every element into the page's $parts.
-->
<script>
import EsButton from "./EsButton.vue";
import PageMenuStore from "./PageMenuStore.vue";
import { tail } from "./anchors.js";

export default {
	name: "PageToolbarEntry",
	components: { EsButton, PageMenuStore },
	directives: { tail },
	props: {
		e: { type: Object, required: true },
	},
};
</script>

<template>
	<EsButton v-if="e.kind === 'button'" :part="e.key" v-bind="e.button" />
	<div
		v-else-if="e.kind === 'group'"
		v-part:[e.key]
		class="inner-group-button"
		:class="{ hide: e.hidden }"
		:data-label="e.data_label"
	>
		<EsButton :part="`${e.key}:btn`" class="ellipsis" :label="e.label" icon_right="chevrons-up-down" :variant="e.variant" />
		<div v-tail role="presentation" class="dropdown-menu" :class="{ 'dropdown-menu-right': e.align_right }">
			<template v-for="it in e.items" :key="it.key">
				<li v-if="it.divider" v-part:[it.key] class="dropdown-divider"></li>
				<a
					v-else
					v-part:[it.key]
					:class="it.cls"
					href="#"
					onclick="return false;"
					:data-label="it.data_label"
					@click="it.action.call($event.currentTarget, $event)"
					v-html="it.label"
				></a>
			</template>
		</div>
	</div>
	<div
		v-else-if="e.kind === 'custom_group'"
		v-part:[e.key]
		class="custom-btn-group"
		:class="{ hide: e.store.hidden, 'hidden-xl': e.store.hidden_xl }"
	>
		<EsButton
			:part="`${e.key}:btn`"
			class="ellipsis"
			:label="e.label"
			:icon="e.icon"
			icon_right="chevrons-up-down"
			:label_class="e.icon ? 'custom-btn-group-label hidden-xs' : 'custom-btn-group-label'"
			:icon_right_class="e.icon ? 'hidden-xs' : ''"
		/>
		<PageMenuStore :store="e.store" />
	</div>
</template>
