<!--
frappe.ui.form.LinkInput: what a Link control draws in its input area (variant A). The control
(ControlLink.vue) mounts it with `new` into `input_area`, where legacy link.js prepended its
`.link-field` markup, and takes its parts as the legacy jQuery fields:

	$parts.input        -> control.$input / control.input   (frappe-ui Combobox's own <input>)
	$parts.link_btn     -> control.$link                    (.link-btn, in the Combobox's suffix slot)
	$parts.btn_clear    -> control.$link_clear
	$parts.btn_open     -> control.$link_open
	$parts.awesomplete  -> .awesomplete, the container Desk core and apps look the input up in

frappe-ui's Combobox is used unchanged. Its props are bound to this class's state and its emits are
listened to; the state is driven by control.awesomplete (awesomplete_shim.js), which keeps
Awesomplete's protocol. The Combobox's own requests are filtered so the legacy behaviour holds:
	- it never opens by itself (legacy opens once results are there: evaluate());
	- the query is the input's text: only the user's typing and jQuery .val() change it;
	- a pick goes through awesomplete.select(), which link.js may refuse (Enter on a row that doesn't
	  match the text), and then the list stays open.
The value model is held at -1, a value no row has (bound with a listener, so Vue's useModel doesn't
keep the last pick locally and mark that row checked): the control's value lives in the control.
-->
<script>
import { h, nextTick } from "vue";
import { Combobox } from "./fui-a.js";


export default {
	name: "frappe.ui.form.LinkInput",
	components: { Combobox },
	data() {
		return {
			open: false,
			query: "",
			rows: [],
			disabled: false,
			portal_to: null,
		};
	},
	computed: {
		// suggestions -> frappe-ui options. The value is the row's index: legacy rows may repeat a value
		fui_options() {
			return this.rows.map((s, i) => {
				const d = s.item || {};
				const option = { label: s.label, value: i, disabled: d.value === "filter_description__link_option" };
				if (d.html) {
					const html = d.html;
					option.slots = { label: () => h("span", { class: "tw-link-html", innerHTML: html }) };
				} else if (d.description && (this.control.is_title_link() || d.value !== d.description)) {
					option.description = __(frappe.utils.html2text(frappe.utils.escape_html(d.description)));
				}
				return option;
			});
		},
	},
	mounted() {
		// the list teleports next to the input, into the Combobox's trigger (a span in its suffix slot):
		// legacy's list was the input's sibling, and code finds it from there (frappe's own test helper:
		// `input/..` getByRole("listbox")). It is position: fixed, so cells and sections don't clip it.
		const portal = this.$parts.portal;
		// keeps focus in the input while a row is pressed, as Awesomplete's ul did (the pick is on click)
		portal.addEventListener("mousedown", (e) => e.preventDefault());
		this.portal_to = portal;
		this.flush();
		this.input = this.$parts.input_anchor.querySelector("input");
		this.$parts.input = this.input;
		const input = this.input;
		// which key (if any) is being handled when the Combobox picks a row: recorded before any handler
		// on the input runs (capture on the container), cleared once the event is done
		this.$parts.awesomplete.addEventListener(
			"keydown",
			(e) => {
				this.key_event = e;
				setTimeout(() => this.key_event === e && (this.key_event = null));
			},
			true
		);
		// the query is the input's text
		$(input).on("select-change input", () => this.sync_query());
		// Awesomplete's own listeners were native ones, added after the control's first jQuery handler: they
		// run after every jQuery handler of the same event, which keeps the legacy event order
		input.addEventListener("input", () => this.control.awesomplete?.evaluate());
		input.addEventListener("blur", () => this.control.awesomplete?.close({ reason: "blur" }));
		input.addEventListener("keydown", (e) => this.on_keydown(e));
	},
	methods: {
		sync_query() {
			if (this.input && this.query !== this.input.value) {
				this.query = this.input.value;
				this.flush();
			}
		},
		set_rows(suggestions) {
			this.rows = suggestions.slice();
			this.flush();
		},
		set_open(open) {
			if (this.open === !!open) return;
			this.open = !!open;
			this.flush();
		},
		// the open list's element: frappe-ui's listbox content, else the stand-in
		list_element() {
			const content = this.content_element();
			return content?.querySelector('[role="listbox"]') || content || this.$parts.ul;
		},
		content_element() {
			const id = this.input?.getAttribute("aria-controls");
			return (this.open && id && document.getElementById(id)) || null;
		},
		row_elements() {
			const content = this.content_element();
			return content ? [...content.querySelectorAll('[data-slot="item"]')] : [];
		},
		row_element(i) {
			return this.row_elements()[i] || null;
		},
		highlighted_index() {
			return this.row_elements().findIndex((el) => el.hasAttribute("data-highlighted"));
		},
		// the Combobox highlights the row the pointer moves over (reka's highlightOnHover): the same signal
		// makes row i the active one, as Awesomplete's goto(i)
		highlight(i) {
			const go = () => {
				const el = this.row_element(i);
				if (el && !el.hasAttribute("data-highlighted"))
					el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }));
			};
			go();
			nextTick(go);
		},
		on_keydown(e) {
			const aw = this.control.awesomplete;
			if (!aw || !aw.opened) return;
			if (e.keyCode === 27) aw.close({ reason: "esc" });
			else if (e.keyCode === 9 && aw.tabSelect && this.highlighted_index() > -1) aw.select(undefined, undefined, e);
		},
		// ---- the Combobox's emits ----
		on_open_request(open) {
			// opening is the awesomplete's (it opens when there are results); closing: Escape, a click
			// outside, or the Combobox closing after its own pick (handled in on_pick)
			if (open || this.picking) return;
			this.control.awesomplete?.close({ reason: "fui" });
		},
		on_query(value) {
			// typing (the text is already in the input); the Combobox's own resets are ignored
			if (this.input && value === this.input.value) this.sync_query();
		},
		on_pick(option) {
			if (!option || typeof option.value !== "number") return;
			const aw = this.control.awesomplete;
			if (!aw) return;
			const e = this.key_event;
			this.picking = true;
			try {
				const picked = aw.select(option.value, this.row_element(option.value), e || undefined);
				// legacy row click handler: select, then show the link buttons
				if (picked && !e) this.control.show_link_and_clear_buttons();
			} finally {
				// the Combobox asks to close right after the pick: only a refused pick stays open
				Promise.resolve().then(() => (this.picking = false));
			}
		},
	},
};
</script>

<template>
	<div class="link-field ui-front tw-fui" style="position: relative">
		<div v-part:awesomplete class="awesomplete">
			<div v-part:input_anchor class="tw-link-combobox">
				<Combobox
					:model-value="-1"
					@update:model-value="() => {}"
					:options="fui_options"
					:open="open"
					:query="query"
					:filterable="false"
					:open-on-click="false"
					:open-on-focus="false"
					:disabled="disabled"
					:portal-to="portal_to"
					placeholder=""
					empty-text=""
					variant="subtle"
					size="sm"
					@update:open="on_open_request($event)"
					@update:query="on_query($event)"
					@update:selected-option="on_pick($event)"
				>
					<template #suffix>
						<span v-part:link_btn class="link-btn">
							<a
								v-part:btn_clear
								class="btn-clear"
								style="display: inline-flex"
								:title="__('Clear Link')"
								v-html="frappe.utils.icon('x', 'xs')"
							></a>
							<a
								v-part:btn_open
								class="btn-open"
								style="display: inline-flex"
								:title="__('Open Link')"
								v-html="frappe.utils.icon('arrow-right', 'xs')"
							></a>
						</span>
						<span v-part:portal class="tw-link-portal"></span>
					</template>
				</Combobox>
			</div>
			<ul v-part:ul role="listbox" hidden class="tw-ul-standin"></ul>
		</div>
	</div>
</template>
