# Combobox mount/update speed: implementation results

The deliverable is `frappe-ui-combobox-perf.patch`. It is also left uncommitted in the working tree of the `frappe-ui/` clone, on local branch `combobox-perf`, which branches from HEAD 451ae0a.

Files changed:
- `src/components/Combobox/Combobox.vue`
- `src/components/shared/slotOutlet.ts` (new)

The public API is unchanged: props, emits, slots, slot props, v-model, the exposed `clear`/`focus`, classes and data-* hooks all stay as they were.

## Before / after (final run, same session)

`head2` is unpatched HEAD; `final` is the patch.
- Timings are in-page `js` time in ms (state change through Vue's nextTick flush), median [min–max] of 7 runs, prod build, from the baseline bench (`bench/`).
- Full table: `impl/raw/final-table.md`. Raw JSON: `impl/raw/`.

| scenario (js ms) | HEAD | patched | change |
|---|---:|---:|---:|
| mount 100 Desk-like, cold | 255 [240–288] | 221 [208–243] | −13% |
| mount 100, warm | 159 [150–182] | 114 [102–122] | −28% |
| mount 300, cold | 595 [572–611] | 493 [448–521] | −17% |
| mount 300, warm | 426 [379–466] | 366 [353–391] | −14% |
| mount 100 with 20 options, cold | 267 [245–283] | 223 [193–234] | −16% |
| mount 25, cold | 109 [83–113] | 92.8 [78–98] | −15% |
| update `query` on 100 closed controls | 70.7 [59–77] | 35.4 [33–40] | −50% |
| update `options` (20 each) on 100 closed | 53.4 [48–67] | 12.5 [7.0–16.7] | −77% |
| update `placeholder` on 100 closed | 62.9 [51–74] | 40.0 [31–45] | −36% |
| 200 options arrive on 100 closed controls (`impl/opts-closed.cjs`) | 73.9 [67–87] | 15.2 [13–20] | −79% |
| first open (20 options) | 49.8 [38–53] | 44.7 [39–65] | noise |
| first close | 5.2 [4.6–12.5] | 8.2 [5.7–9.8] | +3 ms |
| open filterable, 500 options | 315 [290–323] | 337 [321–379] | +7% (popover now mounts at open) |
| typing per key, 20 / 500 options | 12.4 / 197 | 11.0 / 208 | noise / ≈+5% |

Per closed control:

| | HEAD | patched |
|---|---:|---:|
| component instances (Combobox subtree) | 20 | 16 |
| ReactiveEffects / watchers | 41 / 20 | 34 / 17 |
| JS heap after GC | 118 KB | 98.8 KB (−16%) |
| Blink DOM nodes | 40 | 29 |
| re-renders per control on mount | 10 | 8 |
| re-renders on a `query` / `placeholder` update | 21 | 8 |
| re-renders on an `options` update | 18 | 2 (BenchCell + Combobox only) |

## What changed (applied one at a time, in this order; each kept only if it measured better and the behaviour diff was empty)

1. **F2: no `<slot>` outlets inside reka slot content.** Every `<slot>` became `SlotOutlet` (`shared/slotOutlet.ts`), a functional component that calls the slot from the `useReactiveSlots` proxy.
   - It falls back when the output holds only comments, the same rule as Vue's `ensureValidVNode`.
   - It returns a lone vnode bare, so the as-child click and aria attributes still land on a custom `#trigger`.
   - When there is no `#suffix`, the default chevron renders directly, so a plain control creates no outlet.
   - Why it matters: Combobox's slot content now compiles as STABLE, so reka components are no longer force-updated on every Combobox render. Before this, any h()/es-* or slot-less consumer forced them through DYNAMIC_SLOTS.
   - Result: update cost −40–60%; mount unchanged. Kept.
2. **F1 + F3: mount the popover on first open, through Vue's own `<Teleport>`.** `v-if="hasOpened || (open && mountState.mounted)"` replaces ComboboxPortal / TeleportPrimitive.
   - The target precedence is unchanged: `portalTo`, then `providePortalTarget`, then reka ConfigProvider `teleportTo`, then `body`.
   - A control mounted already open teleports after mount, as reka's `useMounted` does, so nothing is teleported during SSR.
   - Result: mount −14% cold and −36% warm (100 controls), heap −17%, 4 fewer instances. Kept.
   - **F1 alone with ComboboxPortal was rejected.** The behaviour diff caught `aria-controls=""` on the input and chevron during the first open. reka 2.11 stores `contentId` non-reactively, and TeleportPrimitive's `useMounted` mounts the content one tick late. Moving the portal earlier in the template did not help: the keyed child diff in Primitive patches the anchor before the new teleport. Native Teleport fixed the input.
   - The chevron (ComboboxTrigger) still rendered before the content registered its id, so it gets one `$forceUpdate()` in a `nextTick` after the first open. After that, the closed and open DOM/ARIA snapshots match HEAD exactly. The id appears one microtask later than before, still before paint.
3. **F7: the `filteredGroups` watcher reads the filter only while open and typing.** The callback fires in the same cases as before. A closed control no longer runs the filter on every `options` or `query` change. The standard suite showed no difference, but 200-option lists on 100 closed controls went from 39.7 to 26.2 ms. Kept.
4. **Slot-presence memo (a local, Combobox-only version of F6).** Template `v-if`s read a `filled` computed. It returns the same object until a slot is added or removed, instead of reading the slots proxy, whose tick bumps on every render. Rendering a slot still reads `slots.<name>`, so slot reactivity is unchanged (slotReactivity.cy.ts 14/14). Result: re-renders on an options update 6 → 3 per control, 27 → 17 ms. Kept.
5. **F8, part kept: a computed `wrapperClass`.** LabelingWrapper's props now keep their identity. On its own (step 4 not yet in) it did nothing, because LabelingWrapper still re-rendered from the slot tick. After step 4 it took options updates from 17.4 to 8.6 ms and re-renders 3 → 2. Kept.

## What did not help, or was not done

- **F8's `inputBindings`** (merging `inputAttrs` and `inputAriaAttrs` into one computed): no measurable change, and it adds 2 computeds. Reverted.
- **F6 in the shared `useSlotTick`** (bump only when slot function identity changes): not applied. For h()/es-* consumers such as Desk, Vue re-wraps every non-compiled slot on each parent update, so identities always change and Desk would gain nothing. It also touches 58 call sites. Step 4 gets the closed-control benefit locally.
- **F5** (anchor in a slot-less child, to work around R1): not done. It is a large refactor, and the clean fix is in reka.
- **F9, F10:** not done (low value or a styling risk, as the design said).
- Remaining per-update cost: `query` still re-renders the anchor's Primitive chain, ComboboxInput and ListboxFilter (8 per control), because the input's `:value` lives in slot content that the anchor Primitive renders. Fixing that needs reka R4.

## Checks

- **Behaviour diff** (`behaviour/`): `./run.sh <tag> <frappe-ui src root>`, then `node check.cjs --diff out/head-dev.json out/<tag>-dev.json`.
  - 86 steps over 13 scenarios, each a normalized DOM snapshot plus a Playwright ARIA snapshot of the control and every open popover, with its teleport location, the focused element and emitted events. Generated ids are renamed by DOM order.
  - Covered:
    - keyboard: open, arrows, Home/End, Enter, Escape, Tab
    - typing filter, custom row, clear by backspace
    - controlled `open`, `query` and v-model through h() (Desk-like, `portalTo`, item-html slot, emptyText)
    - every slot, including a slot added and removed at runtime
    - error/required/label/description aria
    - button mode with search slots, custom `#trigger`, exposed `focus`/`clear`
    - disabled input and button, readonly/attrs passthrough
    - mounted open, ConfigProvider `teleportTo`, `providePortalTarget`, loading
  - Result: dev and prod builds both show **0 differing steps**, with no Vue warnings or errors. HEAD against itself is also 0 (deterministic).
- **frappe-ui tests**, with the patch applied to `test-clone` (reverted afterwards). test-clone uses reka-ui 2.9.9, the lowest version the package allows.
  - Cypress: Combobox.cy.ts 82/82, slotReactivity.cy.ts 14/14, FormControl.cy.ts 31/31 (`impl/cypress-final.log`).
  - Vitest selection/Combobox: 11/11.
- **vue-tsc** (`-p tsconfig.app.json`): 0 errors, the same as HEAD. The first pass had 9 errors (slotProps type, and `teleportTo` not typed in reka 2.9.9); these are fixed.

## reka-level proposals worth taking upstream

| id | change | measured (by the design pass, scratch reka 2.11 dist) |
|---|---|---|
| R1 | ListboxRoot (and ~16 other components): `v-if="name && isFormControl"` instead of `isFormControl && name`. useFormControl is `true` before mount and `false` after it, so every nameless control re-renders, and Primitive's h() patch forces the whole anchor chain. These are the 8 re-renders per control still left on mount here. | 100 cold 213 → 177 ms, 300 warm 387 → 261 ms on top of F1+F2 (≈ −32% / −41% against HEAD) |
| R1b | Make `rootContext.contentId` reactive (reka HEAD's useRenderedContentId). It would remove the chevron `$forceUpdate` workaround in this patch. | correctness / simplification |
| R2 | ComboboxAnchor renders PopperAnchor directly instead of `PopperAnchor(as-child) > Primitive(asChild)` | −2 instances per control; 100 warm 150 → 109 ms |
| R4 | Primitive renders children through `renderSlot()` so that stable parent slots keep block optimization. This is what still makes a `query` update re-render the anchor chain. | unproven alone (within noise); pays off with stable slots (which this patch now provides) |
| R3 | useForwardExpose: one lazy Proxy instead of a defineProperty per prop | 100 warm 109 → 89 ms on top of R1+R2 |
| R5 | Lighter closed setup in ComboboxRoot/ListboxRoot/ComboboxInput (fewer toRefs, no mount highlight when empty) | estimated 5–10% of mount, not measured |
| — | Teleport: skip `useMounted` unless hydrating | moot for frappe-ui after this patch |

Open-list cost (500 options: ~330 ms to open, ~200 ms per key) is unchanged and needs virtualization. That is a separate design decision.

## Layout

- `frappe-ui-combobox-perf.patch`: the diff.
- `behaviour/`: harness (`src/App.vue`), driver (`check.cjs`), `run.sh`, `probe.cjs` (instance create/update order), snapshots in `out/`.
- `impl/`:
  - `measure.sh` (bench builds plus timing/memory/counts/rerenders), `compare.cjs` (tables), `opts-closed.cjs` (large options on closed controls).
  - Per-step source snapshots: `head/`, `f2/`, `f13/`, `f7/`, `f8/` (rejected), `f9/`, `f10/`, `final/`. `steps/f1f3-alone.patch` is F1+F3 tried before F2 (it still had the first-open aria-controls diff).
  - `raw/`: all results. Logs: Cypress, vue-tsc.
