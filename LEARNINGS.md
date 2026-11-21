# Learnings

What the spikes from v5 to v8 taught us, measured on a real desk (frappe develop, plus ERPNext develop as the test corpus). The goal they serve: **port `frappe.ui` to Vue and Frappe UI step by step, while the Page API and the Form API keep working for every app, unchanged.** The details and numbers are in `README.md`, `v8/README.md`, `v8/SPEC.md`, `compat/CONTRACT.md` and `bench/v8/README.md`.

## What works

- **The class stays the public API; a `.vue` file draws it.** `new frappe.ui.X(opts)` still builds a class instance with its prototype methods and jQuery fields. Legacy subclasses (`extends frappe.ui.form.ControlData`) and prototype patches keep working.
- **One `createApp` tree (v8).** `new` mounts the class's view synchronously as a real child of the app. It goes through the renderer's own `patch()` with a real `parentComponent`, reached from KeepAlive's `ctx.renderer`. The DOM is there on the next line, so `new X(); x.$wrapper.find(...)` still works. Provide/inject, app plugins and devtools see one tree.
- **Template-first.** All markup is in the `<template>`. `make_*()` only switches a part on (`draw_* = true`), `set_*()` only sets state, and the template draws it. `v-part:name` hands the drawn element back as the legacy jQuery field.
- **A fallback for each unported subclass.** If a subclass replaced a `make_*()` and builds its own jQuery (check, switch, link), the base class sees that its part is not drawn and builds the input the legacy way.
- **The ports pass frappe's own suite with no new failures.**
  - Base control, input and data on v5 and on v8: 135 passed, the same 14 environmental failures as legacy.
  - `frappe.ui.Page` on v8: a page-heavy set of 48 specs fails exactly as legacy does (one routing test failed once and then passed 3 of 3 reruns).
  - 1,100 random call sequences give the same DOM as `page.js`.
- **Speed is close to legacy at real sizes.**
  - Opening forms costs about the same as legacy.
  - Repeated no-op calls are faster than legacy, because Vue writes no DOM for them.
  - Creating a page costs about 2× `page.js` (1.7 ms vs 0.9 ms).

## What it costs, and what broke

- **jQuery and Vue both writing into the same element is the root of almost every bug.**
  - Vue keeps placeholder nodes (empty text anchors, `<!--v-if-->` comments) in every element it patches children into.
  - Callers do `$btn.text("Executing...")`, `page.menu.empty()` or `el.innerHTML = ...`. The next patch then meets a removed anchor and the component's render is broken for good. System Console hit this.
  - The Page port compensates for it: it puts anchors back (patching `textContent`/`innerHTML`/`.empty()`/`.html()`/`.text()`) and syncs state through `$.cleanData`. It re-applies attributes that callers change, keeps append order, and releases elements a caller moved. That made `Page.vue` 2,249 lines against 1,395 for `page.js` + `page.html`.
- **The rule that avoids it (`compat/CONTRACT.md`):** every element the API hands out is a real element that Vue creates once and never replaces, re-classes or re-styles. *Inside a handed-out element, jQuery owns the DOM.* Collections that callers also write into (menus, toolbars, button groups) should be one small Vue component per item, mounted into its own element that the method adds with jQuery. They should not be a `v-for` that Vue keeps re-patching. The Page port broke this rule, and the next step is to bring it back into line.
- **Vue writes props it thinks changed, not what the DOM has.** jQuery's `.val()` and `.addClass()` change the DOM behind Vue's back. Bind `value` only where Vue owns it, and patch only the classes that changed (`v8/renderer.js`).
- **A directive on a component vnode makes Vue re-render that child on every parent render.** `v-part` on `<EsButton>` made a form refresh 5× slower. Pass the part name as a prop instead, and give the changing regions their own components so one call re-renders one region.
- **Each page call must render synchronously, because it returns an element.** The cost of a call is one small render, so keep the region a call changes small.
- **jQuery removal must destroy.** A `$.cleanData` hook unmounts the view when jQuery removes its element. Without it, views leak and their watchers keep running.
- **Vue internals used are named in one place** (`v8/define.js`, `v8/SPEC.md` §13): `ctx.renderer` (`p`/`um`), `instance.job`, the effect scheduler and flags. Each is pinned to Vue 3.5.x, and a check fails loudly if it moves.

## How to test that nothing broke

- **Differential testing, not unit tests.** Run the same flow on legacy and on the port, then compare model values, the visible DOM, console errors and timings. Any difference is a break. `frappe.ui.LegacyPage` stays reachable so the two can run side by side in one build.
- **Independent breakers find what the author misses.** The serious bugs (Check fields drawn without a checkbox, the System Console crash, the Form Builder's Proxy invariant) were each found by a separate agent trying to break the port, not by the port's own probes.
- **The baseline must be run on the same bench.** These failures come from the environment, not the port: the dashboard specs, and "Queue Overloaded" because the bench has no RQ workers (drain with `bench worker --burst` before suite runs).
- **Apps are the real contract.** `compat/sweep-*.md` lists every way frappe and ERPNext reach into Page, Form, controls, grid and DOM. The checklists in `compat/CONTRACT.md` (24 for Page, 29 for Form) are what each port has to pass.

## Next

1. Bring the Page port back to the contract rule (one component per item inside handed-out containers), and delete each compensation whose removal breaks no test.
2. Run the differential tests on ERPNext flows (Sales Invoice, Stock Entry, the reports), comparing legacy and v8.
3. Use Frappe UI components inside the templates. Known blockers: one shared Vue across bundles, and the desk build compiling frappe-ui.
