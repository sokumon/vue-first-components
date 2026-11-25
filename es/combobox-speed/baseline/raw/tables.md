Runs per cell: npm=7, clone=7. Cells: median [min–max] in ms.
`js` = in-page time from the state change through Vue's scheduler flush (sync + nextTick): the scripting cost. `painted` = until 2 rAFs after (frame-quantized, ~16.7 ms steps). `task` = CDP Performance TaskDuration delta: all main-thread work in the step incl. style/layout/paint.

### Mount (cold = first mount in a fresh page; warm = 4th mount in the same page)

| scenario | npm js | npm painted | npm task | clone js | clone painted | clone task | npm js per control | clone js per control |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mount_1_desk:cold | 43.1 [22.3–46.9] | 53.7 [28.5–57.9] | 56.3 [30.0–60.3] | 41.3 [34.8–43.5] | 49.7 [46.9–53.5] | 51.8 [44.7–56.3] | 43.1 | 41.3 |
| mount_25_desk:cold | 112 [87.1–124] | 124 [101–139] | 126 [103–141] | 112 [92.0–117] | 123 [104–132] | 126 [107–134] | 4.46 | 4.48 |
| mount_100_desk:cold | 263 [259–277] | 288 [280–299] | 297 [294–310] | 264 [252–285] | 287 [273–309] | 297 [284–323] | 2.63 | 2.64 |
| mount_300_desk:cold | 628 [584–640] | 676 [628–692] | 680 [631–694] | 619 [583–659] | 665 [627–703] | 667 [631–707] | 2.09 | 2.06 |
| mount_1_opts20:cold | 42.1 [19.9–43.2] | 50.7 [27.3–53.7] | 53.1 [28.0–56.0] | 41.9 [23.7–51.6] | 48.9 [34.9–60.3] | 50.9 [37.3–62.3] | 42.1 | 41.9 |
| mount_25_opts20:cold | 113 [93.8–123] | 126 [106–136] | 129 [108–140] | 107 [80.7–122] | 120 [92.8–135] | 124 [96.9–138] | 4.54 | 4.28 |
| mount_100_opts20:cold | 254 [243–277] | 278 [262–299] | 294 [274–315] | 251 [234–272] | 273 [254–294] | 287 [266–313] | 2.54 | 2.51 |
| mount_300_opts20:cold | 601 [570–653] | 647 [614–701] | 661 [632–713] | 584 [564–648] | 629 [610–696] | 637 [624–713] | 2.00 | 1.95 |
| ref_100_input:cold | 1.40 [0.70–2.10] | 22.5 [11.9–24.0] | 24.3 [12.8–25.9] | 1.40 [0.70–1.40] | 21.0 [20.9–21.9] | 22.7 [22.5–23.9] | 0.01 | 0.01 |
| ref_300_input:cold | 2.40 [1.40–2.50] | 42.9 [26.0–47.9] | 44.8 [27.3–49.8] | 2.60 [1.50–4.20] | 47.8 [23.1–49.4] | 49.2 [24.2–51.7] | 0.01 | 0.01 |
| ref_100_mini:cold | 31.2 [16.0–36.5] | 45.4 [30.5–49.8] | 43.8 [30.4–52.3] | 17.4 [15.3–41.6] | 35.7 [24.1–56.8] | 38.1 [25.7–59.3] | 0.31 | 0.17 |
| ref_300_mini:cold | 53.2 [46.6–57.5] | 76.5 [66.7–91.0] | 81.5 [71.2–94.9] | 51.5 [30.0–63.1] | 69.7 [50.2–84.2] | 75.1 [53.3–87.5] | 0.18 | 0.17 |
| mount_1_desk:warm | 9.10 [7.30–9.80] | 29.0 [27.0–29.7] | 12.3 [9.94–13.1] | 7.00 [4.30–9.30] | 29.5 [28.4–30.3] | 9.52 [6.59–12.1] | 9.10 | 7.00 |
| mount_25_desk:warm | 37.8 [33.6–52.0] | 42.5 [38.1–63.3] | 43.3 [38.6–57.8] | 43.3 [30.9–51.5] | 47.5 [36.4–63.5] | 48.3 [37.1–57.3] | 1.51 | 1.73 |
| mount_100_desk:warm | 175 [164–188] | 189 [178–202] | 190 [179–203] | 173 [156–191] | 188 [170–207] | 189 [170–208] | 1.75 | 1.73 |
| mount_300_desk:warm | 445 [426–489] | 482 [463–523] | 484 [464–525] | 438 [418–503] | 478 [456–543] | 480 [458–545] | 1.48 | 1.46 |
| mount_1_opts20:warm | 7.70 [4.90–9.40] | 28.7 [28.1–30.8] | 10.9 [7.07–13.0] | 7.30 [4.30–7.50] | 29.6 [29.0–30.9] | 10.0 [6.40–10.3] | 7.70 | 7.30 |
| mount_25_opts20:warm | 39.1 [32.9–52.6] | 61.7 [37.4–63.5] | 45.0 [38.3–61.0] | 35.1 [31.2–53.5] | 39.5 [35.5–63.4] | 40.4 [36.4–59.7] | 1.56 | 1.40 |
| mount_100_opts20:warm | 183 [165–196] | 198 [179–211] | 201 [182–214] | 173 [156–185] | 187 [169–202] | 189 [171–204] | 1.83 | 1.73 |
| mount_300_opts20:warm | 464 [444–528] | 501 [480–571] | 505 [483–575] | 432 [379–450] | 469 [413–487] | 473 [417–493] | 1.55 | 1.44 |
| ref_100_input:warm | 0.70 [0.60–1.00] | 31.5 [29.0–32.6] | 15.9 [15.4–21.1] | 0.70 [0.50–0.90] | 29.0 [26.8–31.7] | 16.2 [15.6–18.6] | 0.01 | 0.01 |
| ref_300_input:warm | 2.00 [1.00–2.70] | 31.4 [29.9–48.1] | 21.5 [19.7–39.5] | 1.90 [1.20–2.80] | 41.2 [31.2–48.5] | 33.1 [19.2–41.1] | 0.01 | 0.01 |
| ref_100_mini:warm | 11.0 [5.70–18.0] | 29.3 [28.3–30.5] | 24.2 [13.0–28.9] | 9.90 [7.30–13.7] | 29.0 [27.8–29.6] | 23.1 [16.9–24.3] | 0.11 | 0.10 |
| ref_300_mini:warm | 17.9 [14.7–21.1] | 39.4 [31.3–45.5] | 40.5 [33.0–46.9] | 15.3 [8.40–17.0] | 33.4 [29.9–41.2] | 34.4 [22.8–42.5] | 0.06 | 0.05 |

### Unmount (warm)

| scenario | npm js | npm painted | npm task | clone js | clone painted | clone task | npm js per control | clone js per control |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| unmount_100_desk:warm | 12.9 [11.8–18.9] | 23.6 [16.6–29.3] | 14.6 [13.1–21.5] | 10.2 [8.40–15.7] | 20.5 [13.7–23.7] | 12.3 [9.73–17.6] | 0.13 | 0.10 |
| unmount_100_opts20:warm | 12.6 [11.8–15.7] | 24.4 [17.5–26.4] | 14.1 [13.3–17.8] | 15.5 [8.80–17.0] | 20.3 [16.7–25.0] | 17.8 [10.3–19.2] | 0.13 | 0.15 |
| unmount_ref_100_input:warm | 1.00 [0.70–1.40] | 25.0 [23.5–27.6] | 2.74 [2.29–3.35] | 0.80 [0.70–1.10] | 26.8 [25.1–27.7] | 2.66 [2.23–3.15] | 0.01 | 0.01 |
| unmount_ref_100_mini:warm | 2.10 [0.80–2.50] | 27.4 [26.7–30.2] | 3.82 [2.32–4.29] | 1.80 [1.20–2.10] | 27.6 [26.1–29.6] | 3.25 [2.32–3.71] | 0.02 | 0.02 |

### Open / close (25 Desk-like mounted; 20 options set on #0 while closed, then open by prop)

| scenario | npm js | npm painted | npm task | clone js | clone painted | clone task |
|---|---:|---:|---:|---:|---:|---:|
| options20_arrive_closed | 1.70 [1.60–3.60] | 25.2 [12.3–27.6] | 3.28 [2.63–5.51] | 1.90 [1.50–3.20] | 25.4 [21.3–29.0] | 3.65 [2.65–5.00] |
| first_open_opts20 | 49.6 [33.3–53.9] | 59.8 [43.7–63.9] | 65.4 [48.8–69.1] | 38.0 [33.7–49.8] | 49.6 [44.5–61.6] | 55.6 [49.1–66.6] |
| first_close_opts20 | 9.20 [4.70–10.5] | 25.0 [19.0–34.4] | 20.8 [13.4–29.0] | 4.70 [4.20–6.50] | 24.6 [11.2–30.0] | 15.1 [12.9–20.6] |
| second_open_opts20 | 30.5 [21.4–34.5] | 36.6 [28.6–41.3] | 42.0 [33.2–47.8] | 21.0 [19.4–34.1] | 30.6 [29.3–41.2] | 35.0 [29.9–47.0] |
| open_other_opts20 | 30.3 [21.1–36.3] | 50.1 [33.9–50.5] | 60.5 [45.2–65.4] | 32.0 [18.9–39.6] | 50.1 [33.3–50.4] | 61.3 [40.7–66.3] |
| open_filterable_20 | 64.1 [42.2–79.5] | 74.6 [52.2–91.8] | 75.9 [53.3–93.2] | 51.7 [41.9–75.3] | 65.9 [51.2–87.2] | 67.1 [52.4–88.4] |
| open_filterable_500 | 322 [313–337] | 373 [365–389] | 374 [366–390] | 334 [289–363] | 391 [338–413] | 392 [340–414] |

### Prop updates on 100 mounted closed Desk-like Comboboxes (one tick)

| scenario | npm js | npm painted | npm task | clone js | clone painted | clone task | npm js per control | clone js per control |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| update100_query | 66.6 [62.7–71.8] | 75.0 [69.9–81.0] | 75.8 [70.8–82.0] | 68.9 [57.3–89.4] | 77.5 [64.4–96.8] | 82.8 [65.2–98.0] | 0.67 | 0.69 |
| update100_options20 | 50.9 [47.3–59.2] | 63.2 [50.9–66.5] | 51.9 [48.6–61.1] | 60.7 [50.8–62.1] | 67.7 [59.2–72.2] | 62.1 [52.1–63.1] | 0.51 | 0.61 |
| update100_query_again | 71.8 [59.8–81.6] | 79.8 [67.5–89.2] | 88.4 [75.0–98.3] | 68.5 [64.2–70.8] | 76.3 [71.7–78.6] | 84.6 [80.0–86.5] | 0.72 | 0.69 |
| update100_placeholder | 68.7 [46.6–79.0] | 71.6 [48.4–82.3] | 72.0 [48.6–83.0] | 67.6 [55.6–84.3] | 71.9 [58.1–87.5] | 70.4 [58.7–88.1] | 0.69 | 0.68 |
| update1_query | 1.20 [1.10–1.80] | 18.8 [10.8–21.4] | 4.16 [3.74–5.66] | 1.20 [0.90–2.00] | 22.4 [11.0–26.0] | 4.09 [3.32–6.16] | 1.20 | 1.20 |
| update1_options20 | 1.00 [0.60–1.50] | 28.7 [27.8–29.8] | 1.72 [1.10–2.70] | 0.90 [0.80–1.30] | 28.6 [26.0–29.3] | 1.68 [1.31–2.36] | 1.00 | 0.90 |
| ref_mini_update100_query | 12.5 [7.10–16.2] | 26.3 [21.8–33.9] | 22.8 [15.0–28.6] | 10.5 [6.70–15.2] | 25.5 [17.3–31.9] | 17.9 [14.8–28.8] | 0.13 | 0.10 |

### Typing "Customer 001" into one open filterable Combobox (per keystroke; median of the per-run medians [min–max of per-run medians]; max = slowest single keystroke over all runs)

| options | npm js/key | npm painted/key | npm max js | clone js/key | clone painted/key | clone max js | rows after |
|---|---:|---:|---:|---:|---:|---:|---:|
| 20 | 12.5 [8.55–13.5] | 33.3 [33.1–33.3] | 24.1 | 11.2 [8.85–14.1] | 33.2 [33.1–33.3] | 22.4 | 20→20→20→20→20→20→20→20→20→20→20→10 |
| 500 | 218 [198–232] | 232 [207–249] | 288 | 220 [195–231] | 232 [211–249] | 332 | 500→500→500→500→500→500→500→500→500→500→100→10 |

### Per closed Combobox (count build: @vue/reactivity constructors instrumented; one cell's subtree, BenchCell wrapper excluded)

| per control | npm | clone |
|---|---:|---:|
| **desk** component instances | 20 | 20 |
| desk ReactiveEffects (render + watch) | 40 | 40 |
| desk watch | 20 | 20 |
| desk computed | 59 | 59 |
| desk ref | 54 | 54 |
| desk objectRef | 37 | 37 |
| desk customRef | 4 | 4 |
| desk proxy | 4 | 4 |
| desk dep | 139 | 139 |
| desk EffectScopes (non-instance) | 0 | 0 |
| desk DOM nodes in the control (el/text/comment) | 28 (6/18/4) | 28 (6/18/4) |
| **opts20** component instances | 20 | 20 |
| opts20 ReactiveEffects (render + watch) | 40 | 40 |
| opts20 watch | 20 | 20 |
| opts20 computed | 59 | 59 |
| opts20 ref | 54 | 54 |
| opts20 objectRef | 37 | 37 |
| opts20 customRef | 4 | 4 |
| opts20 proxy | 4 | 4 |
| opts20 dep | 139 | 139 |
| opts20 EffectScopes (non-instance) | 0 | 0 |
| opts20 DOM nodes in the control (el/text/comment) | 28 (6/18/4) | 28 (6/18/4) |
| **mini** reference instances / effects / computeds / DOM nodes | 1 / 1 / 0 / 2 | 1 / 1 / 0 / 2 |
| open (20 options): instances | 225 | 225 |

### Memory and listeners per control (100 mounted, CDP after 2x GC; median [min–max] of 7 runs)

| per control | npm | clone |
|---|---:|---:|
| Combobox desk: JS heap KB | 118 [118–118] | 118 [118–118] |
| Combobox desk: DOM nodes (Blink counter) | 40.0 [40.0–40.0] | 40.0 [40.0–40.0] |
| Combobox desk: JS event listeners (Blink counter) | 11.0 [11.0–11.0] | 11.0 [11.0–11.0] |
| Combobox desk: listeners on one control's subtree | 11: blur×1 click×2 compositionend×1 compositionstart×1 compositionupdate×1 focus×1 focusout×1 input×1 keydown×1 pointerleave×1 | 11: blur×1 click×2 compositionend×1 compositionstart×1 compositionupdate×1 focus×1 focusout×1 input×1 keydown×1 pointerleave×1 |
| Combobox opts20: JS heap KB | 123 [123–123] | 123 [123–123] |
| Combobox opts20: DOM nodes (Blink counter) | 40.0 [40.0–40.0] | 40.0 [40.0–40.0] |
| Combobox opts20: JS event listeners (Blink counter) | 11.0 [11.0–11.0] | 11.0 [11.0–11.0] |
| Combobox opts20: listeners on one control's subtree | 11: blur×1 click×2 compositionend×1 compositionstart×1 compositionupdate×1 focus×1 focusout×1 input×1 keydown×1 pointerleave×1 | 11: blur×1 click×2 compositionend×1 compositionstart×1 compositionupdate×1 focus×1 focusout×1 input×1 keydown×1 pointerleave×1 |
| mini Vue input: JS heap KB | 6.70 [6.70–6.70] | 6.70 [6.70–6.70] |
| mini Vue input: DOM nodes (Blink counter) | 7.01 [7.01–7.01] | 7.01 [7.01–7.01] |
| mini Vue input: JS event listeners (Blink counter) | 1.00 [1.00–1.00] | 1.00 [1.00–1.00] |
| mini Vue input: listeners on one control's subtree | 1: input×1 | 1: input×1 |
| plain <input>: JS heap KB | 0.01 [0.01–0.01] | 0.01 [0.01–0.01] |
| plain <input>: DOM nodes (Blink counter) | 6.01 [6.01–6.01] | 6.01 [6.01–6.01] |
| plain <input>: JS event listeners (Blink counter) | 0.00 [0.00–0.00] | 0.00 [0.00–0.00] |
| plain <input>: listeners on one control's subtree | 0:  | 0:  |
| document listeners after 100 Comboboxes | 0:  | 0:  |
| window listeners after 100 Comboboxes | 13: __playwright_global_listeners_check__ auxclick click contextmenu dblclick mousedown mousemove mouseup pointerdown pointerup touchcancel touchend touchstart | 13: __playwright_global_listeners_check__ auxclick click contextmenu dblclick mousedown mousemove mouseup pointerdown pointerup touchcancel touchend touchstart |

### npm: per-component split of mounting 100 Desk-like Comboboxes (Vue DEV build, app.config.performance; median of 5 runs; dev mode is ~1.7x slower than prod, use the shares)

mountSelf = the component's own 'mount' measure minus nested child mounts (includes its setup and first render). renders > mounts means it re-rendered right after mounting.

| component | instances | setup ms | render ms | renders | mountSelf ms | share | mount incl. children ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Primitive | 500 | 16.6 | 29.4 | 900 | 77.7 | 25.1% | 437 |
| Combobox | 100 | 19.1 | 2.61 | 100 | 26.8 | 8.6% | 281 |
| ComboboxRoot | 100 | 19.8 | 1.28 | 100 | 24.9 | 8.0% | 239 |
| ComboboxInput | 100 | 10.7 | 3.64 | 100 | 19.8 | 6.4% | 52.8 |
| ListboxRoot | 100 | 13.5 | 2.31 | 100 | 19.8 | 6.4% | 201 |
| ComboboxContent | 100 | 10.2 | 1.85 | 100 | 15.3 | 5.0% | 28.2 |
| ListboxFilter | 100 | 6.82 | 4.20 | 100 | 15.0 | 4.8% | 32.6 |
| PrimitiveSlot | 100 | 2.23 | 10.5 | 200 | 13.0 | 4.2% | 117 |
| Presence | 100 | 9.67 | 0.65 | 100 | 12.6 | 4.1% | 12.6 |
| ComboboxTrigger | 100 | 4.38 | 5.76 | 200 | 12.5 | 4.0% | 24.8 |
| LabelingWrapper | 100 | 2.77 | 3.70 | 100 | 12.2 | 3.9% | 251 |
| PopperAnchor | 100 | 6.87 | 2.83 | 200 | 12.2 | 3.9% | 135 |
| PopperRoot | 100 | 2.07 | 4.70 | 100 | 11.2 | 3.6% | 212 |
| BenchCell | 100 | 2.39 | 2.63 | 100 | 10.4 | 3.4% | 291 |
| ComboboxAnchor | 100 | 3.69 | 2.63 | 200 | 8.84 | 2.9% | 144 |
| ComboboxPortal | 100 | 2.28 | 4.64 | 200 | 8.84 | 2.9% | 14.5 |
| Teleport | 100 | 2.51 | 4.11 | 200 | 5.65 | 1.8% | 5.65 |
| Anonymous | 1 | 0.08 | 0.38 | 1 | 2.87 | 0.9% | 295 |
| sync mount / js / painted | | | | | 305 [281–305] / 408 [383–408] / 428 [404–429] | | |

### clone: per-component split of mounting 100 Desk-like Comboboxes (Vue DEV build, app.config.performance; median of 5 runs; dev mode is ~1.7x slower than prod, use the shares)

mountSelf = the component's own 'mount' measure minus nested child mounts (includes its setup and first render). renders > mounts means it re-rendered right after mounting.

| component | instances | setup ms | render ms | renders | mountSelf ms | share | mount incl. children ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| Primitive | 500 | 27.1 | 39.8 | 900 | 110 | 26.3% | 569 |
| Combobox | 100 | 31.5 | 2.92 | 100 | 39.3 | 9.4% | 350 |
| ComboboxRoot | 100 | 20.2 | 1.79 | 100 | 26.6 | 6.4% | 294 |
| ComboboxContent | 100 | 20.3 | 2.42 | 100 | 26.1 | 6.3% | 44.6 |
| ComboboxInput | 100 | 15.0 | 4.88 | 100 | 25.8 | 6.2% | 72.6 |
| ListboxRoot | 100 | 16.0 | 2.78 | 100 | 23.5 | 5.6% | 251 |
| Presence | 100 | 15.0 | 0.83 | 100 | 19.5 | 4.7% | 19.5 |
| ListboxFilter | 100 | 9.17 | 6.13 | 100 | 19.3 | 4.6% | 48.0 |
| LabelingWrapper | 100 | 4.06 | 5.38 | 100 | 18.2 | 4.4% | 311 |
| PopperRoot | 100 | 2.84 | 5.83 | 100 | 16.8 | 4.0% | 268 |
| PrimitiveSlot | 100 | 3.24 | 13.7 | 200 | 16.4 | 3.9% | 152 |
| ComboboxTrigger | 100 | 5.13 | 8.20 | 200 | 15.3 | 3.7% | 31.4 |
| PopperAnchor | 100 | 7.55 | 4.07 | 200 | 13.7 | 3.3% | 174 |
| BenchCell | 100 | 3.35 | 2.96 | 100 | 12.9 | 3.1% | 363 |
| ComboboxAnchor | 100 | 4.77 | 3.90 | 200 | 11.1 | 2.7% | 185 |
| ComboboxPortal | 100 | 2.90 | 5.97 | 200 | 11.1 | 2.7% | 18.6 |
| Teleport | 100 | 3.39 | 5.22 | 200 | 8.11 | 1.9% | 8.11 |
| Anonymous | 1 | 0.08 | 0.29 | 1 | 3.24 | 0.8% | 367 |
| sync mount / js / painted | | | | | 381 [323–485] / 545 [427–651] / 582 [449–690] | | |
