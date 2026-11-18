# Vue-first frappe.ui

Design spikes for drawing Frappe's legacy `frappe.ui.*` classes with Vue, while their public API stays the same: names, constructor signatures, prototype methods, and the jQuery fields (`$wrapper`, `page.main`, `$items_container`, ...) that client scripts and apps rely on.

Each folder is one iteration. Open `index.html` for the full write-up.

| Folder | Idea | Outcome |
| --- | --- | --- |
| `spike.cjs` | Class is the controller, `static view` SFC, constructor returns `shallowReactive(this)`, one `createApp` | 24/24 |
| `v2/` | No mount in the class: controllers join `frappe.ui.views`, a `ViewOutlet` in the App teleports each view into its host | 21/21, then 23/23 without regions |
| `v3/` | `frappe.ui.Sidebar` and `sidebar_item.Type*` with their real API; a desk renderer that survives jQuery `.html()` and routes listeners through jQuery so `.trigger()` reaches them | 31/31 |
| `v4/` | The `.vue` file *is* the class: an Options API component with `name: "frappe.ui.Sidebar"` is compiled into a real class (`define.js`) | 42/42 |
| `v5/` | v4 plus `<script setup>` next to the public `<script>`; setup runs in the constructor and its bindings read as `this.x` | **Chosen design** |
| `v6/` | Functional components / detached `draw()` for leaves | Rejected: no gain; found the outlet's cost |
| `v7/` | No outlet: each controller teleports from its own detached root | Rejected; kept as the measured baseline |
| `browser/` | Probe for a real desk in a browser | |

## Running

The spikes run in Node with jsdom. They load Vue, `@vue/compiler-sfc` and jQuery from a Frappe checkout, and jsdom from its `flow/` app:

```sh
FRAPPE=/path/to/apps/frappe node v5/spike5.cjs
```

`FRAPPE` defaults to `../../frappe` relative to this folder. Node 22 or newer. The browser probe needs Playwright (`PLAYWRIGHT=/path/to/playwright` if it isn't resolvable).
