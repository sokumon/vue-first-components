# B: es-* tags for Desk's Link and Select

`ControlLink` and `ControlSelect` stay the legacy jQuery classes. Only `make_input` changes: it creates frappe-ui's `Combobox` / `Select` as `<es-combobox>` / `<es-select>` with jQuery, rendered by the one es-* Vue app of `wc/jq` (one `createApp`, a Teleport per host). frappe-ui's `.vue` files are unchanged (npm frappe-ui 1.2.0 in `wc/node_modules`, the same copy `~/fb/fui-lib` uses).

## Files

| path | what |
|---|---|
| `build/src/runtime.js` | `wc/jq/src/runtime.js` + fixes (`runtime.patch` is the diff) |
| `build/src/entry.js` | registers only `es-combobox` and `es-select` and provides frappe-ui's portal target |
| `build/vite.config.mjs`, `css.mjs`, `tailwind.config.js` | Vite builds the ESM (`vue` external, so Frappe's esbuild plus the one-vue plugin map it to `frappe.Vue`). Tailwind content is the built JS, and every rule is scoped under `:where(es-combobox, es-select, es-app, es-portal)` |
| `desk/es_link.bundle.js` | The Desk glue: it patches the prototypes after `controls.bundle.js` |
| `desk/glue.css` | The layout around the inputs, the hidden `<select>`, and z-index |
| `build.sh` / `apply.sh` / `revert.sh` | Build (no bench); put the files on the bench, patch `hooks.py` and build the two bundles; take B off (then run `../bench-legacy.sh`) |
| `session.sh <cmd>` | Under the bench lock: re-applies B if another agent's session took it off, then runs `cmd` (A's `session.sh` takes B off and puts it back) |
| `inner-*.sh` | Harness, perf, specs and suite runners without their own flock, for use inside `session.sh` |
| `check/b-ui.cjs` | B-only UI checks that the shared harness cannot see (it drives Select through the hidden `<select>`) |
| `check/perf-extra.cjs`, `heap.cjs`, `leak.cjs` | Render-inclusive timings, and heap and DOM per control, es against legacy controls in the same build (`window.__es_link_off`) |
| `hooks.applied.diff` | The `hooks.py` change: `es_link.bundle.js` after `controls.bundle.js`, and `es_link.bundle.css` |
| `results/` | All outputs (final run label: `B5`) |

## Runtime fixes used (generic, none per component)

From the sweeps:

- **sweep-shell `runtime.patch` fixes 1–6:**
  - slot nodes are no longer listed twice;
  - Fragment-root `.html()` / `.empty()` no longer crash: removed nodes are parked so the unmount can walk them;
  - `.clone()` is recognised through `es-mounted`;
  - TypeScript-typed props parse JSON;
  - the toast fix (not used here);
  - IntersectionObserver and ResizeObserver are redirected to a box for `display:contents` hosts.
- **sweep-shell fix 5 (vite):** runtime prop types are kept (`isProduction: false` for `compileScript`).

New in B, also generic:

- **Native events not blocked.** A host with `es-native-events` lets native events that share an emit name pass. `focus` and `blur` are never stopped.
- **Attributes on host only.** `on*` handler attributes and names that `setAttribute` rejects (`@click`) are not forwarded.
- **`ES.mount(el)`** renders a host that is not in the document yet, because Desk builds controls in detached parents. `$.cleanData` releases such a host when it is removed without ever connecting.
- **Bootstrap modal focus** (in the glue). `_enforceFocus` ignores focus inside `<es-portal>`, which is the review's "es-portal-aware enforceFocus".

## How Link works

- **`$input` / `input`** are the Combobox's own `<input>`, which Vue creates once. `value` writes on that input (from jQuery `.val()` or Desk) are routed into the component's `query` prop, so a later Vue patch cannot undo them.
- **The component's own state changes are vetoed** (`preventDefault` on `update:*`) unless they match the legacy model:
  - `query` changes only when the user types;
  - `modelValue` stays `null`;
  - `open` follows Awesomplete's rules: no list without rows, and arrow keys on a closed list belong to the page.
- **`awesomplete` is a shim** with `list`, `isOpened`, `open`, `close`, `evaluate`, `get_item`, `select` and a detached `ul`. It fires `awesomplete-open` / `-select` / `-close` / `-selectcomplete` in Awesomplete's order, so link.js's own handlers (copied unchanged) do the picking:
  - the Enter/Tab text-match veto;
  - action rows;
  - `remember_last_selected_value`;
  - validation and fetch.
- **Keyboard and focus behave like Awesomplete:**
  - Tab picks the active row;
  - Escape closes the list (and `dialog.js` keeps the dialog open);
  - the list closes on blur;
  - the first row is active.
- **The list renders next to the input** (`portalTo` = the input's parent), as Awesomplete's `<ul>` did. Frappe's specs look for it at `input/..`.
- **Rows from `ControlLink.link_options`** keep their HTML, through Combobox's per-option slot and the runtime's `<template>` stamping.
- **`ControlTableMultiSelect`** (and any subclass with `custom_awesomplete_filter`) and `ControlLinkCombobox` keep the legacy input.

## How Select works

- **The legacy `<select>` stays `$input`.** It is visually hidden. Apps call `.find("option")`, `.empty().add_options()` and `select[data-fieldname]` on it.
- **`<es-select>` is the visible UI.** It mirrors the `<select>` through a MutationObserver, `change`/`select-change` and `set_formatted_input`, and writes picks back with `$input.val(v).trigger("change")`.
- **Focus.** Focus is redirected to the trigger, and the trigger's focus and blur are relayed to `$input`.
- **Desk's `.placeholder` overlay** is kept.

## Not covered

- **Web forms** load `frappe-web` bundles, not `app_include_js`, so they keep the legacy controls. The `v5.web_form` flow therefore compares legacy with legacy.
