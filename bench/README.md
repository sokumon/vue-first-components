# Real-desk test bench for v5

What runs the v5 design on a real Frappe desk in Chromium. The bench itself (Frappe, MariaDB, Redis) is not in this repo.

| Path | Goes to | What it is |
| --- | --- | --- |
| `desk/vue_first.bundle.js` | `apps/frappe/frappe/public/js/` | Entry: defines the probe classes, creates `frappe.ui.app` with the desk renderer, provides the desk router to frappe-ui |
| `desk/*.vue`, `desk/store.js` | `apps/frappe/frappe/public/js/vue_first/` | Probe classes. Copy `v5/define.js`, `renderer.js`, `vue_internals.js`, `desk_router.js`, `App.vue` there too |
| `fui-lib/` | anywhere, `yarn && npx vite build` | Prebuilds frappe-ui's `Button` and `Dropdown` (desk's esbuild Vue plugin can't compile them) and re-exports vue-router's injection keys. Copy `dist/fui-lib.js` into `vue_first/` |
| `pw/` | anywhere with Playwright 1.56 | `probe.cjs` (41 checks), `probe_fixes.cjs` (24 checks for issue #1), `probe_review*.cjs` (57 checks, one per defect the reviews found), `perf.cjs` (create/update/destroy cost and a CPU profile) |
| `buildtime.sh` | | Times desk esbuild with and without the v5 bundle, the v5 bundle alone, and `bench build` warm and cold |
| `frappe-branch.diff` | `apps/frappe` | Loads `vue_first.bundle.js` before `controls.bundle.js`, and stops `control.js` loading the legacy `base_control`, `base_input` and `data`. Copy `v5/controls/*.vue` to `vue_first/controls/` |
| `pw/probe_forms.cjs`, `pw/perf_forms.cjs` | | Real forms, dialogs and fields on the v5 controls; form-open and control-creation timings |
| `frappe-ui-tests.sh` | | Runs frappe's own Playwright specs for controls, forms, grids and dialogs (needs `allow_tests`, `admin_password`, `DEV_SERVER=1 bench serve`, and the test user from `frappe.tests.ui_test_helpers.create_test_user`). Results: `frappe-ui-tests-legacy.txt`, `frappe-ui-tests-v5.txt` |

Apply `frappe-branch.diff`, then build with
`node esbuild --production --apps frappe --files frappe/vue_first.bundle.js,frappe/controls.bundle.js` from `apps/frappe`.
`session.cjs` expects the site at `http://v5.localhost:8000` with `Administrator` / `admin`.
