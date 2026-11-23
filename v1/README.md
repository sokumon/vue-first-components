# v1: the class is the controller, `static view` draws it, one `createApp`

| | |
| --- | --- |
| **Status** | Superseded by v2 |
| **Builds on** | — |
| **Question** | Can a legacy `frappe.ui` class stay the public API (constructor, prototype methods, jQuery fields) while a Vue template draws it, inside one `createApp`? |
| **Answer** | Yes for `frappe.ui.Page` and `frappe.ui.Sidebar` in jsdom: callers, subclasses, prototype patches and jQuery writes keep working. Plain array mutation does not re-render. |
| **Checks** | `24/24` in jsdom; real desk: not run (jsdom only) |

## Idea

- The code is one file at the repository root: [`../spike.cjs`](../spike.cjs). It was not moved into this folder.
- `frappe.ui.Component` is the base class. Its constructor copies `opts` onto `this`, wraps the instance in `shallowReactive(this)`, runs `make()` inside an `effectScope`, mounts the view, and returns the reactive proxy. So every `this.x = y` in any method re-renders.
- Each class names its view with `static view` (a component with a template string) and the prop name with `static prop`.
- `mount()` calls Vue's `render()` into `this.host` (the `parent` option, read through jQuery), with the vnode's `appContext` set to the one app's `_context`. That gives every view the app's provides (`desk.theme`) and global components.
- One `createApp` is mounted into `[data-fui-root]` and kept as `frappe.ui.app`.
- Elements the controller builds with jQuery (`page.sidebar`, `page.main`, `$items_container`) are placed by a `Region` component, which appends the element into a `display: contents` div. Vue only places them; jQuery fills them.
- `flush()` calls the root component's `update()` for callers that read the DOM right after a setter (`add_inner_button` uses it to return the real button).

## What's here

| File | What it is |
| --- | --- |
| [`../spike.cjs`](../spike.cjs) | The whole spike: jsdom setup, `frappe.ui.Component`, `Region`, `frappe.ui.Page` with `PageView`, `frappe.ui.Sidebar` with `SidebarView`, and the 24 checks |

## How to run

From the repository root (the script resolves `FRAPPE` from its own folder, so the working directory does not matter):

```sh
FRAPPE=/path/to/apps/frappe node spike.cjs
```

`FRAPPE` defaults to `../../frappe` relative to the repository root. It needs a Frappe checkout with `node_modules/vue`, `node_modules/jquery` and `flow/node_modules/jsdom`. A passing run prints one `ok` line per check and ends with:

```
24 passed, 0 failed
```

and exits 0 (1 if any check fails).

## What it proved

- The jQuery fields stay the same objects: `$wrapper is the parent the container made`; `identity: registry holds the same object callers have`.
- The constructor draws synchronously: `head renders synchronously in the constructor`; `legacy regions are in place synchronously`.
- One app context reaches every view: `view got the app's provides (one createApp)`.
- jQuery and Vue share elements without fighting: `jQuery content in a region survives a re-render`; `a class a caller added survives other re-renders`; `jQuery .trigger('click') reaches the Vue handler`.
- Methods that return elements still do: `add_inner_button returns the real element synchronously`.
- Classes behave like classes: `a prototype patch made after construction is honoured`; ``subclass constructor `this` is the reactive instance``; `subclass override + super() still render`; `outside property writes don't throw`; `instanceof still works`.
- The Sidebar flow that opendesk uses: `add_item then children().last() works synchronously`; `a patched data method (menu_items) shows in the template`; `a click toggles state and the class follows`.
- A region can be removed and restored: `v-if off takes the region out`; `v-if on puts the same element back, jQuery rows kept`.
- `destroy unmounts the view`.

## What it cost / what broke

- Setters are asynchronous: `a setter is async (Vue's scheduler)` and `...and lands on the next tick`. A legacy caller that reads the DOM on the next line needs `flush()`.
- The reactivity is shallow: `TRAP: an in-place push does not re-render (shallow)`. `page.inner_buttons.push(...)` draws nothing; `add_inner_button` has to assign a new array.
- Each controller is rendered with its own `render()` call into its host, so its view is not a child of the app's component tree; only the `appContext` is shared.
- jQuery-built parts need the `Region` wrapper, an extra `display: contents` div around each one.

## Carried forward

[v2](../v2/) kept the controller class with `static view` and `static prop`, the `shallowReactive(this)` constructor, `flush()`, and many of the same Page and Sidebar checks (some reworded, some replaced: v-show instead of v-if for the sidebar rows). It dropped the `render()`/`mount()` call in the class (its check: `the base class and views call no render(), mount() or createApp()`) in favour of a `ViewOutlet` in the App that teleports each view into its host, and later dropped `Region` (`no region construct anywhere`; the root README records 21/21, then 23/23 without regions). Its views are `.vue` files instead of template strings.

## Open questions

- Everything here ran in jsdom only. A real desk in a browser is probed by `browser/` and `bench/`, not by this spike.
- The shallow-reactivity trap is shown, not solved, in this spike.

## See also

- Root [`README.md`](../README.md) (the iteration table) and [`index.html`](../index.html) ("How legacy callers keep working": the `shallowReactive` instance and `flush()`).
- [`LEARNINGS.md`](../LEARNINGS.md): v8 went back to one `createApp` tree, with each view a real child of the app.
- [`compat/CONTRACT.md`](../compat/CONTRACT.md) and [`compat/sweep-page.md`](../compat/sweep-page.md): the Page API this spike's `frappe.ui.Page` imitates.
- Next: [v2](../v2/). Later: [v5](../v5/) (chosen), [v8](../v8/README.md).
