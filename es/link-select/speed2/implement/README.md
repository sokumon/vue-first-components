# speed2 / implement: what was applied to variant B, and what it bought

Base = B-es-tags as it was before this phase (copied to `base/`: glue, runtime, entry, css.mjs,
tailwind.config.js, vite.config.mjs, dist). Final = B-es-tags now. The patches against base are:

- `css-speed2.patch`: build/css.mjs and build/tailwind.config.js (C1, C2, C3a)
- `runtime-speed2.patch`: build/src/runtime.js (C3b, R4)
- `glue-speed2.patch`: desk/es_link.bundle.js (G1, G2 with G6, viewport-aware lazy check)

frappe-ui, reka-ui, entry.js, vite.config.mjs and glue.css are unchanged.

## Kept

| id | change | where | measured effect |
|---|---|---|---|
| C1 | drop the preset's `prose`/`prose-v3` safelist (`safelist: []`; `CSS_PROSE=1` restores it) | tailwind.config.js | part of the CSS row below |
| C2 | scope each rule as one complex selector per scope tag, `:where(es-combobox) X, :where(es-select) X, :where(es-app) X, :where(es-portal) X`, instead of one nested `:where(a,b,c,d){& X}` parent. Specificity stays 0. `CSS_SCOPE=nest\|tag\|scope` builds the alternatives | css.mjs | see the CSS table |
| C3 | drop preflight's `::backdrop` rule. Host rules (`display:contents`, `:not(:defined)`) are plain tag lists in the sheet head and in ensureApp's `<style data-es-ui-base>` | css.mjs, runtime.js | included in the CSS table |
| G1 | idle Select options: until the user first hovers, presses or focuses a Select, the component gets only the selected option. The frappe-ui trigger shows its own `selectedOption`, so the trigger looks the same. The full list goes in synchronously on pointerenter, capture pointerdown, focusin and update:open, and stays in from then on. `host.options` still returns the full list. `window.__es_select_full` turns it off | glue | make 100 Select with 10 options: 1169 -> 158 ms painted (legacy 151). set_input on 100 Selects with 10 options: 674 -> 48 (legacy 33). Heap per mounted Select: 185 -> 85 KB |
| G2 | lazy Select: until it mounts, the control is Desk's legacy `<select>`, so `$input` and `input` are the real element and only `_es_host` is trapped. It mounts like a Link does: in the pre-paint rAF if it is near the viewport, through the IntersectionObserver, on focus or pointerdown, or when code reads `_es_host`. `window.__es_select_lazy_off` turns it off | glue | dialog 40 Link + 10 Select: 75 -> 56 ms (vs G2 off). make 100 Select: 365 -> 130 (vs G2 off) |
| G6 | `Modal.prototype._showElement` re-runs the lazy check, so fields that are visible in a dialog mount before the dialog's first frame | glue | no flash of stand-ins in dialogs. Time is within noise |
| L1 | (mine) the lazy check means within 300 px of the viewport (`getBoundingClientRect`), not just laid out (`getClientRects().length`). The IntersectionObserver gets `rootMargin: 300px 0px`. `window.__es_lazy_laidout` restores the old rule | glue | forms: no change (every laid-out field was already in view). Controls built below the fold no longer mount: make 100 Link 343 -> 87 ms painted |
| R4 | `ownerOf` uses native `closest()` plus `getRootNode()` instead of a JS walk to the root (same answers) | runtime.js | small (about 1.5 ms on Sales Order per the profile). Not separately measurable |

## Tried and reverted

| id | why reverted |
|---|---|
| R1: non-reactive `e.props`/`e.attrs`, async flush of one host per Vue tick | No gain once G1 was in (set_input 100 Select: 226 vs 217 ms). It also broke b-ui "Tab picks the active row": awesomplete-selectcomplete was lost and the value was not set |
| R2/G4: idle prewarm (ES.prewarm, mounting 3 Combobox and 3 Select hosts in idle time) | It ran (47 ms in idle time at load) but first open did not improve (es vs es+nowarm: Sales Order 416 vs 422, Delivery Note 418 vs 409, Stock Entry 325 vs 307, ToDo 253 vs 236). The first mounts in a form stayed at 6-12 ms |
| G1 first version (collapse back to one option when idle again) | Collapsing while reka's list animated out broke its patch (`Cannot read properties of null (reading 'nextSibling')`, b-ui "no console errors"). It now never collapses after the first expansion |

Not attempted: R3 (Teleport vnode memo), R5 (skip MutationObserver records from Vue's own patch), G3 (two-phase batched mounts), G5 (shared MutationObserver for Selects), G7, G8, G9, G10, R6. After the changes above, the runtime's share is about 2-5 ms per form. R3, R5 and G3 each target about 1-5 ms, below the noise of a first open (±30-50 ms).

## Before / after

Same bench and same build mode. "legacy" is the legacy controls in the same build (`window.__es_link_off`).
Before this phase, the same-build legacy also paid the es CSS cost. Now it does not, so it matches the
earlier "legacy-nocss" measurement and is the real legacy baseline. Medians of 3 alternating rounds,
in ms, ready/painted.

### Forms (forms.cjs, out/forms-S2-base-erp.json + out/forms-S2-final.json)

| scenario | legacy, base build | legacy, final build | B before | B after |
|---|---:|---:|---:|---:|
| Sales Order first open | 422/611 | 356/524 | 524/711 | 412/582 |
| Sales Order re-open | 215/288 | 142/168 | 222/282 | 158/195 |
| Delivery Note first open | 405/520 | 347/447 | 468/601 | 390/490 |
| Delivery Note re-open | 201/264 | 142/169 | 222/286 | 159/183 |
| Stock Entry first open | 309/319 | 258/266 | 361/393 | 296/306 |
| Stock Entry re-open | 158/207 | 119/154 | 163/224 | 124/161 |
| ToDo first open | 238/250 | 183/190 | 282/301 | 245/261 |
| ToDo re-open | 91/102 | 65/74 | 96/104 | 69/74 |

### CSS alone (cssv.cjs, legacy controls, the sheet swapped in the page; out-cssv1.log)

| Sales Order | sheet off | base sheet | nested, C1+C3 | **:where(tag) per scope (final)** | plain tag | @scope |
|---|---:|---:|---:|---:|---:|---:|
| first ready | 376 | 427 | 406 | **384** | 366 | 405 |
| re-open ready | 165 | 232 | 194 | **159** | 150 | 170 |

Delivery Note re-open: off 146, base 235, final 159. Stock Entry: 120, 164, 130. ToDo: 68, 94, 66.
Chrome's ancestor Bloom filter does take a hash from a single-argument `:where(tag)`. `:where(tag)` is as fast as a plain tag,
so specificity stays 0.

### Synthetic (micro.cjs on v5, out/micro-S2-base.json + out/micro-S2-final.json; painted / sync JS)

| scenario | legacy (final build) | B before | B after |
|---|---:|---:|---:|
| make 100 Link (built below the fold) | 109 / 52 | 373 / 31 | 84 / 29 |
| make 100 Select, 3 opts (below the fold) | 122 / 50 | 531 / 203 | 130 / 55 |
| set_input 100 Select, 3 opts | 36 / 5 | 238 / 7 | 46 / 5 |
| make 100 Select, 10 opts | 151 / 64 | 1169 / 225 | 158 / 67 |
| set_input 100 Select, 10 opts | 33 / 5 | 674 / 9 | 48 / 6 |
| dialog 40 Link + 10 Select | 63 / 55 | 124 / 48 | 55 / 44 |
| 12 Link on screen (all mount) | 33 / 13 | 60 / 4 | 67 / 5 |
| 12 Select with 10 opts on screen (all mount) | 34 / 9 | 132 / 25 | 70 / 10 |
| heap / DOM nodes / listeners per Link (200 built, lazy) | 6.4 KB / 71 / 17 | 114 KB / 112 / 30 | 5.6 KB / 35 / 2.5 |
| heap / DOM / listeners per Select (200 built, lazy) | 1.8 KB / 67 / 3 | 185 KB / 196 / 40 | 4.6 KB / 68 / 5.3 |
| heap / DOM / listeners per Link, all mounted | 2 KB / 71 / 17 | 117 KB / 112 / 30 | 115 KB / 112 / 30 |
| heap / DOM / listeners per Select, all mounted | 2 KB / 67 / 3 | 185 KB / 196 / 40 | 85 KB / 132 / 20 |

judge/perf2.cjs (results/judge/perf2-S2-base.json, perf2-S2-final.json; reference perf2-legacy.json):

| | legacy ref | B before | B after |
|---|---:|---:|---:|
| open new ToDo, painted | 82 | 112 | 75 |
| open new Workflow, painted | 92 | 96 | 73 |
| make 100 Link, painted | 88 | 389 | 99 |
| make 100 Select, painted | 113 | 561 | 140 |
| set_input 100 Select, painted | 33 | 239 | 43 |
| dialog 40 Link + 10 Select, painted | 84 | 131 | 62 |
| heap per Link / Select, attached (KB) | 6 / -1.5 | 126 / 185 | 5.6 / 1.5 |
| heap kept after remove 200 Link / Select (KB) | 506 / -481 | 19866 / 31714 | 875 / -66 |

perf2's make, set_input and heap scenarios build their controls below the fold. With L1 and G2, those controls stay
stand-ins, which is the real cost of an offscreen control. The "on screen" and "all mounted" rows
above give the cost of a mounted control. perf2's erp rows (Sales Invoice, broken on this bench) are left out. The base
run's erp rows were also served a stale bundle (see Notes).

## Gates (final)

- b-ui.cjs: 10/10
- inner-specs.sh S2-g1 with 2 repeats: 48 passed, 4 failed. The failures are the 2 Gender tests × 2 repeats (missing site data)
- harness (results/harness-S2-final.json): 0 behaviour, 0 api, 0 structure, 0 errors, 0 requests, 2 events, both in v5.form_todo
  (advanced-search, enter-on-action-row-with-unmatched-text). One frm:allocated_to/select-change pair
  moves across the step boundary. The base B shows the same: v5.form_todo × 3 on base gave advanced-search 3/3 and
  enter-on-action-row 1/3, and × 3 on final gave 2/3 and 0/3 (todo-rep.sh). harness-B5.json has the advanced-search one too
- Frappe suite (~/fb/pwt/S2-final.txt): 134 passed, 15 failed, 7 did not run. The 15 failures are the same tests that fail in the B5 baseline (diffed)

## Notes

- The erp site (port 8001) sometimes keeps serving the old `assets.json` hashes after `bench clear-cache`, because Frappe's
  in-process client_cache keeps the previous map. Pages then request a deleted es_link bundle, and the es glue
  silently does not load. One base run (out/forms-S2-base-INVALID-erp.json) was hit by this and was re-measured.
  `verify-assets.sh` checks both sites against `sites/assets/assets.json` and retries clear-cache. measure.sh and
  the final gates run it. The Verify phase should run it after every apply.
- The A/B switches stay in the glue, read once per control: `__es_select_full`, `__es_select_lazy_off`,
  `__es_lazy_laidout`, as well as the existing `__es_lazy_off` and `__es_link_off`. forms.cjs and micro.cjs take them as mode
  suffixes (`es+full`, `es+slazyoff`, `es+laidout`, `es+eager`).
- What remains slower than legacy is the mounted component trees: about 2.7 ms per on-screen Link and 3 ms per
  on-screen Select (12 on screen: 67 vs 33 ms, 70 vs 34 ms), 115 KB heap per mounted Link and 85 KB per mounted Select, and
  +8 ms GC per first open. First open is +40 to +60 ms ready against the real legacy, all from mounting about 8-13 visible
  controls (ToDo es_mount: 38 ms inclusive for 9 mounts, 16.5 ms of it Vue core). Re-open is +4 to +18 ms.

## Files

- cssv.cjs, cssvar/*.css: in-page CSS variants. forms.cjs and micro.cjs: copies of speed2/profile with mode flags, the
  10-option and on-screen scenarios, and the all-mounted heap. b-ui-flags.cjs and bui-matrix.sh: b-ui with A/B flags.
  dbg-*.cjs: debugging. gates.sh, measure.sh, with-base.sh (puts base/ on the bench under the lock), verify-assets.sh,
  todo-rep.sh. cmp.cjs, analyze.cjs, sub.cjs and smbuild/: profile analysis (source map of the final es-link.js).
- out/ and out-*.log: raw results.
