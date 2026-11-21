# bench/v8: the v8 design on the real desk

- `desk/vue_first8.bundle.js`: the entry. It is loaded before `controls.bundle.js` and imports the runtime and controls from `frappe/public/js/vue_first8/`, which are copies of the repo's `v8/` plus v5's probe .vue files and `fui-lib.js`. `desk/VueProbe.vue` is the v8 variant: `buttons` is declared in `data()`.
- `mode.sh legacy|v5|v8`: switches `hooks.py` and `control.js` and rebuilds. In v8 mode it loads `vue_first8.bundle.js` instead of `vue_first.bundle.js`. `frappe-branch-v8.diff` is the v8-mode diff.
- `pw/*_v8.cjs`: copies of the probes. Behaviour checks are kept and internals access is adapted (`$fui.destroyed`, `$fui.view`, `frappe.ui.vue_verified`). Checks whose v5 guarantee v8 deliberately drops (spec §5/O5, O14, v5's `renders()`) wait a tick, or declare the field reactive, and say so inline.
- `perf_all.sh <mode>`: runs perf_forms and the row timings 3 times each. `results/` holds the raw output plus frappe's suite run in v8 mode.
- `pw/probe_fixes8_v8.cjs`: regression checks for the defects the two v8 break reports found (F1 to F9). F1 is a real Form Builder save: in Customize Form for Note, type into a Code property and into Description, click Update, and expect the Property Setter. Each check fails on the first v8 build and passes on the fixed one. The jsdom spike's group J covers the same defects.
- `results/frappe-ui-tests-v8-final.txt` is frappe's suite run after the fixes, and `results/perf_*_final.txt` holds the perf runs made after the fixes, in all three modes.

## frappe.ui.Page port (mode `v8page`)

- `mode.sh v8page`: the same setup as v8, with `vue_first8/page_port.js` = `desk/page_port.on.js`. The bundle entry then defines `frappe.ui.Page` from `vue_first8/ui/Page.vue`, which is a copy of the repo's `v8/ui/`. `mode.sh v8` copies `page_port.off.js`, which keeps page.js's Page.
- `page_specs.txt`: the page-heavy spec set from frappe's suite (48 files). Run it with `~/fb/pwt/run_specs.sh <label> $(cat ~/fb/pwt/page_specs.txt)`.
- `pw/probe_page_v8.cjs`: the Page probe. Run it in mode v8page. `TIMING_ONLY=1` in mode legacy times page.js on its own.
- `results/`:
  - `page_base_v8.txt`: the page specs with page.js's Page in mode v8.
  - `page_base_legacy.txt`: the same specs in mode legacy.
  - `page_v8.txt`: the same specs in mode v8page.
  - `page_v8_controls.txt`: the control/form/grid/dialog set in v8page.
  - `probe_page_v8.txt`, `probe_page_legacy_mode.txt`: the Page probe runs.
  - `*_v8page.txt`: the v8 probes in v8page.
  - `perf_forms_v8page.txt`: the forms perf run.

### After the Page break reports

- `pw/probe_page_v8.cjs` gains P12: one check per break-report defect (R1 to R8), each comparing with page.js where the defect was a DOM difference. Every P12 check fails on the first Page build.
- `results/`:
  - `page_final.txt`, `page_final_controls.txt`: frappe's page spec set and control/form/grid/dialog set on the fixed build.
  - `probe_page_v8_final.txt` and `probe_*_v8page_final.txt`: the Page probe and the v8 probes on the fixed build.
  - `spike8_final.txt`: the jsdom spike, dev and prod Vue.
  - `page_timing_v8page_final.txt`: three runs of the probe's P11 timing; `page_build_perf_final.txt`: the breakers' toolbar/menu build timings (perf2.js, perf.js) and the menu timings.
  - `perf_forms_v8page_final.txt`, `perf_forms_v8mode_pagejs_final.txt`: open User / System Settings with the v8 Page and with page.js's Page (mode v8).
  - `shell_routing_v8page_*.txt`: three runs of `shell_routing.spec.js` alone on the final build.
