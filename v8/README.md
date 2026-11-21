# v8: one createApp tree, template-first controls

v8 draws Frappe's legacy `frappe.ui.*` classes with Vue and keeps their public API. It differs from v5 in three ways:

- **One app.** `frappe.ui.app = frappe.ui.create_app(App)` is the only `createApp`. Every controller's view is a real child component in that tree (`instance.parent` is set). This means provide/inject, `errorCaptured` and `app.config.errorHandler` work across legacy classes.
- **Template-first.** All markup is in `.vue` templates. `make_*()` switches a template part on, `set_*()` sets state, and parts are read with `v-part:name`. jQuery DOM building is left only in `else` branches, which run for unported subclasses that built a part themselves.
- **`new` mounts its view synchronously** through the renderer's own `patch()`, with the owner's instance as `parentComponent`. Each attach is O(1), there is no outlet list, and the DOM is ready on the next line, even inside a Vue flush.

The design and its reasoning are in the v8 spec (§ numbers below refer to it). This folder holds the implementation that was tested in jsdom and on the real desk.

| file | what |
|---|---|
| `define.js` | the runtime: `create_app`, `verify()`, `define()`, `Component`, `new`/`draw`, views, `flush()`, the apart scheduler, `sweep()`, jQuery hooks |
| `renderer.js` | Vue's DOM renderer made to share nodes with jQuery (from v5, without `mount_point`) |
| `desk_router.js` | v5's router shim for frappe-ui's `routerKey`/`routeLocationKey` (unchanged) |
| `controls/Control.vue`, `ControlInput.vue`, `ControlData.vue` | complete template-first ports of `base_control.js`, `base_input.js`, `data.js` |
| `legacy/check.js`, `legacy/link_like.js` | unported subclasses for the spike (check.js is frappe's file, verbatim) |
| `demo/*.vue` | Section (template-drawn children, provide), ProbeChild, SlotHost, Failing, Nest, RowKid, RenderNew, Picker |
| `harness.cjs`, `spike8.cjs` | jsdom checks |
| `ui/Page.vue` (+ `EsButton.vue`, `Icon.vue`, `PageMenuStore.vue`, `PageToolbar.vue`, `PageToolbarEntry.vue`, `PageRegion.vue`, `anchors.js`) | template-first port of `frappe.ui.Page` (page.js + page.html); see [frappe.ui.Page](#frappeuipage) |

## How `new X(opts)` works

1. Options are assigned with legacy `$.extend` semantics.
2. `pauseTracking()` runs, so a `new` inside a render, a computed or a watcher does not subscribe its caller.
3. The owner is chosen: the controller whose DOM contains the host; else, when the host is detached, the controller being built; else the component whose hook is running; else the root, which keeps no list. When the owner goes, it destroys only the children that are still inside its DOM. A child built into a detached host and placed elsewhere, such as a Dialog's fields once its modal is appended to `<body>`, is left alone, as legacy controls would be. If the child now sits in another controller's DOM, that controller becomes its owner.
4. `patch(null, h(View, {controller}), host, null, ownerInstance)` runs. The view's setup runs the class's `<script setup>` and `created()`, and the first render draws a placeholder.
5. `mounted()` runs synchronously. For a Control this is the legacy constructor tail, `make(); if (render_input) refresh()`.

Errors raised while `new` draws make `new` throw and leave no DOM behind. This holds even under an error boundary that stops propagation (`onErrorCaptured` returning `false`): the view records its own render errors, and its descendants' errors through its own `errorCaptured` hook, before they travel up.

Removal:

- jQuery `.remove()`, `.empty()` and `.html()` destroy the controller through `$.cleanData`.
- An owner's teardown destroys whatever it owns.
- `frappe.ui.sweep()` destroys controllers whose DOM was removed natively, but only a controller whose view holds something outside itself: watchers besides its render effect, or unmount hooks of its own. A controller that holds nothing outside, which includes every control, is never destroyed on a guess. It is collected like any other object once nothing references it, which is what happens to legacy controls. frappe moves DOM natively and puts it back: the list filter popover removes its panel with `panel.remove()` and appends the kept filter rows to a new panel on the next open. The first v8 build swept those rows' controls while the panel was closed, which showed up as an intermittent `control_attach` failure in frappe's suite. Sweep also spares a controller whose tree is still topped by an element taken out with `.detach()`. Once that element is put back and its container is removed by other means, the controller is swept as usual. The desk runs sweep at idle after calling `frappe.ui.start_sweeping()` once at boot.

Nothing global holds a controller.

`flush()` renders unless the view's own render effect is running, that is, unless the view is in the middle of rendering or patching its subtree. The test is the effect's `RUNNING` flag, not the current instance. So `flush()`, `refresh()` and the `make_*()` methods work inside any lifecycle hook, including the post-flush `mounted()` of children that Vue mounts on its own schedule, and a descendant's `onMounted`.

A controller can be reached through Vue reactive state: frappe's Form Builder keeps `frm` in a `ref()`, and `CodeControl.vue` keeps a control in one. `$fui` is `markRaw`, so a reactive proxy returns it unchanged and stays within the Proxy invariant for a non-configurable property. The controllers that top elements and ownership sets record are always the raw ones.

## Template-first convention

- Every element of a ported class is in its `<template>`. A `new ControlData` makes jQuery parse no markup.
- `make_wrapper()` sets `draw_wrapper = true`, calls `flush()`, then reads `$parts.wrapper`. `make_input()` does the same with `draw_input` and `input_attrs`. `setup_url_field()`, `setup_copy_button()` and `setup_barcode_field()` switch on `draw_link_btn`, `draw_copy_btn` and `draw_scan_btn`.
- `set_label`, `set_description`, `set_new_description`, `set_empty_description`, `toggle_label`, `toggle_description`, `set_disp_area`, `set_mandatory`, `set_invalid`, `set_required`, `set_bold`, `set_max_width`, `show_translatable_button`, the fetch_from title, and the input's `disabled` attribute all set declared state, then call `sync()`. `refresh()` and `set_input()` batch these changes into one render.
- Each method checks whether the template still owns the part it writes: `owns_wrapper()`, `owns_label()`, `owns_disp_area()`, `owns_input()`. When a subclass built that part itself (Check, Switch and Comment build their wrapper; Link, Button and Attach build their input), the method takes the legacy jQuery branch on the subclass's element instead.
- The template never binds `value`. The input owns what was typed or set with `.val()`.
- The input is drawn as `<input>`, `<select>` or `<textarea>` by name, following `html_element`, with `type` bound as an attribute (`^type`) the way legacy `.attr("type")` set it. A string `<component :is>` would look the tag up in the app's component registry first, so an app-registered `Select`, `Textarea` or `Input` would replace the native element. Any other `html_element` still goes through `<component :is>`.
- `refresh()` ends with `reapply_state()`. Legacy `refresh()` rewrote `hide-control`, the input and display areas' `hide`, and the input's `disabled` every time, so a change made from outside (query_report's `toggle_filter_display`, import_preview's `$input.prop("disabled")`) was undone. Template state skips values that did not change, so `reapply_state()` compares those DOM facts with the state and corrects only the ones that differ. When nothing differs, `refresh()` still writes no DOM.
- **Subclass templates.** The desk's esbuild Vue plugin needs a `<template>` in every `.vue` file and has no `<template extends>`. So ControlData's parts sit in ControlInput's template behind ControlData's flags, and `ControlData.vue` has an empty template plus `inherit_view: true`, which means "draw with the parent's template".

## Port coverage

Every method of `base_control.js`, `base_input.js` and `data.js` is present with its legacy body. This includes:

- the frm/perm branch of `get_status` (grid read-only, hide_empty_read_only_fields)
- `perm` getter and setter
- the undo_manager record, `_validated` and `after_set_value`
- the translatable button
- InfoCard for `documentation_url` and `show_description_on_click`
- description code highlighting
- `set_new_description` and `set_empty_description`
- the grid branch of `set_invalid`
- the fetch_from title
- the paste-length warning, the autoname check, and URL, copy, barcode and IBAN handling
- `set_input_attributes` with singles skipped, plus input_css, input_class and alignment
- all `validate()` branches, `toggle_container_scroll` and `in_grid`

The bundle entry adds `ControlReadOnly` and `frappe.provide("frappe.phone_call")`, both of which come from data.js.

Still jQuery, by design:

- **InfoCard.** It is frappe's own class from `info_card.js`, called as before. It appends its trigger and card into the template's label. A v-html re-render of the label replaces them only when the label text changes, which is what legacy `innerHTML` did.
- **The legacy fallback branches**, for subclasses that built their own parts.
- **Event bindings on `$input`** (change, input, paste, keyup, focus/blur). These are handlers, not markup.

## Vue internals used

These are the same as the spec's §13 list:

- KeepAlive's `instance.ctx.renderer` (`p`, `um`), read through a function ref
- the positional `patch` and `unmount` signatures
- `instance.job` (`runIfDirty`)
- `instance.effect.scheduler`, replaced for views; Vue's own scheduler is kept for views that have watchers
- `instance.effect.flags & 2` (EffectFlags `RUNNING`): whether a view is rendering or patching, which `flush()` checks
- `getCurrentScope().effects` in a view's setup: whether the view has watchers besides its render effect (the tick and sweep both read it)
- `instance.bum` and `instance.um`: whether a view has unmount hooks of its own, which sweep reads
- `callWithErrorHandling(job, instance, 15)`, which runs a view's job at the tick
- `instance.parent` and `instance.uid`: `flush()` renders the due components in its subtree, parents first
- `instance.isUnmounted`
- `callWithAsyncErrorHandling`
- `pauseTracking`/`resetTracking` from `@vue/reactivity`. `verify()` checks that this is the copy vue uses.
- `instance.effect.scheduler` of every component, wrapped at `beforeMount` (a global mixin) to note the component as due; `instance.effect.dirty`; `queuePostFlushCb` (public) to sweep the due set

`verify()` runs at `app.mount` and sets `frappe.ui.vue_verified`. It also checks the `RUNNING` flag during a render and after it, and checks that a watcher made in setup appears in the scope's `effects`.

## Changes against the spec and prototype

- **Apart scheduler.** At the tick, the pulse takes the waiting views in uid order, parents first. A view with no watchers of its own (every control) is rendered right there, as its own job under Vue's error handling, so one failing patch leaves the others current. A view whose effect scope lists watchers besides its render effect goes to the scheduler Vue gave it (`queueJob`), so it renders after its own pre watchers (spec O5). Handing every view to Vue's queue, as the first v8 build did, brought back n x n cost for "set state, let the tick render" with rows whose child takes props: each child patch scans the queue (`flushPreFlushCbs`). Both paths are linear again. In Chromium, 8000 rows went from 724 ms to 148 ms.
- **`setupState`.** A view's setup returns the class's `<script setup>` bindings, so they become Vue's `setupState`. As a result, `ref="x"` on a setup `ref()` fills it, as in v5.
- **`destroy()` inside `created()`.** It no longer unmounts a component whose setup is still running. The view draws nothing, and `new` unmounts it once the patch returns.
- **Port coverage.** The legacy behaviour the prototype had simplified is restored (see Port coverage above).

## Fixes after the break reports

Two independent break runs on the live bench found the defects below. Each was reproduced first, then fixed at its root. Each now has a check in the jsdom spike (group J, plus H3b) and in `bench/v8/pw/probe_fixes8_v8.cjs` (F1 to F10), and every one of those checks fails on the first v8 build.

| # | defect | fix |
|---|---|---|
| F1 | `$fui` was non-writable and non-configurable, so a control reached through Vue reactive state threw a Proxy-invariant TypeError. Form Builder saves failed (DocType, Customize Form) and its Code properties threw. | `$fui` is `markRaw`. The controllers that top elements and ownership sets record are always the raw ones. |
| F2 | `flush()` did nothing inside any lifecycle hook of a view or its descendants, because it tested the current-instance chain. Template-drawn children that Vue mounted at its tick crashed (`setting 'fieldobj'`), and a control refreshed from a child's `onMounted` was left with an unbound input. | `flush()` skips only while the view's render effect is `RUNNING`. |
| F3 | A Dialog prepared in a Vue component's hook lost its fields when that component unmounted (detached-host ownership). | An owner destroys only the owned children that are still in its DOM. A child placed elsewhere is left alone, or passes to the controller whose DOM now holds it. |
| F4 | `<component :is="html_element">` resolved app-registered `Select`, `Textarea` and `Input`. | The template draws `input`, `select` and `textarea` by name, and `type` is an attribute (`^type`). |
| F5 | One template child's failing `mounted()` stranded every later sibling for good. | `settle()` runs every entry and rethrows the first error at the end. |
| F6 | Handing every tick view to Vue's queue made "set state, let the tick render" quadratic for rows with prop-taking children: 724 ms at 8000 rows. | Views without watchers render at the pulse under Vue's error handling, and views with watchers go to Vue's queue. 8000 rows now take 148 ms. |
| F7 | `refresh()` no longer undid outside changes to `hide-control`, the areas' `hide`, or the input's `disabled`. | `reapply_state()` corrects only the DOM facts that differ from state, so a no-op refresh still writes no DOM. |
| F8 | Under an `errorCaptured` boundary that returned `false`, `new` returned a half-built controller. | The view records its own render errors and its descendants' errors before they propagate. |
| F9 | A controller whose top element was ever `.detach()`ed was exempt from sweep forever. | Sweep spares a node only while the top of its tree is the detached element. |
| F10 | Found while rerunning frappe's suite (an intermittent `control_attach` failure): sweep destroyed the list filter popover's kept rows while the panel was closed. The popover removes its panel natively and re-appends the rows on the next open. | Sweep acts only on controllers whose view holds something outside itself (watchers, or unmount hooks of its own). Controls are left to GC, as legacy controls are. |

## Results

Raw output is in the repo's `bench/v8/results/`.

- **jsdom:** `cd v8 && node --expose-gc spike8.cjs` gives 107/107 on both the dev and prod Vue builds. This covers groups A to I, J (the fixes), G (GC) and H3b.
- **Real desk (Chromium, production build), v8 mode:** every probe passes with no console errors or Vue warnings: probe 41/41, probe_fixes 24/24, probe_review 18/18, probe_review2 17/17, probe_review3 14/14, probe_review4 8/8, probe_forms 19/19 and probe_fixes8 13/13. The original `probe_forms.cjs` reads v5's `$view`, so in v8 mode it classes the controls as legacy and fails its 2 v5-internal checks; its v8 copy passes.
- **frappe's own Playwright suite** (156 specs, `~/fb/pwt/run.sh v8_final`): 135 passed, 14 failed, 7 did not run. The 14 failures are the same as the baseline's, so there are no new failures. The first run after the fixes had one extra failure, `control_attach` "Check if file exists with temporary name". It was intermittent (2 of about 11 runs in v8, 0 of 8 in legacy) and turned out to be F10. After F10, the full suite and 6 more runs of that spec all passed.

Real-desk timings in Chromium (production build, medians of 3 runs, ms), all re-measured after the fixes in the same session:

| | legacy jQuery controls | v5 | v8 |
|---|---:|---:|---:|
| open User form | 153 | 153 | 170 (6 runs, range 153–174) |
| open System Settings | 100 | 94 | 103 |
| make 500 Data controls | 125 | 161 | 193 |
| make 500 Int controls | 141 | 154 | 191 |
| make 500 Select controls | 362 | 289 | 346 |
| set_input on 500 Data | 12.0 | 7.7 | 38.4 |
| refresh() on 500 Data, nothing changed | 25.2 | 14.4 | 9.5 |
| refresh() on 500 after toggling reqd | 30.2 | 47.4 | 39.3 |
| PerfRow n=1000: create / set all + flush all / destroy each | (v5 runtime) 49.7 / 22.8 / 10.8 | 50.7 / 21.7 / 10.5 | 49.8 / 17.0 / 8.1 |

Where v8 is slower:

- `set_input` costs one Vue render and patch per control, because the display area's HTML is template state. v5 wrote it with jQuery.
- Creating a control costs about 4 small renders: placeholder, wrapper, input, then refresh.
- A no-op `refresh()` went from 6.3 to 9.5 ms because of `reapply_state()`, which reads three classes and `disabled`. That is still faster than legacy's 25 ms.
- Opening the User form is noisy in v8 (153–174 ms over 6 runs, against 153 for legacy in this session). Before the fixes the gap was about 2 ms, so this may be noise.

## frappe.ui.Page

`ui/Page.vue` (name `frappe.ui.Page`) ports frappe's `ui/page.js` and `ui/page.html`, template-first. The bench bundle defines it after `desk.bundle.js` has defined page.js's class, so it replaces `frappe.ui.Page`. Nothing extends that class, and the desk makes pages at runtime (`frappe.ui.make_app_page`, `new frappe.ui.Page`), so every page from then on is a v8 page. `frappe.ui.make_app_page` and `frappe.ui.pages` are page.js's own and unchanged. Statics set on the old class carry over, and the old class stays reachable as `frappe.ui.LegacyPage`, which the probe uses to compare the two. The switch is `~/fb/pwt/mode.sh v8page`, which copies `vue_first8/page_port.on.js` over `page_port.js`. `mode.sh v8` keeps page.js's Page.

### How it is drawn

- `new Page(opts)` mounts the view at `opts.parent`. `mounted()` runs the rest of the legacy constructor. `make()` → `add_main_section()` sets `draw_page`, calls `flush()`, and reads the parts. All of page.html is the template: the head, the breadcrumbs, the indicator, the action buttons and menus, and the page body. So are the main view (single column, sidebar on the left, or sidebar on the right), the sidebar's skip link, and the toolbar form (`page_form`). All the jQuery fields (`body`, `main`, `sidebar`, `btn_primary`, `menu`, `actions`, `custom_actions`, `page_form`, `indicator`, `$title_area`, `$breadcrumbs`, ...) are the template's elements.
- page.html's `frappe.ui.button.html()` calls are `<EsButton>`. It produces the same `es-button` markup, attributes and children as `button.js`, so the styling is identical. `frappe.utils.icon()` calls are `<Icon>`.
- Items added at runtime are lists in `data()` that the template draws with `v-for`. Each method returns the jQuery object of the element the template drew for it, read with `v-part:[item.key]` (a per-item part).
- Each page call renders only the region it changed. The regions are child components with their own render: `<PageMenuStore>` (a menu store's `<ul>`), `<PageToolbar>` (the toolbar containers), one `<PageToolbarEntry>` per toolbar button or group, and `<PageRegion>` around the breadcrumbs, the indicator, the icon group, each action button group and the toolbar form. `PageRegion` only renders its slot, so that markup stays in `Page.vue`'s template, but the state it reads is tracked by the region (Vue tracks a slot's reads in the component that renders it): `set_title` renders the breadcrumbs, `set_indicator` the indicator, `set_primary_action` the primary button group, and the page's own template is not rendered again. `v-part` records into the nearest controller above the component that uses it, which is a small change to `define.js`. Menu rows are plain elements under `v-memo`, so adding a row leaves the rows already drawn untouched.

### Keeping state and DOM together when callers use jQuery

- **Removal.** A `$.cleanData` hook drops the item whose element jQuery removes (`.remove()`, or `.empty()`/`.html()` on a container), so the next render agrees with the DOM. Removing methods (`remove_inner_button`, `clear_user_actions`, `clear_mobile_custom_groups`) select elements the legacy way. They remove template-drawn elements from the state and anything else with jQuery.
- **Clearing.** Methods that were `.empty()` (`clear_menu`, `clear_btn_group`, `clear_custom_actions`, `clear_icons`, `clear_fields`, `render_breadcrumbs`) also remove what callers appended into the container, as `.empty()` did. That covers the list view's view switcher, query report's check-filter area, raw `<li>`s, and controls drawn into the toolbar form.
- **Anchors** (`anchors.js`). Replacing the content of an element Vue draws into would also take Vue's list anchors and v-if placeholders, and the next patch would throw and leave the component's render broken for good. So on every `v-tail`/`v-keep` element (the menus, the toolbar, the breadcrumbs, the indicator, the toolbar form and every EsButton) those nodes are put back after any content write: jQuery's `.empty()`, `.html(x)` and `.text(x)`, and the native `textContent`, `innerHTML`, `innerText` and `replaceChildren()` setters underneath them (patched on the prototypes, for marked elements only). A native write is cleaned the way `.empty()` cleans, so template-drawn items leave the state either way. A button or indicator whose content a caller replaced is drawn fresh by the next `set_*` (`gen` keys), as `button.dress()` and `.html()` did. `system_console.js` relabels the primary button with `$btn.text(__("Executing..."))`; the first build handled only `.empty()`/`.html()` and broke there.
- **Moved elements.** When a container is cleared, an item's element that a caller moved somewhere else stays where it is now, with its handlers (`release()`, through the renderer's `leaving_to_jquery`), as legacy `.empty()` of the container left it. A custom group's `<ul>` held after its group is gone is the caller's detached element from then on, and items go into it the legacy way.
- **Legacy positions.** A menu store's rows are in legacy order (`head`, then `rows`), with the user-action divider as a row: a user item goes before the divider, and a new divider and its item go first in the `<ul>` (legacy `prependTo`), before content a caller appended. The inner message goes first in the toolbar (legacy `prepend`).
- **Append order** (`v-tail`). New items go to the end of their container, after whatever callers appended, as legacy appends did. The renderer skips an end anchor marked `TAIL`. Before this, a new inner button landed in front of the list view's view switcher.
- **DOM facts set from outside.** Where legacy wrote a class or attribute every time, the method writes it back after the render: `removeClass("hide")`, `prop("disabled", false)`, `data-label` and `data-working-label` in `set_action`, `data-variant`/`data-theme` in `change_inner_button_type`, `clear_indicator`'s `removeClass()`, `set_indicator`'s `.html()` (text a caller put in the pill goes), and the store parents' `hide`/`hidden-xl`. This matters because `workflow.js` hides `btn_primary` with `addClass("hide")`. `render_breadcrumbs` draws new crumbs every time, as legacy's `.empty().append()` did.
- **Click handlers** that callers pass are bound with `.on("click")` as before. Callers `.off()` them, and `clear_action_of` `.unbind("click")`s everything. Menu rows, group items, crumbs and the skip link use template `@click` with the legacy semantics: ctrl/meta-click sets `open_in_new_tab`, a `false` return stops the event, and `this` is the element.

### Coverage: every page.js method

| method(s) | how it maps |
|---|---|
| constructor, `make`, `add_main_section`, `setup_page` | `created()`/`mounted()`. `draw_page` switches on the template, and its parts become the jQuery fields. `hide_sidebar`/`hide_dock`/`hide_mobile_nav` defaults and the `frappe.ui.pages` registration are kept. |
| `setup_awesomebar`, `load_lib`, `prepare_shortcut_obj`, `is_in_group_button_dropdown`, `btn_disable_enable`, `get_title_area`, `get_breadcrumbs`, `set_breadcrumbs`, `set_title`, `get_form_values`, `add_help_button`, `add_dropdown_button`, `add_select`, `add_data`, `add_date`, `restyle_field`, `build_inner_group_options`, `get_inner_group_button`, `destroy_group_dropdowns` | Unchanged bodies. They read the DOM, or call the methods below. |
| `set_indicator`, `clear_indicator` | State `ind` {shown, label, color, mobile, gen}. The template draws the pill. The mobile tooltip is still jQuery (bootstrap plugin). |
| `set_action`, `set_primary_action`, `set_secondary_action`, `clear_action_of`, `clear_primary_action`, `clear_secondary_action`, `clear_actions` | State `primary_btn`/`secondary_btn` {shown, label, icon, short_label, label_class, loading_label, data_label, working_label, gen}, drawn by `<EsButton>`. The click handler and the shortcut group are as before. A button that is not the page's primary or secondary one takes the legacy `button.dress` path. |
| `set_primary_action_options` | State `primary_menu_hidden`. `frappe.ui.Dropdown` is still frappe's component. |
| `add_menu_item`, `add_custom_menu_item`, `add_action_item`, `add_actions_menu_item`, `add_dropdown_item`, `add_divider` | A store {head, rows, udiv, hidden, hidden_xl} per menu (`menu_store`, `actions_store`, and one per custom button group), drawn by `<PageMenuStore>`. `head` (user items and the user-action divider `udiv`) followed by `rows` (standard items and dividers) is the `<ul>`'s legacy order. The returned `<a>` and legacy dedupe are unchanged (dedupe returns the label spans, as before). A `<ul>` that is not one of the page's stores takes the legacy jQuery branch. |
| `build_dropdown_options` | Unchanged. It reads a row's click, icon, group and shortcut from the item's state, and falls back to jQuery `data()` for raw `<li>`s. |
| `clear_menu`, `clear_actions_menu`, `clear_btn_group`, `clear_user_actions`, `show_menu`, `hide_menu`, `show_actions_menu`, `hide_actions_menu` | Store state, with the DOM class written back afterwards. |
| `add_inner_button`, `add_button`, `get_or_add_inner_group_button`, `add_divider_to_button_group`, `set_inner_btn_group_as_primary`, `change_inner_button_type`, `remove_inner_button` | `toolbar_items` (button / group / custom_group entries), drawn by `<PageToolbar>` as one `<PageToolbarEntry>` each, so a call renders the entry it changed. `change_inner_button_type` writes `data-variant`/`data-theme` back as legacy did. The mobile menu mirror is a user row with `hidden_xl` and `submenu` in state. Group dropdowns are `frappe.ui.Dropdown`, kept in `$group.data("es_dropdown")` as before. |
| `add_custom_button_group`, `clear_custom_actions`, `clear_inner_toolbar`, `clear_mobile_custom_groups` | `toolbar_items` and `mobile_groups`, each with its own store. A parent that is not the page's toolbar takes the legacy branch. |
| `add_inner_message` | State `inner_message` (a new element on every call, as before), placed first in the toolbar as legacy's `prepend` did. |
| `add_action_icon`, `clear_icons`, `show_icon_group`, `hide_icon_group` | `icon_items`, `icon_group_shown`. Bootstrap `.tooltip()` and `.click(click)` are as before. |
| `render_breadcrumbs` | `crumb_items`: the `frappe.ui.breadcrumbs` markup (a / button / span, prefix/suffix icons, title, aria-current, aria-label) in the template. `title_action` is as before. New crumbs on every render, as legacy's `.empty().append()` gave; a list taken out from outside is drawn anew. |
| `add_label`, `add_check`, `add_break`, `show_form`, `hide_form`, `clear_fields` | `form_items`, `form_shown`. `add_check` wraps its label text in a `<span>`. |
| `add_field` | Unchanged body. `make_control` draws a v8 control into the template's `page_form` part (`new` mounts it there). The `col-md-2`/tooltip pokes on the control's wrapper are as before. |
| `add_view`, `set_view` | `main` is the template's view. Other views are the caller's markup, appended and `.toggle()`d as before. |
| `get_empty_state`, `get_icon_label` | Still strings: markup handed to the caller, not part of the page. |
| `set_title_sub`, `get_main_icon` | Still jQuery. They act on an `h6` or `.title-icon` a caller put in the page, and page.html has neither, so on the desk they do nothing, as before. |

### Fixes after the Page break reports

Two break runs drove the port against page.js (`frappe.ui.LegacyPage` in the same build). Each defect was reproduced with the breakers' scripts first, fixed at its root, and has a check in `bench/v8/pw/probe_page_v8.cjs` (P12) that fails on the first Page build and passes now.

| # | defect | fix |
|---|---|---|
| PF1 | **Major.** jQuery `.text()` (and native `textContent`/`innerHTML`/`innerText`) on a drawn element removed Vue's anchors; the next patch threw (`reading 'nextSibling'`) and left the page's render broken for good (`emitsOptions`). System Console's Execute (`$btn.text(__("Executing..."))`) hid its button after one click; on a ToDo form `btn_primary.text(...)` broke `frm.refresh()` and every later page call. | `anchors.js` keeps the anchors through every content write on marked elements: jQuery `.empty()`/`.html(x)`/`.text(x)` and the native `textContent`/`innerHTML`/`innerText` setters and `replaceChildren()`. A native write is cleaned like `.empty()` (cleanData), so the state drops the items it removed. |
| PF2 | After jQuery `.empty()` of a menu, or the removal of its user-action divider, the next user item came without a divider (`cleanData` cleared the flag and the push set it back before any render). | The divider is a row of the store (`udiv`), placed as legacy placed it: user items before it, a new one first in the `<ul>` with its item. |
| PF3 | The inner message landed after content a caller appended (or prepended) to the toolbar. | `add_inner_message` puts its element first in the toolbar after the render, as legacy's `prepend()`. |
| PF4 | Building a toolbar was quadratic (400 buttons: 863 ms vs 96), and a no-op call cost 13× (`show_menu` ×1000: 16 ms vs 1.2). Every `flush()` walked the page's whole subtree, and every toolbar render re-rendered every entry. | `define.js`: components note themselves in a `due` set when their render is scheduled, and `flush()` renders those in its subtree instead of walking it. Toolbar entries are components (`PageToolbarEntry`), the page's own regions are `PageRegion`s, and the menu store's two parts keep `v-memo`'s positional cache valid. 400 buttons: 277 ms vs 95; `show_menu` ×1000: 1.1 ms vs 1.1. |
| PF5 | `add_field` controls stayed alive after `$(page.parent).empty()`/`.html()`: the fragment Page was unmounted first and Vue removed its DOM natively, so jQuery never cleaned the controls. | `define.js`'s `.empty()`/`.html()` hook destroys the controllers inside a host before it destroys the views drawn straight into it, as jQuery's cleanData would have. |
| PF6 | DOM facts legacy rewrote on every call stayed as a caller left them: `change_inner_button_type`'s `data-variant`/`data-theme`, `set_action`'s `data-label`, text a caller put in the indicator, a held crumb `<li>`. | Written back after the render (`data-*`), the indicator drops every foreign node (text too), and `render_breadcrumbs` draws new crumbs every time. |
| PF7 | A menu row a caller moved to another `<ul>` was removed from there by `clear_menu`; a held custom-group `<ul>` took no more items after `clear_custom_actions`. | Clearing methods leave elements a caller moved out where they are (`release()` with the renderer's `leaving_to_jquery`); a store whose `<ul>` the template no longer draws takes the legacy branch. |
| PF8 | `$parts` kept a `null` key per removed item (1000 cycles: 1000 keys). | `v-part`'s `beforeUnmount` deletes the key. |

Also reported, not from the port: clicking Save within about 300 ms of typing does not save, with page.js too (the debounced change re-dresses the primary button between mousedown and mouseup; `frappe.ui.button.dress` `.html()`s it the same way). The breaker measured 0/4 saves in both modes.

### Results (v8page mode, Chromium, production build)

- **Page probe** (`bench/v8/pw/probe_page_v8.cjs`): **33/33**, with no console errors or Vue warnings. The probe builds a v8 page and a page.js page (`frappe.ui.LegacyPage`), drives both through the same scenarios, and compares their DOM (tags, classes, styling and identifying attributes) after every step. Coverage:
  - P1: synchronous draw, including single-column and sidebar-right pages.
  - P2 to P6: 63 steps compared with page.js, plus the Menu dropdown's rows and the returned elements.
  - P4: a held `$btn` keeps `.addClass` across re-renders.
  - P7: `add_field` draws v8 controls.
  - P8: jQuery `.remove()`/`.empty()`, then further updates.
  - P9: a forced re-render writes no DOM.
  - P10: list, form, report, workspace and query report pages on the desk.
  - P12: the break-report regressions above (R1 to R8: 10 checks, 65 more steps compared with page.js), including System Console's Execute on the desk.
- **The breakers' own scripts**, rerun on the final build: the 15 snippet suites match page.js except for what is listed under open issues; 1,100 random sequences of up to 60 calls (four fuzzers, including the `.text()` one) match page.js's DOM and dropdown rows; System Console, the list, report, kanban, tree, query report, workspace, form, workflow, dialog and mobile flows match apart from text whitespace (below).
- **frappe's Playwright suite, page set** (48 specs, `~/fb/pwt/page_specs.txt`, `results/page_final.txt`): 249 passed, 12 failed. 11 are the failures page.js's Page has in mode v8 (`page_base_v8`) and in legacy mode (`page_base_legacy`): 7 dashboard tests, `list_view` "Keep checkbox checked", the `mobile_nav` desktop header test, and 2 `query_report` tests. The 12th, `shell_routing` "opens a private page in the Private shell" (a redirect from `/desk/private` that did not happen within 20 s), passed in the full run before on the build without the menu-store split, and passes 3 of 3 runs of `shell_routing.spec.js` alone on the final build (`results/shell_routing_v8page_*.txt`, 39/39 each). An earlier final run was spoiled by "Queue Overloaded" (the bench runs no workers); the queue was drained with `bench worker --burst` before the runs reported here.
- **Control/form/grid/dialog set** (`results/page_final_controls.txt`): 135 passed, the same 14 failures as `baseline.txt`, 7 did not run.
- **v8 probes:** probe 41/41, probe_fixes 24/24, probe_review 18/18, probe_review2 17/17, probe_review3 14/14, probe_review4 8/8, probe_forms 19/19, probe_fixes8 13/13. **jsdom spike:** 107/107 on dev and prod Vue.

Timings (Chromium, production build, ms; page.js is `frappe.ui.LegacyPage` in the same build, three runs of the probe's P11):

| | page.js | v8 Page |
|---|---:|---:|
| create a page (median of 7 × 20) | 0.85–0.95 | 1.42–1.90 |
| a form refresh's page calls (3 clears, title, indicator, primary, 12 menu items, 4 inner buttons, 1 action) | 2.45–2.81 | 2.95–3.96 |
| the same title/indicator/show_menu again | 0.12–0.15 | 0.08–0.10 |
| 300 menu items, half user, half standard | 35 | 42 |
| 100 / 400 inner buttons on one page | 23 / 95 | 49 / 277 |
| 20 / 40 groups × 10 items | 45 / 98 | 62 / 160 |
| the break report's refresh loop ×50 (12 standard items, 2 buttons, a group) | 123 | 205 |
| `show_menu()` ×1000 that changes nothing | 1.1 | 1.1 |
| `set_indicator()` ×1000, same label | 17.4 | 4.3 |
| open User form (perf_forms, 3 runs) | 137–187 (mode v8) | 163–168 |
| open System Settings | 101–123 (mode v8) | 90–104 |

Where the time goes now: the remaining cost of a call is mostly creating DOM nodes one by one (legacy parses one HTML string per item) and Vue's per-element bookkeeping. Creating a page draws eight `PageRegion`s and the toolbars as components, which made creation slower and every later call cheaper.

### Runtime changes this needed

- `define.js`:
  - `v-part` used in a plain child component's template records into the nearest controller above it, and an empty part name is ignored. Its `beforeUnmount` deletes the key (it set `null`).
  - `flush()` no longer walks its subtree. A global mixin wraps every component's scheduler so the component notes itself in `due` when its render is scheduled (a view's apart scheduler notes too); `flush()` runs the noted ones in its own subtree, parents first, and skips controllers drawn with `new` under it, as the walk did. `due` is swept after Vue's flush. A `$forceUpdate()` does not go through the scheduler, so it renders at the tick, not at the next `flush()`.
  - The `.empty()`/`.html()` hook destroys the controllers inside a host before it destroys a fragment view drawn straight into that host.
- `renderer.js`: an anchor marked `TAIL` is ignored on insert, so a `v-tail` list appends at the end of its container.
- `ui/anchors.js` patches the `textContent`, `innerHTML` and `innerText` setters and `replaceChildren()` on the DOM prototypes; for elements that are not `v-keep`/`v-tail` they only add a WeakSet lookup.

### Page open issues

- Creating a page costs about 1.7–2× page.js and a refresh cycle about 1.2–1.4× (it varies between runs; the first Page build measured 1.3× and 1.5× in another session, 1.65× for the refresh cycle in this one). A toolbar with hundreds of buttons builds in about 3× page.js's time; at ordinary sizes (tens of items) calls cost about the same.
- `add_field` controls get the app root as their Vue parent, not the Page. The Page is a fragment with no top element, so `dom_owner` does not find it. They are destroyed by `clear_fields` and by jQuery emptying the page's host. Making the Page their owner would put every form control under it, and the owner's set would keep controls that legacy code drops natively.
- After `$(parent).empty()` the Page is destroyed; later calls draw nothing and item methods return `$()`, where page.js kept working on detached DOM.
- Text whitespace: Vue's compiler drops whitespace between elements, so `.text()` of a container reads "CustomizeCtrl+Y" where page.js's markup gives "Customize Ctrl+Y" (also `$title_area.text()` and a group's text). Labels themselves are unchanged.
- Menu rows and buttons carry `<!--v-if-->` comments, and after a caller's `.text()` on a button its Vue anchors stay behind the text. `.text()` and the Dropdown snapshot are unaffected.
- `add_check` wraps its label in a `<span>`, which page.js did not. `add_label`/`add_check`/`add_break` are unused in frappe.
- page.js's icon `<svg>`s carry an empty `style=""` attribute that v8's do not. Element positions in the page head match at 1280px and 390px (break report).
- The content-write hooks cover jQuery and the four native writes. A caller that removes a single anchor node itself (`$(el).contents().remove()`, `removeChild` of a comment) can still break the next patch of that element.

## Open issues

- **`set_input` cost.** It is about 3 times legacy, because of the template-state display area.
- **Create cost.** Creating a control is about 1.5 times legacy.
- **Sweep coverage.** Sweep now acts only on views that hold something outside themselves. A child component inside a class's template that has its own store watcher is not counted, so its teardown does not run on native removal. Also, a view with watchers that is removed natively and put back later, as the popover does, would still be destroyed by a sweep in between.
- **Detached-host parent.** A control built in a component's hook into a detached host keeps that component as its Vue parent (`provide`/`errorCaptured`) after it is placed elsewhere and after the component unmounts. Only ownership follows the DOM.
- **Hook timing (unchanged).** A view's own `onMounted`, `onUpdated` and template refs run after `new`. `flush()` does not run pending pre-watchers. Views with watchers render at their place in Vue's queue at the tick, and views without them render at the pulse.
- **More internals.** v8 now also uses `effect.flags` `RUNNING`, `scope.effects`, `instance.bum`/`um` and `callWithErrorHandling`. `verify()` checks each of these.
- **Not tried.** The devtools tree (spec O1) and `app.unmount()` with views mounted by `new` (O2) are still untried. Teleport anchors left in Check's host (O7) are still unchecked.
- **`<template extends>`.** The desk's esbuild Vue plugin still lacks it (O8). The workaround is `inherit_view`.
- **Probe metric.** probe_forms' "vue-drawn wrappers/inputs" reads 0 in production builds, because `__vueParentComponent` exists only in dev builds.
- **Bench environment.** The bench runs no RQ workers, so suite runs fill the job queue. At about 550 jobs, any request that enqueues fails with "Queue Overloaded". The queue was drained once with `bench worker --burst`.

### Semantics that differ from v5

These are documented in the spec (§5, O5, O14), and the probe copies were adjusted for them:

- A view's own `onMounted`/`onUpdated` and template refs keep Vue's post-flush timing. They run at the next microtask, not inside `new` or `flush()`. Parts (`v-part`) and the class's `mounted()` are ready when `new` returns.
- `flush()` does not run Vue's pending pre watchers. They run at the tick, before the view renders.
- Only `data()` keys are reactive. A probe class that relied on any field re-rendering declares that field in `data()`.
- v5's `renders()` hook does not exist in v8.
