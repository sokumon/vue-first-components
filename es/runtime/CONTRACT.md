# es-* elements on a jQuery page: the contract

`wc/jq` turns every capitalised component export of frappe-ui into a custom element `<es-kebab-name>` (83 tags) and every @framework/ui component into `<es-fw-kebab-name>` (72 tags). jQuery stays the page's driver, as in Desk. No `.vue` file is edited, and nothing is written per component. All the behaviour below comes from one runtime, `src/runtime.js`.

`test.cjs` checks every rule in this file, driving the page with jQuery 3.7.1 only.

## 0. Design: one app, one Teleport per host

```
createApp(EsRoot), mounted once into <es-app> at the end of <body>
EsRoot ─ ToastProvider, Dialogs                          (the hosts for toast() and dialog())
       ─ EsGroup × ⌈n/256⌉ ─ EsBucket × 16 ─ <Teleport :to="host" :key> ─ EsNode ─ <Component …props …listeners>{slots}
                                                                                    slot fn → EsSlotOutlet → <es-slot>
                                                                                       ├ moves the host's light-DOM nodes in
                                                                                       └ <Teleport :to="nestedHost"> ─ EsNode ─ …
```

- **The app is created once**, on the first connect. When an element connects, it registers itself. If it is top level, its entry goes into a bucket of 16 entries. The bucket renders `<Teleport :to="host">` → `EsNode` → the component, so the component's DOM is drawn inside the host.
- **Nested elements.** An element inside another element's slot content is not registered at the top. The outlet that renders that slot finds it and renders the Teleport itself. So `es-tab-trigger` sits under `TabList` and `TabsRoot` in the Vue tree. Provide/inject, `useId`, error capture, app plugins and devtools all see one tree. Test: the trigger's instance chain is `TabTrigger < EsNode < EsSlotOutlet < … TabsList < TabList < EsNode < EsSlotOutlet < … TabsRoot < Tabs < EsNode < EsBucket < EsGroup < EsRoot`.
- **Disconnect** unregisters the element: the bucket or outlet renders again without it.
- **Mounting is synchronous.** Each connect calls the parent's `instance.update()` (bucket, group or outlet), so `$x.appendTo(…)` is followed by `$x.find('button')` on the next line. The two-level tree keeps each connect to one render of at most 16 Teleports.
- **Post-flush work runs at once.** After that render, a re-render of a spare `<i>` through the public `render()` flushes Vue's post-flush queue. Template refs and `onMounted` are then done before control returns, so `el.focus()` works straight after `appendTo()`.
- **Why no `defer` on the Teleport.** The host already exists when the Teleport mounts, and `defer` would move the mount into the post-flush queue, which would make it asynchronous.
- **Why this design instead of v8's renderer patch.** The Teleport design held up, so there was no need to fall back to v8.
- **Vue internals used.** Each is checked when the app starts (`verifyInternals`) and fails loudly if it has moved:
  - `instance.update()`, to render synchronously.
  - `teleportVNode.targetStart/targetAnchor`, to tell Vue's nodes in a host from nodes jQuery put there.
  - A component ref's `.$`, to read `exposed`.
  - vnode `el`/`anchor`/`subTree`, when re-reading a host.

## 1. Loading

**Test pages (no CSS of their own):**

```html
<link rel="stylesheet" href="dist/es-ui.css">   <!-- Tailwind with preflight, host rules, :not(:defined) guard -->
<script src="jquery.js"></script>
<script src="dist/es-ui.iife.js"></script>       <!-- bundles its own Vue; sets window.ES -->
```

**Desk:**
- `import { ES } from "…/dist/esm/es-ui.js"`. That module leaves `vue` as a bare import, so Frappe's esbuild resolves it through `nodePaths` to Desk's own Vue. Every name resolves, and no name list like `vue_global.js` is needed.
- `scripts/esm-check.mjs` checks this. It uses frappe's esbuild 0.28.1 with frappe's `nodePaths` and defines. The bundle contains exactly one `@vue/runtime-core`, the copy in `frappe-bench/apps/frappe/node_modules` (vue 3.5.43, which satisfies frappe's `^3.5.13`). `ES.Vue.createApp` is the same function as the Vue that the entry imported.
- Load `dist/es-ui.scoped.css` with it (section 9).

## 2. Creating

- These all work:
  - `$('<es-button label="Save">')`
  - `$('<es-button>').attr(…)`
  - `document.createElement('es-button')` followed by `el.label = …`
  - Markup in the HTML.
- An element renders when it connects, synchronously: the component's DOM is inside the host on the next line.
- **Parser-created elements** (static markup) render at `DOMContentLoaded`, in one batch.
- **`ES.batch(fn)`** holds rendering back while `fn` runs and renders everything it connected in one pass before it returns. Use it when appending many elements in a loop.

## 3. Attributes and properties

| write | effect |
|---|---|
| `.attr('label', 'Save')` | String prop. Kebab names map to camel props (`model-value` → `modelValue`). |
| `.attr('disabled', true)` / `.attr('loading', '')` / `'true'` | Boolean prop `true`. |
| `.attr('disabled', false)`, `.removeAttr(x)`, or the value `"false"` | The prop is unset, so the component's default applies. A Boolean prop also reads `"false"` as `false`. |
| `.attr('size', '3')` | Number for a `Number`-only prop. JSON for an `Object`/`Array`-only prop. |
| `.prop('options', [...])`, `.prop('field', {...})`, `.prop('modelValue', x)`, a function | Any value. The hyphenated form (`.prop('model-value', x)`) works too. |
| other attributes (`placeholder`, `aria-*`, `data-*`, `class`, `style`) | Passed to the component as attributes under their own names. `class` and `style` land on the component's root, because the host is `display:contents`. |
| `id`, `slot` | Stay on the host only and are never passed. A component's own `id` prop is set with `es-id="…"`. |
| `title`, on a component with a `title` prop | Becomes the prop. The attribute moves to `es-title`, so the host shows no native tooltip. Read it back with `.prop('title')`. |

- **Before and after insertion.** Both work:
  - Values set before the element upgraded (as own properties) are picked up.
  - Attributes set before insertion are read on connect.
- **Re-rendering.**
  - A change re-renders in a microtask, like Vue's own scheduler.
  - `ES.flush()` renders all pending changes now.
  - A property read (`el.label`) always returns the latest value.
- **Only what the page set is passed.** Defaults are never forwarded as values, so `defineModel` stays uncontrolled until the page or the user sets it.

## 4. Events

- Every declared emit is dispatched on the host as a `CustomEvent` with the emit's name, plus its hyphenated form when that differs (`update:modelValue` and `update:model-value`).
- The payload is in `e.originalEvent.detail`: the one argument, or an array when there are several. Events bubble, so check `e.target === e.currentTarget` if a nested element could send the same name. They are cancelable.
- **v-model.** On `update:x` the element stores the value in its `x` prop, as an `<input>` keeps its value. Calling `e.preventDefault()` vetoes it, which gives a controlled element.
- **Native events never collide with emits.** When a component declares an emit with a native name (`change`, `click`, `focus`, …), a native event of that name coming out of the host's DOM stops at the host. So `.on('change')` receives exactly one event, the component's, with its value. Delegated handlers above the host see only that event too.
- Native events whose names no emit declares (`click` on `es-button`, `keydown`, …) bubble normally.

## 5. Exposed members

- After mount, whatever the component exposes (`defineExpose`) is copied onto the host. Examples: `el.focus()`, `el.inputElement`, `el.open()`, `el.close()`.
- An exposed name that is already a DOM member is not copied, except `focus` and `blur`.
- A method call runs `ES.flush()` first.
- `el.focus()` on any host focuses its first focusable descendant.
- `el.esComponent` is the component's public instance.

## 6. jQuery writes into a host

- **Rule:** Vue's nodes sit between the Teleport's two anchors in the host. Anything outside them is slot content. One `MutationObserver` watches every host (attributes and direct children only). It is drained synchronously on connect, on property reads and on `ES.flush()`.

| call on the host | result |
|---|---|
| `.append(x)` / `.prepend(x)` / `appendChild` | `x` joins its slot (`slot="name"` or `default`) at the end or the start. The component keeps its state, and the outlet places `x`. |
| `.text('Save')` / `.html('<b>…</b>')` / `.empty()` / `innerHTML =` | The anchors are gone. What is left in the host becomes the new slot content (none, for `.empty()`) and the component is mounted afresh. Its own state resets; props and listeners stay. The element never dies silently. |
| `.find(…)`, `.on(…)`, reading the rendered DOM | Fine. |
| changing nodes inside a slot (`$host.find('.my-item').text(…)`) | Fine: inside handed-out slot nodes, jQuery owns the DOM. |
| changing nodes Vue rendered (`$host.find('button').remove()` or `.addClass`) | Not supported. Vue may overwrite or crash on them. Change props instead. |

## 7. Removal, detach, clone

| call | result |
|---|---|
| `.remove()` (and `.html()`/`.empty()` on an ancestor) | Unmounts at once. A hook on `$.cleanData` marks the element, and the disconnect then unmounts. Re-inserting it later mounts it fresh with its slot content. |
| `.detach()`, then re-append in the same task or the next animation frame | Keeps the mounted component and its state. The Teleport content travels inside the host. |
| `.detach()` and nothing more | Unmounts after the next frame. Re-appending later mounts fresh. |
| moving to a different parent kind (top level ↔ inside another element's slot) | The element is re-parented in the Vue tree, so its state resets. |
| `.clone()` / `cloneNode(true)` | Copies the attributes and the slot content. That includes slot nodes that were rendered: they are recovered from the clone's outlets. Stale render output is dropped, and the clone mounts on its own. Properties set with `.prop()` are not cloned, as with native elements. |

## 8. Slots

- **Children are slot content.** The host's children at first connect, and anything appended later, become slot content. A node with a `slot` attribute (`slot="body"`) goes to that named slot; the rest go to `default`.
- **Nodes keep their handlers.** The first outlet of a slot shows the live nodes, with their jQuery handlers and data intact.
- **Slots rendered more than once.** When a slot is rendered more than once at the same time, the later outlets get deep clones.
- **Unrendered content stays findable.** Slot content that is not rendered at the moment (a closed dialog's body) waits in a hidden `<es-slots>` inside the host, so `$('#id')` still finds it. Once it is rendered, it lives in the component's DOM, which may be teleported to `<es-portal>`.
- **Per-row and scoped slots.** When a slot's only content is a `<template slot="x">`, it is stamped on every call: per row, per tab, per option.
  - Elements with `data-es-text="path.in.slot.props"` get that value as their text.
  - The host fires `es-slot` (not bubbling) with `detail = { name, scope, el, nodes, update }` for each stamp and update, so jQuery can fill in the rest:

```js
$('<es-tabs>').prop('tabs', rows)
  .append('<template slot="tab-label"><span data-es-text="tab.label"></span></template>')
  .on('es-slot', (e) => { const d = e.originalEvent.detail; $(d.nodes).toggleClass('hot', d.scope.tab.hot) })
```

- **Outlet behaviour.** The outlet (`<es-slot>`) is `display:contents`. It measures, focuses and mirrors `aria-*`/`role`/`data-state` onto its content, and it re-sends focus and blur. Reka `as-child` triggers (Dropdown, Popover, Tooltip) therefore anchor and position correctly.

## 9. CSS

- **Host rules.** Hosts are `display:contents`, and `<es-app>`, `<es-portal>` and `<es-slot>` are too.
- **The host answers for its content.** `getBoundingClientRect()` and `getClientRects()` return the content's box, so jQuery's `:visible`, `.offset()` and floating-ui work on a host.
- **Guard before definition.** `:where(<all tags>):not(:defined) { visibility: hidden }` keeps markup hidden until the bundle defines it. It is in both sheets, which must load before the bundle. The JS also injects the host rules (`style[data-es-ui-base]`) in case no sheet is loaded.
- **`dist/es-ui.css`.** Global Tailwind with the frappe-ui preset and preflight, for pages that have no CSS of their own.
- **`dist/es-ui.scoped.css`, for Desk (Bootstrap).**
  - Every rule is nested under `:where(<all es-* tags>, es-app, es-portal)`. That keeps specificity at zero.
  - Preflight's `html`/`body` rules land on those scope roots.
  - `:root` variables stay global.
  - Page markup that uses the same class names (`.px-2`, `.border`) is untouched, and so is `body`.
  - All frappe-ui overlays teleport into `<es-portal>`, because the app provides frappe-ui's `portalTargetKey`. So menus and dialogs are inside the scope.
  - This is the stylesheet form of the `mobile-nav.css` approach (styles scoped to the element names, injected once). It is generated from Tailwind's output rather than written by hand.

## 10. The app

| API | what it does |
|---|---|
| `ES.app` | The one Vue app. |
| `ES.configure(fn)` | Runs `fn(app, ES)` now if the app exists, or when it is created. Use it for `app.use(router)`, `app.provide(k, v)` and plugins. |
| `ES.toast`, `ES.dialog` | frappe-ui's imperative APIs. Their hosts (`ToastProvider`, `Dialogs`) are rendered once at the root. |
| `ES.Vue`, `ES.VueRouter`, `ES.frappeUI` | The modules the bundle uses. |
| `ES.flush()` | Renders pending changes now. |
| `ES.tick()` | Waits for Vue's next flush. |
| `ES.batch(fn)` | Holds rendering while `fn` runs (section 2). |
| `ES.stats()` | Counts groups, buckets and top-level elements. |
| `ES.registered` | The registered tags. |

- **Shared app state.** frappe-ui's resource fetcher is set to `frappeRequest`, so @framework/ui fields talk to a Frappe backend at `/api/method/*`.
- **Element ids.** Ids come from one `useId` counter, so they are unique page-wide.
