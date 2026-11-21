# v8 spec: one createApp tree, template-first parts, `new` mounts its view as a real child

Status: design spec. The prototype it describes lived outside the repo (a scratch directory); what it became is `v8/` itself. Its checks: 68/68 on the Vue dev and prod builds.
Vue 3.5.43. Line numbers are `@vue/runtime-core/dist/runtime-core.cjs.js` (rc) and `@vue/reactivity/dist/reactivity.cjs.js` (re) under `/home/claude/fb/frappe-bench/apps/frappe/node_modules/`.

---

## 0. Which design this is, and why

Three v8 designs were judged by three judges, who re-ran the prototypes.

| design | judge 1 | judge 2 | judge 3 | sum | judges who picked it as winner |
|---|---:|---:|---:|---:|---:|
| **"composition"**: `new` mounts its view through the renderer's own `patch()` with a real parentComponent | 8.5 | 7.5 | 8 | **24.0** | 3 of 3 |
| "Outlet, fixed": shelved outlets plus Teleport | 7 | 6.5 | 6.5 | 20.0 | 0 |
| "One app, adopted children": the same patch mechanism, leaner, no template children | 6 | 5.5 | 7 | 18.5 | 0 |

This spec starts from **composition** (`/tmp/claude-1001/v8/composition`). It adds the grafts the judges recommended (section 12) and either resolves each flaw they raised or lists it as open (section 16). The grafts are implemented and tested in `prototype/`; the original composition directory is left unchanged.

What the owner asked for, and where this spec covers it:

| owner's words / hard requirement | here |
|---|---|
| "Templating should somehow still happen in .vue files and the make functions maybe just turn them on" | §6, §7: every element is in a `<template>`; `make_*()` sets `draw_* = true`; `set_*()` sets state |
| "I also want createApp" / one Vue tree | §2, §3: `frappe.ui.app = createApp(...)` once; each view's `instance.parent` is real |
| `new X(opts)` has its DOM on the next line, including inside a Vue flush | §5 |
| legacy subclasses, prototype patches, jQuery fields and interop | §4, §8, §14 |
| no n², a no-op refresh writes no DOM, set-all then flush-all stays linear | §11 |
| jQuery removal destroys; collectable; nothing global holds a controller | §10 |
| fewer Vue internals than v5, each named and justified | §13 |

---

## 1. Vocabulary

- **class / controller**: what legacy code calls `new` on (`frappe.ui.form.ControlData`). It is a real JS class: methods sit on the prototype, statics on the constructor.
- **view**: the Vue component that draws one controller. There is one view component per class (`view_of(Class)`). Its render calls the class's compiled template with `_ctx = controller`.
- **app**: the one `createApp` app (`frappe.ui.app`). Its root instance (`FrappeDesk`) renders an empty `<KeepAlive>` and the desk's own `App`.
- **host**: `$(opts.parent || opts.container)[0]`, the element legacy code passes in.
- **owner**: the controller (or plain Vue component) whose lifetime a view is tied to. It destroys what it owns.
- **part**: an element of a view's template that legacy code reads as a field (`wrapper`, `input`, `input_area`, ...).

---

## 2. Architecture: class, view, app

```
frappe.ui.app = frappe.ui.create_app(App)      one createApp; app.directive("part"); errorHandler chain; verify()
FrappeDesk (root instance)
├── KeepAlive (empty; a function ref reads its instance.ctx.renderer = {p: patch, um: unmount})
├── App (the desk's own Vue tree)
│   └── Host (plain component)
│        ┊ onMounted: new ControlData({parent: hostDiv})
│        └┄┄> ControlData view                parent = Host; Host's onBeforeUnmount destroys it
├┄┄> Section view                             new Section({parent: el}); no controller owns el, so parent = root
│    ├── ControlData view (f1)                template v-for: an ordinary child, whose setup constructs the controller
│    ├── ControlData view (f2)
│    └┄┄> ProbeChild view                     new ProbeChild({parent: section.body}): parent = Section view
├┄┄> ControlCheck view                        unported Check: its template input is teleported into Check's own wrapper
└┄┄> PerfRow view × N                         parent = root; the root holds no list, so nothing global keeps them
```

A solid line is a child inside the parent's `subTree`, mounted and unmounted by Vue's normal patch. A dotted line is a view mounted by `new` through `patch(null, vnode, host, null, parentInstance)`. It has `instance.parent` set, but it is not in the parent's `subTree`, and its owner's `owned` Set unmounts it.

Each view's `instance.parent` is real. Vue resolves `appContext` (rc:8077) and `provides` (rc:8102) from it, `inject` reads `instance.parent.provides` (rc:796-800), and errors walk `instance.parent` through `errorCaptured` hooks to `appContext.config.errorHandler` (rc:227-257). So provide/inject, error capture and the app error handler work across legacy classes, which v5 (one root per controller) could not do.

A view gets into the tree in one of two ways:

1. **Template-drawn.** A parent class's template draws child classes as components (`<ControlData v-for="df in fields" :key :df @ready/>`). The child view's setup constructs the controller. These are ordinary `subTree` children that Vue mounts and unmounts, and devtools sees them. This is the preferred path for Vue-first layouts.
2. **Imperative.** Legacy code calls `new X({parent: el})`. The view is mounted at `el` synchronously, with `parentComponent` = the owner's instance (§5). Attaching is O(1): the parent does not re-render, and there is no shared list.

---

## 3. `frappe.ui.create_app(App, props)`

Code: `prototype/runtime/define.js:47`.

```js
const app = desk_renderer.createApp({
  name: "FrappeDesk",
  setup() { root = getCurrentInstance(); return () => [h(KeepAlive, { ref: take_renderer }), App ? h(App, props) : null]; },
});
app.directive("part", part_directive);   // v-part:name -> controller.$parts.name
chain_error_handler(app.config);         // errors while `new` draws make `new` throw; everything else goes to the user's handler
watch_jquery_cleanup();                  // $.cleanData / $.fn.empty / .html / .detach hooks (§10)
app.mount = wraps the original, then verify() (§13.1)
frappe.ui.app = app;
```

- `take_renderer(proxy)` sets `internals = proxy.$.ctx.renderer`. Function refs are called synchronously during patch (`setRef`, rc:1823-1824). Mounting KeepAlive sets `instance.ctx.renderer = internals` (rc:6088-6090). This is the Adopted design's way of getting the renderer, grafted in; composition used a child component that read its parent.
- `desk_renderer` is `createRenderer({...nodeOps, ...jQuery-aware overrides})` (§14).
- `verify()` runs once at mount and throws a clear error if the Vue in use does not behave as this runtime needs (§13.1).

---

## 4. `frappe.ui.define(options)`: from a .vue file to a class

The desk's SFC build plugin compiles each `.vue` file. For a file whose `name` starts with `frappe.ui.`, it emits `frappe.ui.define(_sfc_main)`. That call does the following:

- `class Name extends Parent {}`, where Parent is the class of `options.extends`, or `Component`. The result is assigned to its global path (`frappe.ui.form.ControlData`).
- `methods`, `created` and `mounted` go on the prototype as writable, configurable data properties, so prototype patches made later reach every call, including calls from templates (`_ctx` is the controller). `Object.setPrototypeOf(methods, Parent.prototype)` makes `super.x()` work inside object-literal methods.
- **State.** The keys returned by `data()` become prototype accessors over `this.$fui.state = shallowReactive({...})`. Only these keys are reactive. Every other field (`df`, `doc`, `$wrapper`, ...) is a plain field, so legacy code reads plain objects, not proxies. This fixes issue #1 flaw 2. Setting a key to the same value does not trigger anything, which is what makes a no-op `refresh()` free.
- `computed` getters become prototype getters that a caller's own assignment can override (from v5).
- `static: {...}` becomes static fields. Templates read them as `constructor.html_element`, so a legacy `static input_type = "checkbox"` takes effect.
- `setup(self, ctx)` (or `<script setup>`) runs inside the view's setup. provide, inject and hooks belong to the view, and returned keys read as `this.x`. Setups are inherited in order.
- `$fui` is a non-enumerable record: `state, parts, view, vnode, owner, owned, host, destroyed, unmounted, error, refreshing, ...`.

The constructor (`Component`, define.js:145) does this:
```
$fui = {...}; Object.assign(this, opts)          // legacy $.extend(this, opts)
wrap_destroys(prototype chain)                    // re-entry guard (from v5)
if a parent's template is constructing it: return // the view's setup carries on
if no class in the chain has a template: created(); mounted(); return   // a plain legacy class
draw(this)                                        // §5
```
Legacy `class Y extends X { constructor(o){ super(o); this.$input... } }` works: `super()` returns after `draw()`, so the DOM exists.

---

## 5. What `new X(opts)` does

`draw(c)`, define.js:253. Every step is synchronous, and none of them calls `queueJob`, `queuePostFlushCb` or `render()`.

1. `pauseTracking()`. If `new` runs inside a render, a computed or a watch getter, the caller's effect must not subscribe to the controller's state. Without the pause this loops ("Maximum recursive updates exceeded"; check H2 fails with `FUI_PAUSE=0`). Judge 2 asked for this. `pauseTracking` is a public export of `@vue/reactivity` (re:498, `reactivity.d.ts:321`) and is the same module instance that runtime-core uses. Nested component renders still track, because `ReactiveEffect.run` sets `shouldTrack = true`.
2. `host = to_element(parent || container)`. When there is no host, the view mounts into a `DocumentFragment`: legacy `appendTo(undefined)` also left the element detached for the caller to place.
3. `owner = owner_for(host)`, checked in this order:
   1. the nearest live controller whose top element (view root or `$wrapper[0]`, marked with a symbol) contains `host`;
   2. if `host` is detached, the controller whose `created()`/`mounted()` is running (the `building` stack);
   3. if code runs inside a component's setup, hook or render (`getCurrentInstance()`), that component, when its `$el` contains `host` or `host` is detached. A plain component becomes an owner record with one `onBeforeUnmount(fn, instance)`, using Vue's public target argument (`createHook`, rc:3149);
   4. otherwise, none: the root, which keeps no list.
4. `parent_instance(owner)`: the owner's instance, or its nearest ancestor that has rendered. Vue's `setScopeId` reads `parentComponent.subTree.patchFlag` (rc:5797-5800), which is null before the first render. This guard is why `new` inside a component's `setup()` works here, while the Adopted design crashes. The owner still owns the view, but that component's own `provide()` is not visible to it (open issue O3).
5. `drawing = c`, so errors from this subtree are recorded on `c` (`chain_error_handler`).
6. `internals.p(null, h(View, {controller: c}), host, null, parentInstance, null, ns)`. This is Vue's own patch (rc:5505). `mountComponent` creates the instance with that parent, and the view's setup:
   - records `$fui.view`, runs setups (provide/inject), then `created()`;
   - replaces `effect.scheduler` for this view (§9.2), via `onBeforeMount`;
   - returns the render, which calls the compiled template with `_ctx = c` and `$fui.rendering` set as a re-entry guard.

   `setupRenderEffect` then renders at once (rc:6328-6340). Usually all parts are still off at this point, so the render is a placeholder comment. Template-drawn child classes run their setup inside the same patch and register a pending entry. `v-part` `created` hooks fill `$parts` while the elements are created (rc:5745).
7. If there is an owner, add `c` to `owner.owned` (a Set). Mark the top element(s) with the controller symbol. Register `c` in the sweep registry as a WeakRef (§10.3).
8. `settle(from)`: call `mounted()` for the template-drawn children registered since step 6, children first.
9. `c.mounted()`, called directly, not through Vue's `onMounted`. For a Control this is the legacy constructor tail, `this.make(); if (this.render_input) this.refresh()`, and it draws the parts (§6).
10. `resetTracking()`. If anything recorded an error, `destroy()` runs and the error is rethrown, so `new` throws as legacy constructors did and no DOM is left behind.

**Inside a Vue flush.** Nothing above waits on Vue's scheduler, so `new` behaves the same inside `onMounted` (a post flush), a pre or sync watcher, a setup, a render or a computed. v5 failed inside `onMounted` because its `mounted()` and template refs were post-flush callbacks: `flushPostFlushCbs` (rc:362-373), when called during an active post flush, only appends to the running list. Here, parts come from directive `created` hooks (synchronous, rc:5745), and `mounted()` is called by `new`. The prototype checks this: in `Host.onMounted`, `$wrapper` is in Host's div, `$input` is connected and the label is set; the same holds in a watcher, in a view's `created()`, and in a render (H2).

What still runs on Vue's timing: `onMounted`/`onUpdated` and template refs of plain components inside a view (`setRef` queues post, rc:1866-1873), and Transition enter hooks. A controller's own lifecycle never depends on them.

---

## 6. Template-first convention

### 6.1 Rules

1. **All markup of a ported class is in its `<template>`.** No `$("<...")`, `.append("<...")` or `innerHTML` in the ported paths. The check wraps `$.fn.init` and counts zero markup parses during `new ControlData`.
2. **`make_*()` switches a part on.** It sets a declared state key (`draw_wrapper`, `draw_input`, `draw_link_btn`, `draw_copy_btn`), calls `flush()`, then reads the part: `this.$wrapper = $(this.$parts.wrapper)`. The method names and call order stay the legacy ones, so subclasses that override or call `super` keep working.
3. **`set_*()` sets state.** Each one writes one or more declared keys and then calls `this.sync()`. `sync()` is `flush()` unless the call is inside `batch()`. `refresh()` and `set_input()` run inside `batch()`, so a refresh renders once, at the end.
4. **Parts are read with `v-part:name`.** The directive's `created` hook stores the element in `this.$parts[name]`, and `beforeUnmount` clears it. Template refs are not used, because they are post-flush.
5. **A part that a subclass builds itself is not drawn by the template.** The switch is `draw_*`, not legacy flags such as `has_input`: Link sets `has_input` itself after building its own input, so a template keyed on `has_input` would draw a second input.
6. **The template never binds `value`.** The input owns what was typed or `.val()`-ed. `set_formatted_input` writes `.val()` only when the value differs.
7. **The root is a `v-if` / `v-else-if` chain, not a fragment.** That gives exactly one host node per control. No comment may sit beside the root `v-if`: in a dev build that turns the root into a fragment (a gotcha found by the Outlet design).
8. **`v-memo`** goes on the label, input, display area and help box, so a re-render skips their subtrees when their inputs did not change.

### 6.2 Method-to-state map (Control, ControlInput, ControlData)

| legacy method (file) | now sets | legacy jQuery branch kept for |
|---|---|---|
| `make_wrapper()` (base_control) | `draw_wrapper = true` | (subclass overrides it) |
| `make()` tooltip and data-* (base_control) | template | wrapper built by the subclass: `.attr(...)`, `tooltip_into = wrapper` |
| `set_hidden_control` | `hidden_control` | `!draw_wrapper` |
| `make_input()` (data) | `input_attrs = get_input_attributes(); draw_input = true` | (subclass overrides it) |
| `set_input_attributes()` (data) | `input_attrs`, replaced only if changed | `!draw_input` (Link's own input) |
| `setup_url_field()` / `setup_copy_button()` | `draw_link_btn` / `draw_copy_btn` | — |
| `set_input_areas()` (base_input) | reads `$parts` | `$wrapper.find(...)` |
| `set_label` | `label_html` | `label_span.innerHTML` |
| `toggle_label` | `label_shown` | `.toggleClass("hide")` |
| `set_description` / `set_new_description` / `set_empty_description` | `description_html` | `.help-box.html()` |
| `toggle_description` | `description_shown` | `.toggleClass` |
| `set_disp_area` | `disp_html`, `disp_style` | `$(disp_area).html()` |
| `show_input_area` | `show_input` | `.toggleClass("hide")` |
| `set_mandatory` | `mandatory_error` | `.toggleClass("has-error-mandatory")` |
| `set_invalid` | `invalid_error` | `.toggleClass("has-error-invalid")` |
| `set_required` | `reqd_label` | `$(label_area).toggleClass("reqd")` |
| `set_bold` | `bold` | `$input.toggleClass("bold")` when `!draw_input` |
| `set_input_disabled` | `input_disabled` | `$input.prop("disabled")` when `!draw_input` |
| `set_max_width` | `max_width` | `.addClass("input-max-width")` |
| `show_translatable_button` | `translatable_btn` | none (an own wrapper has no place for it) |
| `refresh()` / `refresh_input()` | legacy body, inside `batch()` | — |

### 6.3 Control.vue (from base_control.js)

```vue
<script>
export default {
  name: "frappe.ui.form.Control",
  data() { return { draw_wrapper: false, tooltip_into: null, hidden_control: false } },
  mounted() { this.make(); if (this.render_input) this.refresh(); },   // the legacy constructor tail
  computed: { perm() { return this.frm?.perm } },
  methods: {
    make() {
      this.make_wrapper();
      this.wrapper = this.$wrapper.get(0);
      this.wrapper.fieldobj = this;
      if (!this.draw_wrapper) {                 // a subclass built its own wrapper (Check)
        this.$wrapper.attr("data-fieldtype", this.df.fieldtype).attr("data-fieldname", this.df.fieldname);
        this.tooltip_into = this.wrapper;       // the template teleports the tooltip into it
        this.flush();
      }
      this.tooltip = $(this.$parts.tooltip);
    },
    make_wrapper() { this.draw_wrapper = true; this.flush(); this.$wrapper = $(this.$parts.wrapper); this.wrapper = this.$wrapper; },
    refresh() {
      this.batch(() => {
        this.disp_status = this.get_status();
        if (this.$wrapper) { this.set_hidden_control(this.disp_status == "None"); this.refresh_input && this.refresh_input(); }
        if (this.df.translatable) this.show_translatable_button(this.get_value());
      });
    },
    batch(fn) { this.$fui.refreshing++; try { return fn() } finally { this.$fui.refreshing--; this.sync(); } },
    sync() { if (!this.$fui.refreshing) this.flush(); },
    set_hidden_control(hide) { if (this.draw_wrapper) this.hidden_control = hide; else this.$wrapper.toggleClass("hide-control", hide); },
    // get_status, get_value, set_value, validate_and_set_in_model, set_model_value, set_focus, toggle,
    // copy_fieldname: legacy bodies, unchanged
  },
};
</script>
<template>
  <div v-if="draw_wrapper" v-part:wrapper class="frappe-control" :class="{ 'hide-control': hidden_control }"
       :data-fieldtype="df.fieldtype" :data-fieldname="df.fieldname">
    <span v-part:tooltip class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
  </div>
  <Teleport v-else-if="tooltip_into" :to="tooltip_into">
    <span v-part:tooltip class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
  </Teleport>
</template>
```

### 6.4 ControlInput.vue (from base_input.js)

The state is `draw_input, show_input, input_disabled, input_attrs, bold, reqd_label, mandatory_error, invalid_error, max_width, label_html, label_shown, description_html, description_shown, disp_html, disp_style, disp_title, translatable_btn`, with statics `horizontal: true, html_element: "input"`.

The computeds are `wrapper_classes` (`form-group` if only_input, `input-max-width`, `hide-control`, `has-error-mandatory`, `has-error-invalid`, `has-error`) and `input_bindings` (`input_attrs` plus `class: ["input-with-feedback form-control", {bold}, df.input_class]`, `type: constructor.input_type`, `inputmode`, `autocomplete: "off"`, `disabled: input_disabled`).

Each method is the legacy body, with its markup write replaced by a state write (§6.2) and an `else` branch for unported wrappers. The full file is `prototype/controls/ControlInput.vue`.

```vue
<template>
  <div v-if="draw_wrapper" v-part:wrapper class="frappe-control" :class="wrapper_classes"
       :data-fieldtype="df.fieldtype" :data-fieldname="df.fieldname">
    <template v-if="only_input">
      <component :is="constructor.html_element" v-if="draw_input" v-part:input v-bind="input_bindings" />
    </template>
    <div v-else class="form-group" :class="{ horizontal: constructor.horizontal }">
      <div class="clearfix" :class="{ hide: !label_shown }">
        <label v-memo="[reqd_label, label_html]" v-part:label class="control-label" :class="{ reqd: reqd_label }"
               style="padding-right: 5px" v-html="label_html"></label>
        <span class="help"></span>
        <a v-if="translatable_btn" class="btn-translation no-decoration text-muted" :title="__('Open Translation')"
           @click="open_translation()" v-html="frappe.utils.icon('globe', 'sm')"></a>
      </div>
      <div v-part:input_wrapper class="control-input-wrapper">
        <div v-part:input_area class="control-input" :class="{ hide: !show_input }">
          <component :is="constructor.html_element" v-if="draw_input" v-memo="[bold, input_disabled, input_attrs]"
                     v-part:input v-bind="input_bindings" />
          <block name="input_after" />
        </div>
        <div v-memo="[show_input, bold, disp_style, disp_title, disp_html]" v-part:disp_area
             class="control-value like-disabled-input" :class="{ hide: show_input, bold }"
             :style="disp_style" :title="disp_title" v-html="disp_html"></div>
        <div v-memo="[description_shown, description_html]" v-part:help_box class="help-box small text-extra-muted"
             :class="{ hide: !description_shown }" v-html="description_html"></div>
      </div>
    </div>
    <span v-part:tooltip class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
  </div>
  <!-- a subclass built its own wrapper (Check): the parts it inherits are drawn into it -->
  <template v-else-if="draw_input || tooltip_into">
    <Teleport v-if="draw_input" :to="input_area">
      <component :is="constructor.html_element" v-part:input v-bind="input_bindings" />
    </Teleport>
    <Teleport v-if="tooltip_into" :to="tooltip_into">
      <span v-part:tooltip class="tooltip-content" @click="copy_fieldname">{{ __(df.fieldname) }}</span>
    </Teleport>
  </template>
</template>
```

A few representative methods:
```js
set_label(label) {
  if (label) this.df.label = label;
  if (this.only_input || this.df.label == this._label) return;
  const html = __(this.df.label, null, this.df.parent) || "&nbsp;";
  if (this.draw_wrapper) { this.label_html = html; this.sync(); } else this.label_span.innerHTML = html;
  this._label = this.df.label;
},
set_mandatory(value) {
  /* legacy early returns */
  const missing = Boolean(this.df.reqd && is_null(value));
  if (this.draw_wrapper) { this.mandatory_error = missing; return this.sync(); }
  /* legacy toggleClass branch */
},
set_input_areas() {
  if (this.only_input) this.input_area = this.wrapper;
  else if (this.draw_wrapper) { this.label_area = this.label_span = this.$parts.label; this.input_area = this.$parts.input_area;
                                this.$input_wrapper = $(this.$parts.input_wrapper); this.disp_area = this.$parts.disp_area; }
  else { /* legacy $wrapper.find(...) */ }
},
refresh_input() { /* legacy, unchanged: make_input, show_input_area, set_disp_area, set_description, set_label, ... */ },
```

### 6.5 ControlData.vue (from data.js)

```vue
<script>
import ControlInput from "./ControlInput.vue";
export default {
  name: "frappe.ui.form.ControlData",
  extends: ControlInput,
  static: { html_element: "input", input_type: "text", trigger_change_on_input_event: true },
  data() { return { draw_link_btn: false, draw_copy_btn: false } },
  methods: {
    make_input() {
      if (this.$input) return;
      this.input_attrs = this.get_input_attributes();   // what set_input_attributes() wrote with jQuery
      this.draw_input = true; this.flush();
      this.$input = $(this.$parts.input); this.input = this.$input.get(0); this.has_input = true;
      this.bind_change_event();                          // legacy jQuery handlers, unchanged
      this.setup_copy_button();
      if (this.df.options == "URL") this.setup_url_field();
    },
    setup_url_field() { this.draw_link_btn = true; this.flush(); this.$link = $(this.$parts.link_btn); /* legacy handlers */ },
    setup_copy_button() { if (!this.df.with_copy_button) return; this.draw_copy_btn = true; this.flush(); },
    get_input_attributes() { /* maxlength, data-fieldtype, data-fieldname, placeholder, data-doctype, style, class */ },
    set_input_attributes() {
      if (!this.draw_input) { /* Link's own input: legacy .attr/.css/.addClass */ return; }
      const attrs = this.get_input_attributes();
      if (JSON.stringify(attrs) !== JSON.stringify(this.input_attrs)) { this.input_attrs = attrs; this.sync(); }
    },
    set_input(value) { this.batch(() => { this.last_value = this.value; this.value = value;
      this.set_formatted_input(value); this.set_disp_area(value); this.set_mandatory && this.set_mandatory(value); }); },
    set_formatted_input(value) { if (!this.$input) return; const v = this.format_for_input(value); if (this.$input.val() !== v) this.$input.val(v); },
    // bind_change_event, get_input_value, format_for_input, parse, validate, in_grid: legacy
  },
};
</script>
<template extends="./ControlInput.vue">
  <template #input_after>
    <span v-if="draw_link_btn" v-part:link_btn class="link-btn">
      <a class="btn-open no-decoration" :title="__('Open Link')" target="_blank" v-html="frappe.utils.icon('link', 'sm')"></a>
    </span>
    <button v-if="draw_copy_btn" class="btn action-btn" @click="copy_value" v-html="frappe.utils.icon('clipboard', 'sm')"></button>
  </template>
</template>
```

Results in the prototype: there are no jQuery markup parses. A no-op `refresh()` does no render and causes 0 MutationObserver records. A value set with `.val()` survives re-renders. A class that jQuery removed stays removed (§14).

---

## 7. Templates of subclasses and of parent classes

- **`<template extends="./Parent.vue">` with `<template #name>` blocks** fills `<block name="name">default</block>` slots in the parent template at **build time**. The SFC plugin splices the source and compiles it as the subclass's own template, with no runtime slots and no runtime cost. A subclass with no template of its own (a JS `class Y extends X`) gets its own view component, named after itself, that uses its nearest templated ancestor's template. The splice exists only in the jsdom loader (`prototype/harness.cjs:template_source`). Writing the esbuild plugin for the desk is open issue O8.
- **Parent classes draw children** as components: `components: { ControlData }` resolves through `view_of(Class)`, and the child's attrs become its constructor options. An `@ready` listener receives the controller after its `mounted()`. `mounted()` of template-drawn children runs children first, inside the same `new`/`flush()` (`settle`), or at Vue's post flush if Vue's own scheduler mounted them.
- **Rule for layouts:** draw a form's fields from data in one go (template `v-for`), or add them one at a time with imperative `new` into the parent's element (O(1) each). Adding to a template `v-for` one item at a time costs O(siblings) per add, because that is how Vue patches a list (`patchKeyedChildren`, rc:6472). See O6.

---

## 8. Unported subclasses (the last-resort jQuery fallback)

The rule: **a template part is drawn only when the base method that switches it on actually runs.** Every ported `set_*` keeps the legacy jQuery code as an `else` branch, keyed on `draw_wrapper` or `draw_input`. Only a subclass that built that part itself reaches the branch.

**Check** (frappe's `check.js` unchanged, `prototype/legacy/check.js`) overrides `make_wrapper()` without calling super and builds `.checkbox` markup with jQuery:
- `draw_wrapper` stays false. Base `make()` puts `data-fieldtype` and `data-fieldname` on Check's wrapper and sets `tooltip_into`, and the template teleports its tooltip in.
- Check's `set_input_areas()` finds its own `.input-area`. Its `make_input()` calls `super.make_input()`, which sets `draw_input`, and the template teleports **the same** `<component :is=html_element v-bind=input_bindings>` into Check's `.input-area`. So Check takes the base class's input, and `disabled`, `bold` and attributes stay template-bound.
- Check's own `$input.removeClass("form-control")` survives later renders, because the renderer patches only the classes whose binding changed (§14).
- Label, description and display text reach Check's spans through the legacy branches.
- Check's `$wrapper[0]` carries the controller symbol, so `.remove()` of it destroys the controller.
- Known cost: the Teleport leaves two empty anchor text nodes plus a fragment's start and end nodes in the host (O7).

**Link** (`prototype/legacy/link_like.js`, the jQuery part of link.js) overrides `make_input()` without calling super:
- `draw_input` stays false, so the template draws no input.
- Link prepends its `.link-field` and input into the template's `.control-input` (a `v-part` element). Vue ignores nodes it did not create.
- `set_input_attributes`, `set_bold` and `set_input_disabled` take their `!draw_input` branches.

**JS subclasses and prototype patches.** `class MyData extends ControlData { make_input(){ super.make_input(); this.$input.addClass("mine") } }` works and is `instanceof ControlData`. A `ControlData.prototype.set_label = ...` patch made after `define()` is reached by internal calls and by template calls.

**Porting order.** Port a legacy subclass by moving its markup into a `.vue` that `extends` its parent, using `<block>`s. Until then it runs through the branches above. A subclass that overrides `make_wrapper()` **and** expects the base's label element inside its own wrapper gets legacy behaviour (labels are written by jQuery into its own spans), which is what it did before.

---

## 9. `flush()` and scheduling

### 9.1 `flush()` (define.js, `Component.prototype.flush`)

```js
flush() {
  if (!view || destroyed || $fui.rendering || on_current_chain(view)) return;   // own re-entry guards, no effect.flags
  pauseTracking();
  apart.delete(view);
  view.job();               // instance.job = effect.runIfDirty: render only if something it reads changed
  flush_below(view.subTree);// dirty child components (slot or Transition content reading controller state): issue #1 flaw 4
  settle(from);             // mounted() of template-drawn children this render added
  resetTracking();
  mark(this);               // the top element may have changed (placeholder -> wrapper)
}
```

`flush()` makes this view's DOM current when it returns. It does not drain Vue's global pre or post queues, so the scan in `flushPreFlushCbs` (rc:337-360) is never triggered by draining.

### 9.2 Views wait apart from Vue's job queue (grafted from Outlet)

Judge 2 reproduced this in Chromium: with composition as submitted, **rows whose template has a child component taking a prop** turned quadratic under "set every row, then flush every row" (6000 rows took 817 ms). The cause:
- every setter queued the row's job (`effect.scheduler = () => queueJob(job)`, rc:6332);
- `flush()` ran the job early, but it stayed in the queue;
- patching the child with new props calls `updateComponentPreRender`, then `flushPreFlushCbs(child)` (rc:6348), which scans the whole queue (rc:337).

The fix: in `onBeforeMount`, each view's `effect.scheduler` is replaced with `() => { apart.add(instance); pulse once }`. One `watch(pulse, …, {flush: "pre"})`, made outside any component, has job id -1 (`getId`, rc:393), so Vue runs it before component jobs. It runs `job()` for views still dirty at the tick. `flush()` removes its view from `apart`. Vue's queue then never holds view jobs, and the scan stays O(1).

The effect, measured in the prototype on Chromium at 6000 rows: 136.7 ms, against 872.5 ms with `FUI_APART=0` and v5's 203.2 ms (§11).

Semantics that change: a view's own pre-flush `watch()` callbacks run after the pulse renders it at the tick, not before. Views that need a watcher to fix state before a render should use `computed` (O5).

### 9.3 Re-entry

- `$fui.rendering` is set while the view's render runs.
- `on_current_chain(view)`: the current instance is the view or a descendant of it, which means the view is mid-patch.

In both cases `flush()` returns, and the pulse renders the view at the tick. `effect.flags` is not read.

---

## 10. destroy and lifetime

### 10.1 `destroy()`

- The `destroyed` flag makes `destroy()` idempotent. `wrap_destroys` (from v5) wraps every `destroy` on the prototype chain, so a legacy override that removes its own DOM through jQuery does not re-enter through `cleanData`.
- `destroy_owned($fui)` destroys first what this controller owns: imperative children and controllers made in its hooks.
- A view drawn by `new` is unmounted with `internals.um(vnode, owner ? owner.view : root, null, true)` (rc:6710). `unmountComponent` runs `beforeUnmount` synchronously, stops the scope and queues `unmounted` (rc:6844-6870). The view is then removed from `owner.owned`.
- A view drawn by a template sets `state.__dead = true` and re-renders to `null` until its parent's data drops it (O9).
- `unmark`: the element symbol and the placeholder-host entry are cleared.
- When Vue unmounts a view (its parent went), `onBeforeUnmount` calls the controller's `destroy()`, so legacy overrides run. The `destroyed` guard prevents the double destroy that the Adopted design had.

### 10.2 jQuery removal

`watch_jquery_cleanup()`, installed once:
- **`$.cleanData`** is wrapped. Over the cleaned elements it collects every controller whose top element (`view.vnode.el` or `$wrapper[0]`) is cleaned, plus the views with no element of their own whose host is cleaned. It then calls `renderer.leaving_to_jquery(elems, () => destroy_all(found))`, so Vue unmounts without removing nodes jQuery is about to remove (`replaceWith` still works). The live HTMLCollection is copied once with `Array.prototype.slice`; iterating it while removing was O(n²) in jsdom (Adopted's fix).
- **`$.fn.empty` / `$.fn.html(x)`** first destroy views that are only a placeholder drawn directly into that host, because jQuery cleans the host's children but never the host itself.
- **`$.fn.detach`** records the detached roots, so `sweep()` spares them (§10.3).

### 10.3 Native removal: `frappe.ui.sweep()` (grafted from Outlet)

Every marked controller goes into a Set of `WeakRef`s.
- `sweep()` walks the Set and drops dead or destroyed refs.
- For each live one, it takes the top node (view root element, `$wrapper[0]`, or the host for a placeholder-only view). If the node is connected, the controller is marked `was_connected`.
- If a node was connected at an earlier sweep and is not now, and no ancestor of it was `.detach()`ed, the controller is destroyed.
- `frappe.ui.start_sweeping(ms)` runs `sweep()` at idle (`requestIdleCallback`). The desk calls it once at boot.

Checks H3: native `el.remove()` destroys; `.detach()` spares; putting the element back works; later jQuery removal still destroys.

### 10.4 Who holds a controller

- its DOM (the symbol on its top element);
- its owner's `owned` Set, while the owner lives;
- its Vue instance and vnode, which are reachable only from the owner's `owned` Set or from a parent's `subTree`;
- the `apart` Set, until the next tick.

The root owns nothing, and the sweep registry holds WeakRefs. So **nothing global keeps a controller alive.**

Checked with `--expose-gc`: 402 of 402 WeakRefs cleared (200 removed by jQuery, 200 drawn into a detached div that was dropped without jQuery, and a Section with a template child).

**Owner teardown.** Removing a Section destroys its template children and imperative children. A plain Host component's unmount destroys the control it made in `onMounted`.

---

## 11. Performance

### 11.1 Why nothing is n²

- **Attach is O(1)**: one patch of the view's own vnode into its host, with the owner as `parentComponent`. The owner and the root do not re-render, and ownership is a `Set.add`. The old outlet re-rendered a list of every view on each add.
- **Destroy is O(own subtree)**: `um(vnode)` plus a `Set.delete`.
- **jQuery removal** is one pass over the cleaned elements.
- **`flush()` costs what its view costs**: `runIfDirty`, then a walk of this view's `subTree`. Vue's queues are never drained.
- **View jobs stay out of Vue's queue** (§9.2), so patching a child with new props never scans n queued jobs.
- **No-op refresh**: setting the same value on `shallowReactive` does not trigger, so `job()` finds the view clean and there is no render and no DOM write.
- **Template `v-for` children** cost what Vue normally costs: mounting them all at once is linear, while adding them one at a time is O(siblings) per add (O6).

### 11.2 Numbers

**Chromium** (Playwright, production Vue, medians of 5, ms; `prototype/browser/run.cjs`, results in `prototype/perf-chromium.txt`). "create" means n sibling rows into one host. "kid" means rows with a child component taking a prop: set every row, then flush every row.

| impl | n | create | set+flush | destroy() each | `$(host).empty()` | kid |
|---|---:|---:|---:|---:|---:|---:|
| v8 | 100 | 3.3 | 1.3 | 0.9 | 0.9 | 4.0 |
| v8 | 1000 | 24.4 | 12.1 | 5.7 | 3.9 | 20.8 |
| v8 | 3000 | 67.0 | 38.3 | 14.1 | 9.9 | 66.5 |
| v8 | 6000 | 151.6 | 84.9 | 33.2 | 20.8 | 136.7 |
| v5 | 1000 | 29.7 | 15.8 | 9.9 | 7.3 | 25.6 |
| v5 | 3000 | 92.3 | 50.8 | 25.5 | 22.0 | 85.0 |
| v5 | 6000 | 160.1 | 126.5 | 58.6 | 47.6 | 203.2 |
| v8, `FUI_APART=0` (Vue's scheduler) | 1000 | 35.8 | 12.9 | 5.2 | 4.0 | 28.8 |
| v8, `FUI_APART=0` | 3000 | 69.2 | 40.3 | 15.9 | 12.8 | **229.1** |
| v8, `FUI_APART=0` | 6000 | 130.2 | 93.1 | 63.9 | 19.6 | **872.5** |

For reference, the old outlet took about 1000 ms to create 1000 rows. The Outlet design took 54 ms for 1000 in its own Chromium run.

**jsdom** (prod Vue, `prototype/perf-jsdom.txt`; indicative only):

| | n | create | set-all+flush-all | destroy() | `.empty()` | kid |
|---|---:|---:|---:|---:|---:|---:|
| v8, siblings | 1000 | 30.2 | 13.1 | 8.5 | 9.1 | 25.7 |
| v8, siblings | 3000 | 116.4 | 49.5 | 27.3 | 30.1 | 84.8 |
| v8, siblings | 6000 | 317.0 | 118.7 | 85.2 | 109.6 | 186.2 |
| v5, siblings | 1000 | 39.3 | 18.0 | 21.1 | 22.1 | 27.3 |
| v5, siblings | 3000 | 128.8 | 81.7 | 44.2 | 80.8 | 105.3 |
| v8 `FUI_APART=0`, siblings | 6000 | | | | | 1406.1 |

500 Data controls in jsdom (prod, medians of 5, ms):

| | create | refresh (no change) | set_input | refresh (reqd toggled) |
|---|---:|---:|---:|---:|
| frappe's own jQuery controls | 648.7 | 41.1 | 41.3 | 72.6 |
| v5 | 454.4 | 36.9 | 61.1 | 149.2 |
| v8 | 458.3 | 11.4 | 68.8 | 56.4 |

Children of one Section in jsdom (ms): drawing all at once from the template takes 154 / 498 / 966 for 100 / 500 / 1000 fields. Adding them one at a time with `add_field()` takes 133 / 626 / **1510** (O(n) per add). Imperative `new` into the body takes 122 / 503 / 882, and `$(section).remove()` takes 10 / 48 / 92.

### 11.3 Known constant costs

- About 4 small renders per control on create: the placeholder, the wrapper, the input, and the refresh. Composition is at parity with v5 here, so Adopted's "pre-enable `draw_wrapper`" idea was not needed. It remains available if Chromium profiling of real forms says otherwise.
- `set_input` is about 1.6x slower than legacy jQuery in jsdom: one Vue render and patch costs more than `.val()` plus `.html()`. `v-part` directives keep part elements from being static-hoisted and queue one `updated` post callback per part per render (O10).

---

## 12. Grafts applied, and the judges' flaws, one by one

| raised by | flaw or recommendation | resolution | where |
|---|---|---|---|
| J2 | kid set+flush quadratic (817 ms at 6000 in Chromium) | **fixed**: views wait apart from Vue's queue (§9.2); now 137 ms at 6000 | define.js `apart`; bench `kid`; check H1 |
| J2 | `new` from a render, computed or watch getter loops | **fixed**: `pauseTracking`/`resetTracking` around `new` and `flush()` | define.js `draw`, `flush`; check H2 (fails with `FUI_PAUSE=0`) |
| J1, J2 | composition never run in Chromium | **done**: `prototype/browser/`, with v5 and a `FUI_APART=0` variant | perf-chromium.txt |
| J1, J2, J3 | native DOM removal waits for GC, no sweep | **fixed**: `frappe.ui.sweep()` plus `start_sweeping()`, sparing `.detach()` | define.js; check H3 |
| J1, J2, J3 | verify the internals at load, including arity | **done**: `verify()` at `app.mount` checks `p`/`um` presence and `.length`, mounts a probe with a parentComponent (parent and inject), checks `instance.job` and `effect.scheduler`, and checks that unmount removes | define.js `verify` |
| J1 | get the renderer through a KeepAlive function ref | **done** (no `FrappeUiAttach` child) | define.js `take_renderer` |
| J1 | keep the rendered-ancestor guard and the single-destroy guard | **kept** | `parent_instance`, `destroyed` flag, `wrap_destroys` |
| J1, J3 | adopt `cleanData` live-collection copy | **already in** composition's renderer (`slice` once) | renderer.js |
| J3 | getCurrentInstance()-first parent choice in hooks and watchers | **kept as is**: composition already uses the current instance when no controller's DOM contains the host (rule 3 of §5); DOM containment wins, as in a template | `owner_for` |
| J3 | keep Adopted's single `v-if` root, one host node per control | **already so** in composition's ControlInput template; rule 7 of §6.1 adds the dev-build comment gotcha | §6.1 |
| J1, J2, J3 | imperatively drawn views are missing from the devtools tree; `app.unmount()` does not reach root-owned views | **open** (O1, O2), with a plan | §16 |
| J2 | Check leaves Teleport anchors in its host | **open** (O7): optional, and the `_vte` symbol is deliberately not used | §16 |
| J1, J2, J3 | internal `ctx.renderer` and positional signatures | **mitigated** by `verify()`; remains a dependency (O4) | §13 |
| J3 | `<template extends>` needs a real build plugin | **open** (O8) | §16 |
| J1, J3 | `new` in setup before first render misses that component's provide | **open, documented** (O3) | §16 |
| J1, J3 | template `v-for` adds one at a time are O(siblings) | **open, with a rule**: use imperative `new` for incremental adds (O6) | §7 |
| J3 | two construction paths with different orders | **documented** (O11) | §16 |
| J1 | parent fixed at construction | **open, same as legacy** (O12) | §16 |

---

## 13. Vue internals used

Each one is checked against Vue 3.5.43, with the reason and whether it is avoidable. v5 used `instance.job`, `effect.dirty`, `effect.flags`, `effect.scheduler`, `scope.effects`, five `subTree` walks, `bm`/`m` hook arrays, `container._vnode` and `app._context`. v8 uses only the following.

| # | internal | source | why | avoidable? |
|---|---|---|---|---|
| 1 | **KeepAlive's `instance.ctx.renderer` (`p` = patch, `um` = unmount)**, read through a function ref on `<KeepAlive>` | rc:6088-6090 (`if (isKeepAlive(initialVNode)) instance.ctx.renderer = internals`); internals object rc:6915-6926; KeepAlive reads it rc:2868-2891; function refs are synchronous rc:1823-1824 | The only way to mount a component synchronously with a chosen `parentComponent` and without re-rendering that parent. Public `render()` passes `parentComponent = null` and drains the queues (rc:6888-6912). A parent-rendered list makes every add O(siblings) (the outlet's n²). | Only by giving up something else: separate roots (v5) lose the one tree, and an outlet list re-renders. A public `mountChild(vnode, el, parentInstance)` in Vue would remove it. |
| 2 | **Positional signatures** `patch(n1, n2, container, anchor, parentComponent, parentSuspense, namespace)` and `unmount(vnode, parentComponent, parentSuspense, doRemove)` | rc:5505, rc:6710 | How #1 is called. | Same as #1. `verify()` checks `.length === 3` for both and mounts a probe. |
| 3 | **`instance.job`** (= `effect.runIfDirty.bind(effect)`) | rc:6329; `runIfDirty` re:304-308 (marked `@internal` there) | `flush()` needs a synchronous re-render that does nothing when clean (`$forceUpdate` only queues). It gives a no-op refresh with no DOM writes without reading `effect.dirty` or `flags`. Also used by the apart pulse. | `instance.update` (rc:6328) would work but always renders. There is no public synchronous update. |
| 4 | **`instance.effect.scheduler` replaced** for views | rc:6332 (`effect.scheduler = () => queueJob(job)`); the scan it avoids: rc:6348 → rc:337-360; `scheduler` is a declared public field of `ReactiveEffect` in reactivity.d.ts | Keeps view jobs out of Vue's queue, so set-all then flush-all with child components stays linear (§9.2): 137 ms vs 873 ms at 6000 in Chromium. | Yes, at that cost: `FUI_APART=0`. |
| 5 | **`instance.subTree`** and **vnode `.component` / `.dynamicChildren` / `.children` / `.suspense.activeBranch`**: one walk in `flush_below()`, plus `!inst.subTree` in `parent_instance()` | subTree assigned rc:6166 / 6203; `setScopeId` reads `parentComponent.subTree.patchFlag` rc:5797-5800 | `flush_below` runs a child component's own dirty render (slot or Transition content reading controller state), fixing issue #1 flaw 4. `parent_instance` avoids the TypeError in `setScopeId` for a parent that has not rendered. One walk, down from v5's five. | `flush_below` can be dropped per class if such child renders may stay async. `parent_instance` could use `instance.isMounted`, which is equally internal. |
| 6 | **`instance.isUnmounted`** in the apart pulse | set in unmountComponent rc:6844-6870 | Skip views unmounted before the tick. | Yes: our own `$fui.unmounted` is also checked. |
| 7 | Fields with public equivalents: `instance.parent` (`$parent`), `instance.vnode.el` (`$el`), `instance.slots` (`$slots`), `instance.proxy`, `instance.provides` (only in `verify()`, to add and remove one probe key on the root) | publicPropertiesMap rc:3415-3422; provides rc:8102 | Parent walks, root-element marking, `$slots`, and the directive's `binding.instance` → controller map. | Each has a public equivalent through the proxy; the internal fields avoid proxy traps on hot paths. |
| 8 | **`callWithAsyncErrorHandling`** (exported) with code 5 (NATIVE_EVENT_HANDLER) in the renderer's listener patch | export rc:8820; handleError rc:227-257 | Template listeners are bound through jQuery so `.trigger()`/`.off()` reach them. This sends their errors back through `errorCaptured` up the one tree and then `app.config.errorHandler` (v5 lost that). | Yes, by calling `app.config.errorHandler` directly, which loses `errorCaptured`. |
| 9 | Behaviour relied on (documented semantics): directive `created`/`beforeMount` are synchronous during patch; template refs and `onMounted` are post-flush and get appended to an active post flush | rc:5745, rc:5766; setRef post rc:1866-1873; flushPostFlushCbs rc:362-373 | This is why parts use a directive and `mounted()` is called by `new`. | Nothing to remove. |
| 10 | `pauseTracking` / `resetTracking` from `@vue/reactivity` | re:498 / re:506; declared in reactivity.d.ts:321 | §5 step 1. | Public in `@vue/reactivity` but not re-exported by `vue`. The desk bundle must import it from `@vue/reactivity` and resolve it to the same copy as `vue` (one runtime). |

**Not used, unlike v5:** `effect.flags`, `effect.dirty`, `scope.effects`, `bm`/`m` arrays, `container._vnode`, `app._context`, `render()` as a queue drain. **Not used, unlike Outlet:** the private Teleport `Symbol('_vte')`.

### 13.1 `verify()`

It runs at `app.mount` and throws `frappe.ui: this Vue is not one the frappe.ui runtime supports (...)` if any of these fail:
- `internals.p` and `internals.um` exist with `.length` 3 and 3;
- a probe component mounted with `p(null, h(Probe), fragment, null, root)` has `instance.parent === root` and sees a key provided on root;
- the probe has `instance.job` and an `effect` with `scheduler`;
- `um(vnode, root, null, true)` empties the fragment.

The desk's CI should run the prototype's checks on every Vue minor upgrade.

---

## 14. Reused from v5

- **`renderer.js`** (prototype/runtime/renderer.js) is v5's jQuery-aware DOM renderer without `mount_point`:
  - a node keeps the parent Vue gave it (`vue_parent`), so Vue still finds a node that legacy code detached;
  - **changed:** `patch_class` adds and removes only the classes that changed in Vue's own binding, so a class jQuery removed (Check's `removeClass("form-control")`) or added stays as jQuery left it (v5 re-added every bound class);
  - `value` is written only when the bound value changes;
  - listeners are bound with jQuery under namespace `.vue`, so `.trigger()` reaches them and `.off()` removes them; **changed:** errors are routed through `callWithAsyncErrorHandling`;
  - `leaving_to_jquery(nodes, fn)` stops Vue from removing nodes jQuery is about to remove (`replaceWith` keeps working); **changed:** the live collection is copied once.
- **`wrap_destroys`**: the re-entry guard for `destroy()` overrides that remove their own DOM through jQuery.
- **`define_field`**: a computed that a caller's own assignment overrides.
- The `.vue` → `frappe.ui.define` emit convention and the global-path assignment.
- The `$.cleanData` hook idea and `$.fn.empty`/`.html` host checks.
- **Dropped from v5:** one root per controller (`render(view, mount_point)`), `schedule_apart` with `scope.effects`/`has_watchers`, `settle()` draining post queues, `root_nodes`/`top_nodes`/`element_regions` walks, `container._vnode`, `app._context` copies, and `vue_internals.js`.

---

## 15. Prototype

`/tmp/claude-1001/v8/prototype/` is composition plus the grafts in §12.

| file | what |
|---|---|
| `runtime/define.js` | the runtime (768 lines): create_app, verify, define, Component, draw/new, view_of/setup_view, flush, apart, sweep, jQuery hooks |
| `runtime/renderer.js` | desk renderer (§14) |
| `controls/Control.vue`, `ControlInput.vue`, `ControlData.vue` | template-first port of base_control.js, base_input.js, data.js |
| `legacy/check.js`, `legacy/link_like.js` | unported subclasses (check.js verbatim) |
| `demo/*.vue` | Section (template-drawn children, provide), ProbeChild, SlotHost, Failing, Nest, PerfRow, RowKid + Badge, RenderNew |
| `harness.cjs` | jsdom, Vue, compiler-sfc, jQuery from the Frappe checkout; `.vue` loader with `<template extends>`/`<block>` |
| `spike8.cjs` | 68 checks, groups A–H and G (GC) |
| `bench.cjs` | jsdom timings: `rows` (with `kid`), `controls` (legacy/v5/v8), `section` |
| `browser/` | Chromium harness: `build.cjs` (esbuild, prod Vue), `run.cjs` (Playwright), entries v8 / v5 / v8vuesched |
| `v5copy/` | the repo's v5 define/renderer/vue_internals, for comparison |
| `perf-jsdom.txt`, `perf-chromium.txt` | results quoted in §11 |
| `run.sh` | everything |

To run it:
```
. ~/fb/env.sh && cd /tmp/claude-1001/v8/prototype
node --expose-gc spike8.cjs                                    # 68 passed, 0 failed
NODE_ENV=production node --expose-gc spike8.cjs               # 68 passed, 0 failed
RUNTIME=v8 NODE_ENV=production RUNS=3 node bench.cjs rows      # also RUNTIME=v5; FUI_APART=0 SIZES=1000,3000,6000
RUNTIME=v8 NODE_ENV=production node bench.cjs controls         # also legacy, v5
NODE_ENV=production node bench.cjs section
(cd browser && node build.cjs && SIZES=100,1000,3000,6000 RUNS=5 node run.cjs)
FUI_PAUSE=0 node spike8.cjs                                    # shows the render loop that pauseTracking prevents
```

Check groups:
- A: one app.
- B: template-first ControlData, no jQuery markup, no-op refresh writes nothing, values survive.
- C: `new` inside onMounted, a watcher and created().
- D: subclasses, patches, Check, Link.
- E: provide/inject across classes, template children, listener errors to errorHandler, `new` throws on setup/render errors, slot-child flush, LIMIT check for O3.
- F: jQuery remove/empty/html, Section teardown.
- H (new): kid set+flush, apart tick, `new` in render without a loop, sweep and detach.
- G: GC, 402 of 402 collected.

---

## 16. Open issues

- **O1. Devtools tree.** Views mounted by `new` have the right `instance.parent`, but they are not in the parent's `subTree`. Vue devtools builds its tree by walking `subTree`, so they will most likely not appear. Template-drawn children do appear. This has not been checked in real devtools. Plan:
  - verify in a dev desk;
  - if they are missing, add a devtools plugin (`@vue/devtools-api` custom inspector "frappe.ui controllers") that lists controllers under their owner, using `$fui.owned` and `instance.parent`;
  - prefer template-drawn children for Vue-first layouts.
- **O2. `app.unmount()`** does not reach root-owned imperative views, because the root keeps no list by design. If the desk ever unmounts the app, it should call `$(document.body).empty()` or `sweep()` afterwards.
- **O3. `new` inside a component's `setup()` or `created()` before its first render.** The view's Vue parent is the nearest ancestor that has rendered, so that component's own `provide()` is not visible to it. Ownership and destroy still follow the component. A LIMIT check pins this behaviour.
- **O4. Internal dependency.** The core rests on KeepAlive's `ctx.renderer` and the positional `patch`/`unmount` signatures, plus `instance.job` (`runIfDirty` is `@internal`) and the replaced `effect.scheduler`. `verify()` fails loudly at mount. Re-check on every Vue minor release, and propose a public `mountChild` API upstream.
- **O5. Scheduling semantics differ from plain Vue.** These follow from the apart scheduler and from `flush()` not draining queues:
  - a view's own pre-flush `watch()` callbacks run after its tick render;
  - `onMounted`/`onUpdated`, template refs and Transition hooks of plain components inside a view keep Vue's timing.
- **O6. Template `v-for` children added one at a time** cost O(siblings) each (1510 ms vs 966 ms for 1000 in jsdom). The rule: render layouts from data in one go, and use imperative `new` for incremental adds. Shelving the list, the Outlet idea, is the fallback if a real form needs it.
- **O7. Teleport placeholders in Check's host.** Check's host holds Teleport anchors and fragment comments. Outlet kept them out using the private `'_vte'` symbol, which was deliberately not taken. An alternative without the symbol (teleporting from an offstage, disabled root) is untested.
- **O8. Build tooling.** `<template extends>`/`<block>` and the `frappe.ui.define` emit exist only in the jsdom loader and in `browser/build.cjs` (that one without blocks). The desk's esbuild SFC plugin needs both, plus an `@vue/reactivity` alias to the same copy that `vue` uses. The open issue from v5 remains: the desk must share one Vue runtime across bundles.
- **O9. Leftover placeholder.** A template-drawn controller destroyed by legacy code or by jQuery leaves a comment node until its parent's data drops it.
- **O10. `set_input` cost.** It is slower than legacy jQuery in jsdom (69 ms vs 41 ms for 500 fields), because `v-part` disables static hoisting and queues an `updated` callback per part per render. A compiler transform that turns `v-part` into a mount-only vnode hook would remove that. This has not been measured in Chromium.
- **O11. Two construction orders.** For a template-drawn controller, a legacy JS subclass constructor's body runs before the view mounts. For `new`, it runs after `mounted()`, as in legacy.
- **O12. Parent fixed at construction.** The parent comes from DOM position (or the running hook) when `new` runs. Moving a controller's DOM later with jQuery does not re-parent it: its provides, error handling and lifetime stay with its creator.
- **O13. Sweep limits.**
  - `sweep()` is scheduled only if the desk calls `start_sweeping()`.
  - Content that a popover removes natively and re-inserts later (Bootstrap uses `removeChild`) would be destroyed if a sweep runs in between. Such hosts need `.detach()` or an exemption.
  - Dead WeakRefs are pruned only when `sweep()` runs; a `FinalizationRegistry` could prune them sooner.
  - A view whose host is removed natively by its parent's own re-render is destroyed by the next sweep, not at once.
- **O14. Only `data()` keys are reactive.** A legacy subclass that changes a non-state field bound in the template (`df.label`) sees no re-render unless it goes through a ported `set_*`. A subclass class field with the same name as a `data()` key shadows the accessor on that instance.
- **O15. Port coverage.** Not ported or simplified:
  - InfoCard (documentation_url, show_description_on_click);
  - description code highlighting;
  - barcode, IBAN and autoname extras of data.js;
  - the frm/perm branch of `get_status`;
  - grids, web forms, and the rest of the controls.
  
  Every ported `set_*` carries two paths (template state and the jQuery fallback) until all subclasses are ported.
- **O16. No real-desk run.** Timings are jsdom plus standalone Chromium pages. frappe's Playwright specs have not been run against v8.
