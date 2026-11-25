## CPU profile attribution: npm-prof, mount 100 Desk-like closed Comboboxes

Profiles: npm-prof-mount100-run0.cpuprofile, npm-prof-mount100-run1.cpuprofile, npm-prof-mount100-run2.cpuprofile, npm-prof-mount100-run3.cpuprofile, npm-prof-mount100-run4.cpuprofile

Non-idle sampled time: 317.38 ms per run (50 us sampling).

### Self time by source group

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| vue:runtime-core | 122.61 | 38.6% |
| vue:reactivity | 57.29 | 18.0% |
| native:(garbage collector) | 29.02 | 9.1% |
| native:(program) | 23.26 | 7.3% |
| vue:shared | 18.19 | 5.7% |
| vue:runtime-dom | 13.48 | 4.2% |
| native:builtin/dom | 11.64 | 3.7% |
| reka:shared/useForwardExpose | 10.84 | 3.4% |
| reka:Combobox/ComboboxRoot | 3.98 | 1.3% |
| fui:components/Combobox/Combobox.vue | 3.32 | 1.0% |
| reka:Listbox/ListboxRoot | 2.14 | 0.7% |
| unmapped | 2.02 | 0.6% |
| vueuse:core | 1.59 | 0.5% |
| reka:Combobox/ComboboxContent | 1.57 | 0.5% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | 1.50 | 0.5% |
| reka:Combobox/ComboboxInput | 1.41 | 0.4% |
| reka:shared/useForwardProps | 1.15 | 0.4% |
| reka:Listbox/ListboxFilter | 0.96 | 0.3% |
| reka:Primitive/Slot | 0.95 | 0.3% |
| reka:Primitive/Primitive | 0.92 | 0.3% |
| reka:Presence/usePresence | 0.85 | 0.3% |
| reka:Combobox/ComboboxTrigger | 0.84 | 0.3% |
| reka:Combobox/ComboboxAnchor | 0.76 | 0.2% |
| reka:shared/renderSlotFragments | 0.73 | 0.2% |
| reka:shared/createContext | 0.62 | 0.2% |
| reka:Presence/Presence | 0.55 | 0.2% |
| reka:Popper/PopperAnchor | 0.52 | 0.2% |
| reka:Teleport/Teleport | 0.37 | 0.1% |
| reka:Collection/Collection | 0.36 | 0.1% |
| vueuse:shared | 0.34 | 0.1% |
| fui:composables/useInputLabeling.ts | 0.34 | 0.1% |
| reka:Primitive/usePrimitiveElement | 0.31 | 0.1% |
| fui:components/Combobox/utils.ts | 0.28 | 0.1% |
| fui:composables/useSlotTick.ts | 0.26 | 0.1% |
| reka:shared/useEmitAsProps | 0.25 | 0.1% |
| reka:Combobox/ComboboxPortal | 0.22 | 0.1% |
| reka:Popper/PopperRoot | 0.20 | 0.1% |
| fui:composables/useReactiveSlots.ts | 0.20 | 0.1% |
| reka:shared/useForwardPropsEmits | 0.19 | 0.1% |
| fui:components/shared/selection/utils.ts | 0.17 | 0.1% |

### Nearest owner (Vue machinery charged to the innermost frappe-ui/reka/vueuse/bench frame)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| bench (B.mount: Vue mount/patch with no component frame on stack) | 104.08 | 32.8% |
| vue (no owner) | 31.16 | 9.8% |
| native:(garbage collector) | 29.02 | 9.1% |
| native:(program) | 23.26 | 7.3% |
| reka:shared/useForwardExpose | 14.95 | 4.7% |
| reka:Combobox/ComboboxRoot | 13.98 | 4.4% |
| fui:components/Combobox/Combobox.vue | 13.02 | 4.1% |
| unmapped | 10.55 | 3.3% |
| reka:Listbox/ListboxRoot | 8.42 | 2.7% |
| reka:Primitive/Primitive | 8.13 | 2.6% |
| vueuse:core | 6.53 | 2.1% |
| reka:Combobox/ComboboxInput | 6.30 | 2.0% |
| reka:Combobox/ComboboxTrigger | 4.69 | 1.5% |
| reka:Primitive/Slot | 4.21 | 1.3% |
| reka:Presence/usePresence | 3.74 | 1.2% |
| reka:Combobox/ComboboxAnchor | 3.67 | 1.2% |
| reka:Combobox/ComboboxContent | 3.32 | 1.0% |
| reka:Popper/PopperAnchor | 3.10 | 1.0% |
| reka:Combobox/ComboboxPortal | 2.93 | 0.9% |
| reka:Listbox/ListboxFilter | 2.78 | 0.9% |
| native:builtin/dom | 2.32 | 0.7% |
| reka:shared/useForwardProps | 2.10 | 0.7% |
| reka:shared/createContext | 1.98 | 0.6% |
| reka:Teleport/Teleport | 1.74 | 0.5% |
| reka:Presence/Presence | 1.31 | 0.4% |
| fui:composables/useInputLabeling.ts | 1.24 | 0.4% |
| reka:Collection/Collection | 0.94 | 0.3% |
| reka:Popper/PopperRoot | 0.85 | 0.3% |
| reka:shared/renderSlotFragments | 0.73 | 0.2% |
| reka:Primitive/usePrimitiveElement | 0.70 | 0.2% |
| vueuse:shared | 0.58 | 0.2% |
| reka:shared/useFormControl | 0.55 | 0.2% |
| reka:shared/useForwardPropsEmits | 0.53 | 0.2% |
| fui:composables/useSlotTick.ts | 0.51 | 0.2% |
| reka:shared/useDirection | 0.47 | 0.1% |
| fui:composables/usePortalTarget.ts | 0.35 | 0.1% |
| reka:shared/useEmitAsProps | 0.31 | 0.1% |
| reka:Combobox/useComboboxContentPositioning | 0.31 | 0.1% |
| fui:components/Combobox/utils.ts | 0.28 | 0.1% |
| fui:composables/useReactiveSlots.ts | 0.27 | 0.1% |

### Inclusive time by source group

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| vue:runtime-core | 261.70 | 82.5% |
| vue:reactivity | 251.47 | 79.2% |
| vue:runtime-dom | 199.77 | 62.9% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | 197.97 | 62.4% |
| native:(garbage collector) | 29.02 | 9.1% |
| native:(program) | 23.26 | 7.3% |
| reka:Primitive/Primitive | 22.99 | 7.2% |
| reka:Combobox/ComboboxRoot | 20.56 | 6.5% |
| vue:shared | 18.19 | 5.7% |
| reka:Listbox/ListboxRoot | 16.70 | 5.3% |
| unmapped | 15.82 | 5.0% |
| reka:shared/useForwardExpose | 15.11 | 4.8% |
| fui:components/Combobox/Combobox.vue | 14.30 | 4.5% |
| reka:Combobox/ComboboxAnchor | 11.88 | 3.7% |
| native:builtin/dom | 11.69 | 3.7% |
| reka:Combobox/ComboboxInput | 10.96 | 3.5% |
| reka:Combobox/ComboboxContent | 9.11 | 2.9% |
| reka:Presence/Presence | 8.74 | 2.8% |
| reka:Popper/PopperAnchor | 7.37 | 2.3% |
| reka:Combobox/ComboboxTrigger | 7.14 | 2.3% |
| reka:Primitive/Slot | 7.14 | 2.2% |
| vueuse:core | 6.53 | 2.1% |
| reka:Combobox/ComboboxPortal | 3.98 | 1.3% |
| reka:Presence/usePresence | 3.94 | 1.2% |
| reka:Popper/PopperRoot | 3.92 | 1.2% |
| reka:Teleport/Teleport | 3.39 | 1.1% |
| reka:Listbox/ListboxFilter | 3.33 | 1.1% |
| reka:shared/useForwardPropsEmits | 2.95 | 0.9% |
| reka:shared/useForwardProps | 2.10 | 0.7% |
| reka:shared/createContext | 1.98 | 0.6% |
| fui:composables/useInputLabeling.ts | 1.49 | 0.5% |
| reka:Collection/Collection | 0.94 | 0.3% |
| reka:Primitive/usePrimitiveElement | 0.78 | 0.2% |
| fui:composables/useReactiveSlots.ts | 0.76 | 0.2% |
| reka:shared/renderSlotFragments | 0.73 | 0.2% |
| reka:shared/useFormControl | 0.62 | 0.2% |
| fui:components/shared/selection/useFilteredGroups.ts | 0.62 | 0.2% |
| vueuse:shared | 0.58 | 0.2% |
| reka:shared/useDirection | 0.52 | 0.2% |
| fui:composables/useSlotTick.ts | 0.51 | 0.2% |

### Self time by function (top 50)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| native:(garbage collector) | (garbage collector) | 29.02 | 9.1% |
| native:(program) | (program) | 23.26 | 7.3% |
| vue:reactivity | track @reactivity.esm-bundler.js:680 | 9.42 | 3.0% |
| vue:runtime-core | setFullProps @runtime-core.esm-bundler.js:5212 | 9.17 | 2.9% |
| vue:runtime-core | mergeProps @runtime-core.esm-bundler.js:8361 | 8.62 | 2.7% |
| vue:runtime-core | callWithErrorHandling @runtime-core.esm-bundler.js:197 | 6.15 | 1.9% |
| reka:shared/useForwardExpose | useForwardExpose @useForwardExpose.js:5 | 5.80 | 1.8% |
| vue:runtime-core | renderComponentRoot @runtime-core.esm-bundler.js:4787 | 5.80 | 1.8% |
| vue:runtime-core | initProps @runtime-core.esm-bundler.js:5090 | 4.56 | 1.4% |
| vue:runtime-core | guardReactiveProps @runtime-core.esm-bundler.js:8214 | 4.25 | 1.3% |
| vue:reactivity | track @reactivity.esm-bundler.js:572 | 3.97 | 1.3% |
| native:builtin/dom | insertBefore | 3.69 | 1.2% |
| vue:shared | def @shared.esm-bundler.js:91 | 3.66 | 1.2% |
| vue:runtime-core | doWatch @runtime-core.esm-bundler.js:922 | 3.65 | 1.1% |
| vue:runtime-core | createComponentInstance @runtime-core.esm-bundler.js:8401 | 3.61 | 1.1% |
| vue:shared | normalizeClass @shared.esm-bundler.js:297 | 3.58 | 1.1% |
| reka:shared/useForwardExpose | forwardRef @useForwardExpose.js:33 | 3.53 | 1.1% |
| vue:reactivity | toRefs @reactivity.esm-bundler.js:1644 | 3.46 | 1.1% |
| vue:shared | hasOwn @shared.esm-bundler.js:29 | 3.30 | 1.0% |
| vue:runtime-core | renderFnWithContext @runtime-core.esm-bundler.js:746 | 3.17 | 1.0% |
| vue:reactivity | createReactiveObject @reactivity.esm-bundler.js:1464 | 3.16 | 1.0% |
| vue:runtime-core | componentUpdateFn @runtime-core.esm-bundler.js:6357 | 3.01 | 0.9% |
| vue:reactivity | get @reactivity.esm-bundler.js:1029 | 2.85 | 0.9% |
| vue:runtime-core | createBaseVNode @runtime-core.esm-bundler.js:8082 | 2.80 | 0.9% |
| vue:runtime-core | patch @runtime-core.esm-bundler.js:5694 | 2.77 | 0.9% |
| vue:reactivity | refreshComputed @reactivity.esm-bundler.js:402 | 2.76 | 0.9% |
| vue:runtime-dom | patchDOMProp @runtime-dom.esm-bundler.js:728 | 2.73 | 0.9% |
| vue:reactivity | watch$1 @reactivity.esm-bundler.js:1856 | 2.70 | 0.9% |
| vue:runtime-core | setupStatefulComponent @runtime-core.esm-bundler.js:8551 | 2.07 | 0.7% |
| reka:Combobox/ComboboxRoot | setup @ComboboxRoot.js:114 | 2.03 | 0.6% |
| vue:reactivity | run @reactivity.esm-bundler.js:256 | 2.02 | 0.6% |
| vue:runtime-core | cloneVNode @runtime-core.esm-bundler.js:8219 | 1.93 | 0.6% |
| vue:runtime-core | setupRenderEffect @runtime-core.esm-bundler.js:6356 | 1.89 | 0.6% |
| vue:runtime-core | registerLifecycleHook @runtime-core.esm-bundler.js:4108 | 1.89 | 0.6% |
| vue:runtime-core | mountComponent @runtime-core.esm-bundler.js:6278 | 1.84 | 0.6% |
| vue:runtime-dom | patchProp @runtime-dom.esm-bundler.js:877 | 1.82 | 0.6% |
| vue:runtime-core | finishComponentSetup @runtime-core.esm-bundler.js:8668 | 1.81 | 0.6% |
| vue:runtime-core | mountElement @runtime-core.esm-bundler.js:5909 | 1.77 | 0.6% |
| vue:runtime-dom | shouldSetAsProp @runtime-dom.esm-bundler.js:908 | 1.74 | 0.5% |
| vue:shared | (anon) @shared.esm-bundler.js:10 | 1.69 | 0.5% |
| vue:runtime-core | _createVNode @runtime-core.esm-bundler.js:8150 | 1.69 | 0.5% |
| native:builtin/dom | setAttribute | 1.67 | 0.5% |
| vue:runtime-core | setupComponent @runtime-core.esm-bundler.js:8541 | 1.66 | 0.5% |
| vue:reactivity | ownKeys @reactivity.esm-bundler.js:1143 | 1.61 | 0.5% |
| vue:reactivity | get value @reactivity.esm-bundler.js:1556 | 1.58 | 0.5% |
| native:builtin/dom | addEventListener | 1.57 | 0.5% |
| unmapped | setup @?:null | 1.52 | 0.5% |
| vue:shared | (anon) @shared.esm-bundler.js:60 | 1.48 | 0.5% |
| vue:runtime-core | flushPostFlushCbs @runtime-core.esm-bundler.js:367 | 1.47 | 0.5% |
| vue:runtime-core | get @runtime-core.esm-bundler.js:3595 | 1.31 | 0.4% |

### Inclusive time by function (top 70)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| vue:reactivity | run @reactivity.esm-bundler.js:256 | 245.28 | 77.3% |
| vue:runtime-core | componentUpdateFn @runtime-core.esm-bundler.js:6357 | 243.07 | 76.6% |
| vue:runtime-core | patch @runtime-core.esm-bundler.js:5694 | 241.91 | 76.2% |
| vue:runtime-core | processComponent @runtime-core.esm-bundler.js:6252 | 240.16 | 75.7% |
| vue:runtime-core | processElement @runtime-core.esm-bundler.js:5870 | 238.15 | 75.0% |
| vue:runtime-core | mountComponent @runtime-core.esm-bundler.js:6278 | 205.50 | 64.7% |
| vue:runtime-core | processFragment @runtime-core.esm-bundler.js:6178 | 205.14 | 64.6% |
| vue:runtime-core | mountChildren @runtime-core.esm-bundler.js:6005 | 201.86 | 63.6% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | mount @main.js:98 | 197.81 | 62.3% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | timed @main.js:83 | 197.43 | 62.2% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | (anon) @main.js:120 | 197.22 | 62.1% |
| vue:runtime-dom | app2.mount @runtime-dom.esm-bundler.js:2086 | 195.73 | 61.7% |
| vue:runtime-core | setupRenderEffect @runtime-core.esm-bundler.js:6356 | 195.44 | 61.6% |
| vue:runtime-core | mount @runtime-core.esm-bundler.js:4474 | 195.17 | 61.5% |
| vue:runtime-core | render @runtime-core.esm-bundler.js:7108 | 194.71 | 61.3% |
| vue:runtime-core | flushOnAppMount @runtime-core.esm-bundler.js:410 | 194.60 | 61.3% |
| vue:runtime-core | (anon) @runtime-core.esm-bundler.js:7110 | 184.27 | 58.1% |
| vue:runtime-core | mountElement @runtime-core.esm-bundler.js:5909 | 180.36 | 56.8% |
| vue:runtime-core | callWithErrorHandling @runtime-core.esm-bundler.js:197 | 125.35 | 39.5% |
| vue:runtime-core | setupComponent @runtime-core.esm-bundler.js:8541 | 104.88 | 33.0% |
| vue:runtime-core | setupStatefulComponent @runtime-core.esm-bundler.js:8551 | 77.18 | 24.3% |
| vue:runtime-core | renderComponentRoot @runtime-core.esm-bundler.js:4787 | 70.73 | 22.3% |
| vue:runtime-core | flushJobs @runtime-core.esm-bundler.js:426 | 65.18 | 20.5% |
| vue:reactivity | runIfDirty @reactivity.esm-bundler.js:304 | 62.96 | 19.8% |
| vue:runtime-core | patchElement @runtime-core.esm-bundler.js:6021 | 57.34 | 18.1% |
| vue:runtime-core | patchChildren @runtime-core.esm-bundler.js:6571 | 56.95 | 17.9% |
| vue:runtime-core | patchKeyedChildren @runtime-core.esm-bundler.js:6692 | 56.72 | 17.9% |
| vue:runtime-core | updateComponent @runtime-core.esm-bundler.js:6332 | 55.95 | 17.6% |
| native:(garbage collector) | (garbage collector) | 29.02 | 9.1% |
| vue:runtime-core | renderFnWithContext @runtime-core.esm-bundler.js:746 | 28.23 | 8.9% |
| vue:runtime-core | _createVNode @runtime-core.esm-bundler.js:8150 | 24.71 | 7.8% |
| vue:runtime-core | renderSlot @runtime-core.esm-bundler.js:3460 | 23.70 | 7.5% |
| vue:runtime-core | process @runtime-core.esm-bundler.js:1058 | 23.64 | 7.4% |
| native:(program) | (program) | 23.26 | 7.3% |
| vue:runtime-core | mountToTarget @runtime-core.esm-bundler.js:1085 | 22.84 | 7.2% |
| vue:runtime-core | mount @runtime-core.esm-bundler.js:1071 | 22.15 | 7.0% |
| vue:runtime-core | h @runtime-core.esm-bundler.js:8857 | 21.96 | 6.9% |
| vue:runtime-core | initProps @runtime-core.esm-bundler.js:5090 | 20.80 | 6.6% |
| vue:runtime-core | doWatch @runtime-core.esm-bundler.js:922 | 19.42 | 6.1% |
| reka:Primitive/Primitive | h.default @Primitive.js:26 | 19.05 | 6.0% |
| vue:runtime-core | createBaseVNode @runtime-core.esm-bundler.js:8082 | 18.18 | 5.7% |
| vue:runtime-core | watch @runtime-core.esm-bundler.js:914 | 16.32 | 5.1% |
| vue:runtime-core | setFullProps @runtime-core.esm-bundler.js:5212 | 15.97 | 5.0% |
| vue:runtime-core | normalizeChildren @runtime-core.esm-bundler.js:8312 | 15.82 | 5.0% |
| vue:reactivity | watch$1 @reactivity.esm-bundler.js:1856 | 15.77 | 5.0% |
| vue:reactivity | get value @reactivity.esm-bundler.js:1773 | 14.07 | 4.4% |
| vue:runtime-dom | patchProp @runtime-dom.esm-bundler.js:877 | 13.64 | 4.3% |
| vue:reactivity | get @reactivity.esm-bundler.js:1029 | 13.38 | 4.2% |
| vue:reactivity | refreshComputed @reactivity.esm-bundler.js:402 | 13.06 | 4.1% |
| vue:runtime-core | mergeProps @runtime-core.esm-bundler.js:8361 | 12.47 | 3.9% |
| vue:reactivity | track @reactivity.esm-bundler.js:680 | 12.15 | 3.8% |
| vue:runtime-core | callWithAsyncErrorHandling @runtime-core.esm-bundler.js:204 | 11.06 | 3.5% |
| vue:runtime-core | flushPostFlushCbs @runtime-core.esm-bundler.js:367 | 10.79 | 3.4% |
| unmapped | setup @?:null | 10.76 | 3.4% |
| reka:Combobox/ComboboxRoot | setup @ComboboxRoot.js:114 | 9.86 | 3.1% |
| reka:Combobox/ComboboxInput | setup @ComboboxInput.js:40 | 9.03 | 2.8% |
| reka:Listbox/ListboxRoot | setup @ListboxRoot.js:88 | 8.77 | 2.8% |
| vue:reactivity | job @reactivity.esm-bundler.js:1946 | 8.70 | 2.7% |
| reka:Presence/Presence | setup @Presence.js:17 | 8.64 | 2.7% |
| vue:runtime-core | setRef @runtime-core.esm-bundler.js:1864 | 8.31 | 2.6% |
| vue:runtime-core | updateComponentPreRender @runtime-core.esm-bundler.js:6560 | 8.12 | 2.6% |
| vue:runtime-core | baseWatchOptions.call @runtime-core.esm-bundler.js:959 | 7.89 | 2.5% |
| vue:runtime-core | cloneVNode @runtime-core.esm-bundler.js:8219 | 7.87 | 2.5% |
| vue:reactivity | toRefs @reactivity.esm-bundler.js:1644 | 7.54 | 2.4% |
| reka:shared/useForwardExpose | useForwardExpose @useForwardExpose.js:5 | 7.42 | 2.3% |
| reka:Combobox/ComboboxAnchor | (anon) @ComboboxAnchor.js:35 | 7.38 | 2.3% |
| reka:Primitive/Slot | (anon) @Slot.js:9 | 7.14 | 2.2% |
| vue:runtime-core | guardReactiveProps @runtime-core.esm-bundler.js:8214 | 6.70 | 2.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:664 | 6.40 | 2.0% |
| reka:Listbox/ListboxRoot | (anon) @ListboxRoot.js:357 | 6.32 | 2.0% |

### Inclusive time by function, frappe-ui / reka / vueuse frames only (top 80)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| reka:Primitive/Primitive | h.default @Primitive.js:26 | 19.05 | 6.0% |
| unmapped | setup @?:null | 10.76 | 3.4% |
| reka:Combobox/ComboboxRoot | setup @ComboboxRoot.js:114 | 9.86 | 3.1% |
| reka:Combobox/ComboboxInput | setup @ComboboxInput.js:40 | 9.03 | 2.8% |
| reka:Listbox/ListboxRoot | setup @ListboxRoot.js:88 | 8.77 | 2.8% |
| reka:Presence/Presence | setup @Presence.js:17 | 8.64 | 2.7% |
| reka:shared/useForwardExpose | useForwardExpose @useForwardExpose.js:5 | 7.42 | 2.3% |
| reka:Combobox/ComboboxAnchor | (anon) @ComboboxAnchor.js:35 | 7.38 | 2.3% |
| reka:Primitive/Slot | (anon) @Slot.js:9 | 7.14 | 2.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:664 | 6.40 | 2.0% |
| reka:Listbox/ListboxRoot | (anon) @ListboxRoot.js:357 | 6.32 | 2.0% |
| reka:shared/useForwardExpose | forwardRef @useForwardExpose.js:33 | 5.85 | 1.8% |
| unmapped | (anon) @?:null | 5.07 | 1.6% |
| vueuse:core | useVModel @index.js:7774 | 4.85 | 1.5% |
| reka:Combobox/ComboboxContent | setup @ComboboxContent.js:128 | 4.79 | 1.5% |
| reka:Combobox/ComboboxRoot | (anon) @ComboboxRoot.js:243 | 4.78 | 1.5% |
| reka:Combobox/ComboboxContent | (anon) @ComboboxContent.js:140 | 3.70 | 1.2% |
| reka:Presence/usePresence | usePresence @usePresence.js:7 | 3.49 | 1.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:537 | 3.40 | 1.1% |
| reka:Popper/PopperRoot | (anon) @PopperRoot.js:15 | 3.38 | 1.1% |
| reka:Teleport/Teleport | (anon) @Teleport.js:31 | 3.10 | 1.0% |
| reka:Combobox/ComboboxTrigger | (anon) @ComboboxTrigger.js:32 | 3.01 | 0.9% |
| reka:Popper/PopperAnchor | setup @PopperAnchor.js:23 | 2.83 | 0.9% |
| reka:Combobox/ComboboxRoot | (anon) @ComboboxRoot.js:224 | 2.69 | 0.8% |
| reka:Combobox/ComboboxTrigger | setup @ComboboxTrigger.js:24 | 2.52 | 0.8% |
| reka:Combobox/ComboboxInput | watch.immediate @ComboboxInput.js:106 | 2.48 | 0.8% |
| reka:Combobox/ComboboxPortal | (anon) @ComboboxPortal.js:27 | 2.47 | 0.8% |
| reka:Popper/PopperAnchor | (anon) @PopperAnchor.js:36 | 2.42 | 0.8% |
| reka:Primitive/Primitive | h.default @Primitive.js:25 | 2.26 | 0.7% |
| reka:Combobox/ComboboxRoot | (anon) @ComboboxRoot.js:155 | 2.14 | 0.7% |
| reka:Combobox/ComboboxAnchor | setup @ComboboxAnchor.js:23 | 2.08 | 0.7% |
| reka:shared/useForwardPropsEmits | (anon) @useForwardPropsEmits.js:9 | 1.80 | 0.6% |
| reka:Combobox/ComboboxAnchor | (anon) @ComboboxAnchor.js:30 | 1.72 | 0.5% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:499 | 1.62 | 0.5% |
| reka:Combobox/ComboboxPortal | (anon) @ComboboxPortal.js:29 | 1.52 | 0.5% |
| reka:shared/useForwardProps | (anon) @useForwardProps.js:19 | 1.48 | 0.5% |
| reka:Listbox/ListboxFilter | setup @ListboxFilter.js:35 | 1.48 | 0.5% |
| reka:Combobox/ComboboxInput | (anon) @ComboboxInput.js:115 | 1.44 | 0.5% |
| reka:Listbox/ListboxFilter | (anon) @ListboxFilter.js:79 | 1.43 | 0.5% |
| reka:shared/useForwardExpose | resolveCurrentElement @useForwardExpose.js:12 | 1.27 | 0.4% |
| reka:shared/createContext | injectContext @createContext.js:20 | 1.26 | 0.4% |
| reka:Popper/PopperAnchor | (anon) @PopperAnchor.js:27 | 1.23 | 0.4% |
| reka:shared/useForwardExpose | (anon) @useForwardExpose.js:8 | 1.17 | 0.4% |
| reka:Combobox/ComboboxTrigger | (anon) @ComboboxTrigger.js:47 | 1.15 | 0.4% |
| reka:shared/useForwardPropsEmits | useForwardPropsEmits @useForwardPropsEmits.js:6 | 1.15 | 0.4% |
| reka:Listbox/ListboxRoot | (anon) @ListboxRoot.js:342 | 1.10 | 0.3% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:705 | 1.05 | 0.3% |
| reka:Primitive/Primitive | (anon) @Primitive.js:27 | 0.95 | 0.3% |
| reka:Combobox/ComboboxInput | resetSearchTerm @ComboboxInput.js:93 | 0.93 | 0.3% |
| reka:Collection/Collection | useCollection @Collection.js:7 | 0.92 | 0.3% |
| fui:composables/useInputLabeling.ts | useInputLabeling @useInputLabeling.ts:68 | 0.91 | 0.3% |
| reka:Popper/PopperAnchor | (anon) @PopperAnchor.js:30 | 0.89 | 0.3% |
| reka:shared/useForwardExpose | (anon) @useForwardExpose.js:9 | 0.87 | 0.3% |
| reka:shared/useForwardProps | (anon) @useForwardProps.js:28 | 0.82 | 0.3% |
| reka:shared/renderSlotFragments | renderSlotFragments @renderSlotFragments.js:4 | 0.73 | 0.2% |
| reka:Primitive/Primitive | setup @Primitive.js:23 | 0.73 | 0.2% |
| reka:shared/createContext | provideContext @createContext.js:26 | 0.72 | 0.2% |
| reka:Combobox/ComboboxAnchor | (anon) @ComboboxAnchor.js:25 | 0.69 | 0.2% |
| reka:shared/useForwardExpose | get @useForwardExpose.js:20 | 0.65 | 0.2% |
| reka:Combobox/ComboboxContent | (anon) @ComboboxContent.js:135 | 0.63 | 0.2% |
| reka:shared/useForwardProps | useForwardProps @useForwardProps.js:11 | 0.62 | 0.2% |
| vueuse:core | watch.deep.deep @index.js:7799 | 0.62 | 0.2% |
| fui:components/shared/selection/useFilteredGroups.ts | (anon) @useFilteredGroups.ts:50 | 0.60 | 0.2% |
| fui:composables/useReactiveSlots.ts | useReactiveSlots @useReactiveSlots.ts:21 | 0.60 | 0.2% |
| vueuse:core | getValue @index.js:7783 | 0.56 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:133 | 0.55 | 0.2% |
| vueuse:core | isUpdating @index.js:7792 | 0.54 | 0.2% |
| reka:Presence/usePresence | watch.immediate @usePresence.js:34 | 0.53 | 0.2% |
| fui:composables/useSlotTick.ts | useSlotTick @useSlotTick.ts:26 | 0.51 | 0.2% |
| reka:Combobox/ComboboxRoot | (anon) @ComboboxRoot.js:180 | 0.51 | 0.2% |
| vueuse:core | triggerEmit @index.js:7784 | 0.50 | 0.2% |
| reka:Combobox/ComboboxInput | (anon) @ComboboxInput.js:47 | 0.50 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:206 | 0.49 | 0.2% |
| reka:Primitive/usePrimitiveElement | (anon) @usePrimitiveElement.js:7 | 0.49 | 0.2% |
| fui:components/Combobox/Combobox.vue | watch.immediate @Combobox.vue:431 | 0.47 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:143 | 0.46 | 0.1% |
| reka:shared/useFormControl | (anon) @useFormControl.js:6 | 0.46 | 0.1% |
| reka:Combobox/ComboboxTrigger | (anon) @ComboboxTrigger.js:29 | 0.46 | 0.1% |
| reka:Popper/PopperRoot | setup @PopperRoot.js:9 | 0.42 | 0.1% |
| reka:shared/useTypeahead | useTypeahead @useTypeahead.js:5 | 0.42 | 0.1% |

### Inclusive time by function, frappe-ui frames only (computeds/watchers show as anon @file:line)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| unmapped | setup @?:null | 10.76 | 3.4% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:664 | 6.40 | 2.0% |
| unmapped | (anon) @?:null | 5.07 | 1.6% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:537 | 3.40 | 1.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:499 | 1.62 | 0.5% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:705 | 1.05 | 0.3% |
| fui:composables/useInputLabeling.ts | useInputLabeling @useInputLabeling.ts:68 | 0.91 | 0.3% |
| fui:components/shared/selection/useFilteredGroups.ts | (anon) @useFilteredGroups.ts:50 | 0.60 | 0.2% |
| fui:composables/useReactiveSlots.ts | useReactiveSlots @useReactiveSlots.ts:21 | 0.60 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:133 | 0.55 | 0.2% |
| fui:composables/useSlotTick.ts | useSlotTick @useSlotTick.ts:26 | 0.51 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:206 | 0.49 | 0.2% |
| fui:components/Combobox/Combobox.vue | watch.immediate @Combobox.vue:431 | 0.47 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:143 | 0.46 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:302 | 0.39 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:155 | 0.38 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:692 | 0.34 | 0.1% |
| fui:composables/usePortalTarget.ts | usePortalTarget @usePortalTarget.ts:44 | 0.33 | 0.1% |
| fui:components/Combobox/utils.ts | normalizeComboboxOptions @utils.ts:107 | 0.28 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:150 | 0.27 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:698 | 0.21 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:83 | 0.21 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:102 | 0.19 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:228 | 0.17 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:81 | 0.16 | 0.1% |
| fui:components/shared/selection/utils.ts | triggerSizeClasses @utils.ts:57 | 0.16 | 0.1% |
| fui:components/Combobox/Combobox.vue | skip @Combobox.vue:430 | 0.16 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:73 | 0.16 | 0.1% |
| fui:utils/useId.ts | useId @useId.ts:8 | 0.16 | 0.0% |
| fui:composables/useReactiveSlots.ts | get @useReactiveSlots.ts:26 | 0.16 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:213 | 0.15 | 0.0% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:97 | 0.12 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:194 | 0.11 | 0.0% |
| fui:utils/resolvePropValue.ts | resolvePropValue @resolvePropValue.ts:20 | 0.09 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:173 | 0.08 | 0.0% |
| fui:components/shared/selection/utils.ts | inputFontSizeClasses @utils.ts:61 | 0.07 | 0.0% |
| fui:components/Combobox/Combobox.vue | filterable @Combobox.vue:236 | 0.05 | 0.0% |
| fui:utils/errorLines.ts | errorLines @errorLines.ts:23 | 0.05 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:185 | 0.05 | 0.0% |
| fui:composables/usePortalTarget.ts | (anon) @usePortalTarget.ts:48 | 0.04 | 0.0% |
| fui:components/shared/selection/utils.ts | triggerVariantClasses @utils.ts:88 | 0.03 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:222 | 0.03 | 0.0% |
| fui:components/shared/selection/useEmptyValueMapping.ts | useEmptyValueMapping @useEmptyValueMapping.ts:17 | 0.03 | 0.0% |
| fui:components/Combobox/Combobox.vue | hasDescriptionSlot @Combobox.vue:130 | 0.03 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:81 | 0.02 | 0.0% |
| fui:components/Combobox/utils.ts | flushUngrouped @utils.ts:113 | 0.02 | 0.0% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:85 | 0.02 | 0.0% |
| fui:components/shared/selection/useFilteredGroups.ts | useFilteredGroups @useFilteredGroups.ts:35 | 0.02 | 0.0% |
