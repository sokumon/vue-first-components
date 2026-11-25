## CPU profile attribution: clone-prof, mount 100 Desk-like closed Comboboxes

Profiles: clone-prof-mount100-run0.cpuprofile, clone-prof-mount100-run1.cpuprofile, clone-prof-mount100-run2.cpuprofile, clone-prof-mount100-run3.cpuprofile, clone-prof-mount100-run4.cpuprofile

Non-idle sampled time: 328.80 ms per run (50 us sampling).

### Self time by source group

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| vue:runtime-core | 127.23 | 38.7% |
| vue:reactivity | 55.78 | 17.0% |
| native:(garbage collector) | 32.85 | 10.0% |
| native:(program) | 25.16 | 7.7% |
| vue:shared | 17.23 | 5.2% |
| vue:runtime-dom | 15.44 | 4.7% |
| native:builtin/dom | 12.61 | 3.8% |
| reka:shared/useForwardExpose | 10.23 | 3.1% |
| fui:components/Combobox/Combobox.vue | 4.07 | 1.2% |
| reka:Combobox/ComboboxRoot | 3.75 | 1.1% |
| unmapped | 2.53 | 0.8% |
| reka:Listbox/ListboxRoot | 2.46 | 0.7% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | 1.56 | 0.5% |
| reka:Combobox/ComboboxTrigger | 1.43 | 0.4% |
| reka:Combobox/ComboboxInput | 1.25 | 0.4% |
| reka:shared/useForwardProps | 1.18 | 0.4% |
| reka:Combobox/ComboboxContent | 1.15 | 0.4% |
| vueuse:core | 1.14 | 0.3% |
| reka:Primitive/Slot | 0.90 | 0.3% |
| reka:shared/renderSlotFragments | 0.87 | 0.3% |
| reka:Combobox/ComboboxAnchor | 0.86 | 0.3% |
| reka:Presence/usePresence | 0.86 | 0.3% |
| reka:Listbox/ListboxFilter | 0.81 | 0.2% |
| reka:Popper/PopperAnchor | 0.59 | 0.2% |
| reka:shared/createContext | 0.59 | 0.2% |
| reka:Primitive/usePrimitiveElement | 0.54 | 0.2% |
| vueuse:shared | 0.52 | 0.2% |
| reka:Primitive/Primitive | 0.51 | 0.2% |
| reka:shared/useForwardPropsEmits | 0.43 | 0.1% |
| reka:Collection/Collection | 0.41 | 0.1% |
| fui:composables/useInputLabeling.ts | 0.40 | 0.1% |
| reka:Presence/Presence | 0.35 | 0.1% |
| reka:Teleport/Teleport | 0.33 | 0.1% |
| reka:shared/useEmitAsProps | 0.32 | 0.1% |
| fui:composables/useReactiveSlots.ts | 0.30 | 0.1% |
| fui:composables/usePortalTarget.ts | 0.23 | 0.1% |
| reka:shared/useDirection | 0.23 | 0.1% |
| reka:Combobox/ComboboxPortal | 0.21 | 0.1% |
| reka:shared/useComposing | 0.17 | 0.1% |
| reka:Popper/PopperRoot | 0.17 | 0.1% |

### Nearest owner (Vue machinery charged to the innermost frappe-ui/reka/vueuse/bench frame)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| bench (B.mount: Vue mount/patch with no component frame on stack) | 109.62 | 33.3% |
| native:(garbage collector) | 32.85 | 10.0% |
| vue (no owner) | 32.34 | 9.8% |
| native:(program) | 25.16 | 7.7% |
| reka:shared/useForwardExpose | 14.98 | 4.6% |
| reka:Combobox/ComboboxRoot | 14.11 | 4.3% |
| fui:components/Combobox/Combobox.vue | 13.18 | 4.0% |
| unmapped | 11.48 | 3.5% |
| reka:Primitive/Primitive | 8.48 | 2.6% |
| reka:Listbox/ListboxRoot | 7.41 | 2.3% |
| vueuse:core | 5.70 | 1.7% |
| reka:Combobox/ComboboxTrigger | 5.33 | 1.6% |
| reka:Combobox/ComboboxInput | 5.18 | 1.6% |
| reka:Primitive/Slot | 4.25 | 1.3% |
| reka:Presence/usePresence | 3.61 | 1.1% |
| reka:Combobox/ComboboxAnchor | 3.60 | 1.1% |
| reka:Listbox/ListboxFilter | 3.14 | 1.0% |
| reka:Popper/PopperAnchor | 2.93 | 0.9% |
| reka:Combobox/ComboboxContent | 2.86 | 0.9% |
| reka:Combobox/ComboboxPortal | 2.67 | 0.8% |
| native:builtin/dom | 2.46 | 0.7% |
| reka:shared/useForwardProps | 2.09 | 0.6% |
| reka:shared/createContext | 1.80 | 0.5% |
| fui:composables/useInputLabeling.ts | 1.49 | 0.5% |
| reka:Presence/Presence | 1.49 | 0.5% |
| reka:Teleport/Teleport | 1.25 | 0.4% |
| reka:Collection/Collection | 1.07 | 0.3% |
| reka:Popper/PopperRoot | 0.97 | 0.3% |
| reka:shared/renderSlotFragments | 0.87 | 0.3% |
| reka:Primitive/usePrimitiveElement | 0.82 | 0.2% |
| vueuse:shared | 0.77 | 0.2% |
| reka:shared/useDirection | 0.67 | 0.2% |
| reka:shared/useForwardPropsEmits | 0.56 | 0.2% |
| fui:composables/usePortalTarget.ts | 0.55 | 0.2% |
| fui:composables/useSlotTick.ts | 0.52 | 0.2% |
| reka:shared/useEmitAsProps | 0.41 | 0.1% |
| fui:composables/useReactiveSlots.ts | 0.30 | 0.1% |
| reka:shared/useComposing | 0.25 | 0.1% |
| reka:shared/useStateMachine | 0.20 | 0.1% |
| reka:shared/useFormControl | 0.20 | 0.1% |

### Inclusive time by source group

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| vue:runtime-core | 266.54 | 81.1% |
| vue:reactivity | 254.94 | 77.5% |
| vue:runtime-dom | 203.31 | 61.8% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | 201.53 | 61.3% |
| native:(garbage collector) | 32.85 | 10.0% |
| native:(program) | 25.16 | 7.7% |
| reka:Primitive/Primitive | 24.01 | 7.3% |
| reka:Combobox/ComboboxRoot | 20.73 | 6.3% |
| vue:shared | 17.30 | 5.3% |
| unmapped | 17.12 | 5.2% |
| reka:Listbox/ListboxRoot | 17.04 | 5.2% |
| reka:shared/useForwardExpose | 15.04 | 4.6% |
| fui:components/Combobox/Combobox.vue | 14.72 | 4.5% |
| native:builtin/dom | 12.70 | 3.9% |
| reka:Combobox/ComboboxAnchor | 11.37 | 3.5% |
| reka:Combobox/ComboboxContent | 9.92 | 3.0% |
| reka:Combobox/ComboboxInput | 9.18 | 2.8% |
| reka:Presence/Presence | 8.13 | 2.5% |
| reka:Combobox/ComboboxTrigger | 7.48 | 2.3% |
| reka:Primitive/Slot | 7.03 | 2.1% |
| reka:Popper/PopperAnchor | 5.97 | 1.8% |
| vueuse:core | 5.76 | 1.8% |
| reka:Popper/PopperRoot | 4.69 | 1.4% |
| reka:Presence/usePresence | 3.82 | 1.2% |
| reka:Combobox/ComboboxPortal | 3.68 | 1.1% |
| reka:Listbox/ListboxFilter | 3.43 | 1.0% |
| reka:shared/useForwardPropsEmits | 3.06 | 0.9% |
| reka:Teleport/Teleport | 3.04 | 0.9% |
| reka:shared/useForwardProps | 2.09 | 0.6% |
| reka:shared/createContext | 1.80 | 0.5% |
| fui:composables/useInputLabeling.ts | 1.70 | 0.5% |
| reka:Collection/Collection | 1.07 | 0.3% |
| reka:Primitive/usePrimitiveElement | 1.00 | 0.3% |
| reka:shared/renderSlotFragments | 0.87 | 0.3% |
| fui:composables/useReactiveSlots.ts | 0.80 | 0.2% |
| reka:shared/useDirection | 0.77 | 0.2% |
| vueuse:shared | 0.77 | 0.2% |
| fui:composables/usePortalTarget.ts | 0.56 | 0.2% |
| fui:components/shared/selection/useFilteredGroups.ts | 0.53 | 0.2% |
| fui:composables/useSlotTick.ts | 0.52 | 0.2% |

### Self time by function (top 50)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| native:(garbage collector) | (garbage collector) | 32.85 | 10.0% |
| native:(program) | (program) | 25.16 | 7.7% |
| vue:runtime-core | mergeProps @runtime-core.esm-bundler.js:8361 | 8.48 | 2.6% |
| vue:runtime-core | setFullProps @runtime-core.esm-bundler.js:5212 | 8.43 | 2.6% |
| vue:reactivity | track @reactivity.esm-bundler.js:680 | 8.19 | 2.5% |
| vue:runtime-core | renderComponentRoot @runtime-core.esm-bundler.js:4787 | 6.63 | 2.0% |
| vue:runtime-core | callWithErrorHandling @runtime-core.esm-bundler.js:197 | 6.54 | 2.0% |
| reka:shared/useForwardExpose | useForwardExpose @useForwardExpose.js:5 | 5.78 | 1.8% |
| vue:runtime-core | initProps @runtime-core.esm-bundler.js:5090 | 4.71 | 1.4% |
| vue:runtime-core | guardReactiveProps @runtime-core.esm-bundler.js:8214 | 4.21 | 1.3% |
| vue:runtime-core | createComponentInstance @runtime-core.esm-bundler.js:8401 | 4.11 | 1.3% |
| vue:reactivity | track @reactivity.esm-bundler.js:572 | 4.07 | 1.2% |
| vue:shared | normalizeClass @shared.esm-bundler.js:297 | 3.82 | 1.2% |
| native:builtin/dom | insertBefore | 3.78 | 1.2% |
| vue:runtime-core | renderFnWithContext @runtime-core.esm-bundler.js:746 | 3.54 | 1.1% |
| vue:reactivity | toRefs @reactivity.esm-bundler.js:1644 | 3.54 | 1.1% |
| vue:reactivity | get @reactivity.esm-bundler.js:1029 | 3.45 | 1.0% |
| vue:runtime-core | createBaseVNode @runtime-core.esm-bundler.js:8082 | 3.39 | 1.0% |
| vue:shared | hasOwn @shared.esm-bundler.js:29 | 3.37 | 1.0% |
| vue:runtime-core | patch @runtime-core.esm-bundler.js:5694 | 3.26 | 1.0% |
| vue:runtime-core | doWatch @runtime-core.esm-bundler.js:922 | 3.24 | 1.0% |
| reka:shared/useForwardExpose | forwardRef @useForwardExpose.js:33 | 3.06 | 0.9% |
| vue:reactivity | run @reactivity.esm-bundler.js:256 | 3.03 | 0.9% |
| vue:runtime-dom | patchDOMProp @runtime-dom.esm-bundler.js:728 | 3.01 | 0.9% |
| vue:runtime-core | componentUpdateFn @runtime-core.esm-bundler.js:6357 | 3.00 | 0.9% |
| vue:reactivity | createReactiveObject @reactivity.esm-bundler.js:1464 | 2.94 | 0.9% |
| vue:runtime-core | setupStatefulComponent @runtime-core.esm-bundler.js:8551 | 2.66 | 0.8% |
| vue:runtime-dom | patchProp @runtime-dom.esm-bundler.js:877 | 2.47 | 0.7% |
| vue:reactivity | refreshComputed @reactivity.esm-bundler.js:402 | 2.39 | 0.7% |
| vue:reactivity | watch$1 @reactivity.esm-bundler.js:1856 | 2.30 | 0.7% |
| vue:runtime-core | _createVNode @runtime-core.esm-bundler.js:8150 | 2.15 | 0.7% |
| vue:reactivity | ownKeys @reactivity.esm-bundler.js:1143 | 2.06 | 0.6% |
| vue:runtime-core | flushPostFlushCbs @runtime-core.esm-bundler.js:367 | 1.99 | 0.6% |
| reka:Combobox/ComboboxRoot | setup @ComboboxRoot.js:114 | 1.92 | 0.6% |
| native:builtin/dom | setAttribute | 1.91 | 0.6% |
| vue:runtime-core | setupRenderEffect @runtime-core.esm-bundler.js:6356 | 1.90 | 0.6% |
| vue:runtime-core | registerLifecycleHook @runtime-core.esm-bundler.js:4108 | 1.89 | 0.6% |
| vue:runtime-core | cloneVNode @runtime-core.esm-bundler.js:8219 | 1.87 | 0.6% |
| vue:shared | def @shared.esm-bundler.js:91 | 1.83 | 0.6% |
| vue:runtime-core | mountElement @runtime-core.esm-bundler.js:5909 | 1.72 | 0.5% |
| unmapped | setup @?:null | 1.70 | 0.5% |
| vue:runtime-core | mountComponent @runtime-core.esm-bundler.js:6278 | 1.64 | 0.5% |
| vue:runtime-core | processElement @runtime-core.esm-bundler.js:5870 | 1.64 | 0.5% |
| vue:runtime-core | setupComponent @runtime-core.esm-bundler.js:8541 | 1.62 | 0.5% |
| vue:shared | (anon) @shared.esm-bundler.js:10 | 1.58 | 0.5% |
| vue:shared | (anon) @shared.esm-bundler.js:60 | 1.57 | 0.5% |
| vue:runtime-core | finishComponentSetup @runtime-core.esm-bundler.js:8668 | 1.56 | 0.5% |
| native:builtin/dom | addEventListener | 1.53 | 0.5% |
| reka:Listbox/ListboxRoot | setup @ListboxRoot.js:88 | 1.52 | 0.5% |
| vue:runtime-core | setRef @runtime-core.esm-bundler.js:1864 | 1.43 | 0.4% |

### Inclusive time by function (top 70)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| vue:reactivity | run @reactivity.esm-bundler.js:256 | 248.96 | 75.7% |
| vue:runtime-core | componentUpdateFn @runtime-core.esm-bundler.js:6357 | 246.55 | 75.0% |
| vue:runtime-core | patch @runtime-core.esm-bundler.js:5694 | 245.88 | 74.8% |
| vue:runtime-core | processComponent @runtime-core.esm-bundler.js:6252 | 243.84 | 74.2% |
| vue:runtime-core | processElement @runtime-core.esm-bundler.js:5870 | 240.72 | 73.2% |
| vue:runtime-core | mountComponent @runtime-core.esm-bundler.js:6278 | 208.16 | 63.3% |
| vue:runtime-core | processFragment @runtime-core.esm-bundler.js:6178 | 205.32 | 62.4% |
| vue:runtime-core | mountChildren @runtime-core.esm-bundler.js:6005 | 202.76 | 61.7% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | mount @main.js:98 | 201.30 | 61.2% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | timed @main.js:83 | 200.77 | 61.1% |
| bench (B.mount: Vue mount/patch with no component frame on stack) | (anon) @main.js:120 | 200.56 | 61.0% |
| vue:runtime-dom | app2.mount @runtime-dom.esm-bundler.js:2086 | 198.67 | 60.4% |
| vue:runtime-core | mount @runtime-core.esm-bundler.js:4474 | 197.82 | 60.2% |
| vue:runtime-core | render @runtime-core.esm-bundler.js:7108 | 197.13 | 60.0% |
| vue:runtime-core | flushOnAppMount @runtime-core.esm-bundler.js:410 | 197.05 | 59.9% |
| vue:runtime-core | setupRenderEffect @runtime-core.esm-bundler.js:6356 | 196.75 | 59.8% |
| vue:runtime-core | (anon) @runtime-core.esm-bundler.js:7110 | 186.93 | 56.9% |
| vue:runtime-core | mountElement @runtime-core.esm-bundler.js:5909 | 181.39 | 55.2% |
| vue:runtime-core | callWithErrorHandling @runtime-core.esm-bundler.js:197 | 123.68 | 37.6% |
| vue:runtime-core | setupComponent @runtime-core.esm-bundler.js:8541 | 102.60 | 31.2% |
| vue:runtime-core | setupStatefulComponent @runtime-core.esm-bundler.js:8551 | 75.50 | 23.0% |
| vue:runtime-core | renderComponentRoot @runtime-core.esm-bundler.js:4787 | 73.80 | 22.4% |
| vue:runtime-core | flushJobs @runtime-core.esm-bundler.js:426 | 67.12 | 20.4% |
| vue:reactivity | runIfDirty @reactivity.esm-bundler.js:304 | 65.03 | 19.8% |
| vue:runtime-core | patchElement @runtime-core.esm-bundler.js:6021 | 58.55 | 17.8% |
| vue:runtime-core | patchChildren @runtime-core.esm-bundler.js:6571 | 58.00 | 17.6% |
| vue:runtime-core | patchKeyedChildren @runtime-core.esm-bundler.js:6692 | 57.75 | 17.6% |
| vue:runtime-core | updateComponent @runtime-core.esm-bundler.js:6332 | 57.06 | 17.4% |
| native:(garbage collector) | (garbage collector) | 32.85 | 10.0% |
| vue:runtime-core | renderFnWithContext @runtime-core.esm-bundler.js:746 | 29.11 | 8.9% |
| vue:runtime-core | _createVNode @runtime-core.esm-bundler.js:8150 | 26.30 | 8.0% |
| native:(program) | (program) | 25.16 | 7.7% |
| vue:runtime-core | renderSlot @runtime-core.esm-bundler.js:3460 | 24.61 | 7.5% |
| vue:runtime-core | process @runtime-core.esm-bundler.js:1058 | 24.09 | 7.3% |
| vue:runtime-core | h @runtime-core.esm-bundler.js:8857 | 23.80 | 7.2% |
| vue:runtime-core | mountToTarget @runtime-core.esm-bundler.js:1085 | 23.26 | 7.1% |
| vue:runtime-core | mount @runtime-core.esm-bundler.js:1071 | 22.28 | 6.8% |
| vue:runtime-core | initProps @runtime-core.esm-bundler.js:5090 | 21.40 | 6.5% |
| reka:Primitive/Primitive | h.default @Primitive.js:26 | 20.26 | 6.2% |
| vue:runtime-core | createBaseVNode @runtime-core.esm-bundler.js:8082 | 19.25 | 5.9% |
| vue:runtime-core | doWatch @runtime-core.esm-bundler.js:922 | 17.81 | 5.4% |
| vue:runtime-core | normalizeChildren @runtime-core.esm-bundler.js:8312 | 16.43 | 5.0% |
| vue:runtime-core | setFullProps @runtime-core.esm-bundler.js:5212 | 16.35 | 5.0% |
| vue:reactivity | watch$1 @reactivity.esm-bundler.js:1856 | 14.55 | 4.4% |
| vue:runtime-dom | patchProp @runtime-dom.esm-bundler.js:877 | 14.43 | 4.4% |
| vue:runtime-core | watch @runtime-core.esm-bundler.js:914 | 14.26 | 4.3% |
| vue:reactivity | get @reactivity.esm-bundler.js:1029 | 13.59 | 4.1% |
| vue:reactivity | get value @reactivity.esm-bundler.js:1773 | 13.54 | 4.1% |
| vue:runtime-core | mergeProps @runtime-core.esm-bundler.js:8361 | 12.88 | 3.9% |
| vue:reactivity | refreshComputed @reactivity.esm-bundler.js:402 | 12.71 | 3.9% |
| unmapped | setup @?:null | 11.76 | 3.6% |
| vue:reactivity | track @reactivity.esm-bundler.js:680 | 11.37 | 3.5% |
| vue:runtime-core | flushPostFlushCbs @runtime-core.esm-bundler.js:367 | 10.46 | 3.2% |
| vue:runtime-core | callWithAsyncErrorHandling @runtime-core.esm-bundler.js:204 | 9.62 | 2.9% |
| reka:Combobox/ComboboxRoot | setup @ComboboxRoot.js:114 | 9.16 | 2.8% |
| reka:Listbox/ListboxRoot | setup @ListboxRoot.js:88 | 8.54 | 2.6% |
| vue:runtime-core | setRef @runtime-core.esm-bundler.js:1864 | 8.30 | 2.5% |
| vue:runtime-core | cloneVNode @runtime-core.esm-bundler.js:8219 | 8.26 | 2.5% |
| reka:Presence/Presence | setup @Presence.js:17 | 8.00 | 2.4% |
| vue:runtime-core | updateComponentPreRender @runtime-core.esm-bundler.js:6560 | 7.96 | 2.4% |
| reka:shared/useForwardExpose | useForwardExpose @useForwardExpose.js:5 | 7.93 | 2.4% |
| vue:reactivity | job @reactivity.esm-bundler.js:1946 | 7.64 | 2.3% |
| vue:reactivity | toRefs @reactivity.esm-bundler.js:1644 | 7.37 | 2.2% |
| reka:Combobox/ComboboxAnchor | (anon) @ComboboxAnchor.js:35 | 7.24 | 2.2% |
| reka:Listbox/ListboxRoot | (anon) @ListboxRoot.js:357 | 7.16 | 2.2% |
| reka:Combobox/ComboboxInput | setup @ComboboxInput.js:40 | 7.11 | 2.2% |
| reka:Primitive/Slot | (anon) @Slot.js:9 | 7.01 | 2.1% |
| vue:runtime-core | baseWatchOptions.call @runtime-core.esm-bundler.js:959 | 6.76 | 2.1% |
| vue:runtime-core | createComponentInstance @runtime-core.esm-bundler.js:8401 | 6.69 | 2.0% |
| vue:runtime-core | guardReactiveProps @runtime-core.esm-bundler.js:8214 | 6.48 | 2.0% |

### Inclusive time by function, frappe-ui / reka / vueuse frames only (top 80)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| reka:Primitive/Primitive | h.default @Primitive.js:26 | 20.26 | 6.2% |
| unmapped | setup @?:null | 11.76 | 3.6% |
| reka:Combobox/ComboboxRoot | setup @ComboboxRoot.js:114 | 9.16 | 2.8% |
| reka:Listbox/ListboxRoot | setup @ListboxRoot.js:88 | 8.54 | 2.6% |
| reka:Presence/Presence | setup @Presence.js:17 | 8.00 | 2.4% |
| reka:shared/useForwardExpose | useForwardExpose @useForwardExpose.js:5 | 7.93 | 2.4% |
| reka:Combobox/ComboboxAnchor | (anon) @ComboboxAnchor.js:35 | 7.24 | 2.2% |
| reka:Listbox/ListboxRoot | (anon) @ListboxRoot.js:357 | 7.16 | 2.2% |
| reka:Combobox/ComboboxInput | setup @ComboboxInput.js:40 | 7.11 | 2.2% |
| reka:Primitive/Slot | (anon) @Slot.js:9 | 7.01 | 2.1% |
| reka:Combobox/ComboboxContent | setup @ComboboxContent.js:128 | 6.11 | 1.9% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:664 | 6.00 | 1.8% |
| reka:Combobox/ComboboxRoot | (anon) @ComboboxRoot.js:243 | 5.58 | 1.7% |
| reka:shared/useForwardExpose | forwardRef @useForwardExpose.js:33 | 5.48 | 1.7% |
| unmapped | (anon) @?:null | 5.36 | 1.6% |
| vueuse:core | useVModel @index.js:7774 | 4.24 | 1.3% |
| reka:Popper/PopperRoot | (anon) @PopperRoot.js:15 | 4.05 | 1.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:537 | 3.85 | 1.2% |
| reka:Combobox/ComboboxTrigger | (anon) @ComboboxTrigger.js:32 | 3.61 | 1.1% |
| reka:Presence/usePresence | usePresence @usePresence.js:7 | 3.32 | 1.0% |
| reka:Combobox/ComboboxRoot | (anon) @ComboboxRoot.js:224 | 3.31 | 1.0% |
| reka:Combobox/ComboboxContent | (anon) @ComboboxContent.js:140 | 3.14 | 1.0% |
| reka:Teleport/Teleport | (anon) @Teleport.js:31 | 2.63 | 0.8% |
| reka:Primitive/Primitive | h.default @Primitive.js:25 | 2.55 | 0.8% |
| reka:Combobox/ComboboxTrigger | setup @ComboboxTrigger.js:24 | 2.35 | 0.7% |
| reka:Combobox/ComboboxPortal | (anon) @ComboboxPortal.js:27 | 2.18 | 0.7% |
| reka:Combobox/ComboboxAnchor | setup @ComboboxAnchor.js:23 | 2.05 | 0.6% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:499 | 2.05 | 0.6% |
| reka:Popper/PopperAnchor | (anon) @PopperAnchor.js:36 | 2.05 | 0.6% |
| reka:Popper/PopperAnchor | setup @PopperAnchor.js:23 | 2.02 | 0.6% |
| reka:Combobox/ComboboxRoot | (anon) @ComboboxRoot.js:155 | 1.86 | 0.6% |
| reka:Combobox/ComboboxInput | (anon) @ComboboxInput.js:115 | 1.62 | 0.5% |
| reka:shared/useForwardPropsEmits | useForwardPropsEmits @useForwardPropsEmits.js:6 | 1.53 | 0.5% |
| reka:shared/useForwardPropsEmits | (anon) @useForwardPropsEmits.js:9 | 1.53 | 0.5% |
| reka:Combobox/ComboboxPortal | (anon) @ComboboxPortal.js:29 | 1.45 | 0.4% |
| reka:Listbox/ListboxFilter | (anon) @ListboxFilter.js:79 | 1.42 | 0.4% |
| reka:Listbox/ListboxFilter | setup @ListboxFilter.js:35 | 1.39 | 0.4% |
| reka:Combobox/ComboboxAnchor | (anon) @ComboboxAnchor.js:30 | 1.38 | 0.4% |
| reka:shared/useForwardProps | (anon) @useForwardProps.js:19 | 1.35 | 0.4% |
| reka:shared/useForwardExpose | resolveCurrentElement @useForwardExpose.js:12 | 1.15 | 0.3% |
| reka:Combobox/ComboboxTrigger | (anon) @ComboboxTrigger.js:47 | 1.13 | 0.3% |
| reka:Combobox/ComboboxInput | watch.immediate @ComboboxInput.js:106 | 1.06 | 0.3% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:705 | 1.01 | 0.3% |
| reka:Collection/Collection | useCollection @Collection.js:7 | 1.00 | 0.3% |
| reka:shared/useForwardExpose | (anon) @useForwardExpose.js:9 | 0.97 | 0.3% |
| reka:shared/createContext | injectContext @createContext.js:20 | 0.97 | 0.3% |
| reka:shared/useForwardExpose | get @useForwardExpose.js:20 | 0.97 | 0.3% |
| reka:Popper/PopperAnchor | (anon) @PopperAnchor.js:30 | 0.97 | 0.3% |
| reka:Popper/PopperAnchor | (anon) @PopperAnchor.js:27 | 0.95 | 0.3% |
| reka:shared/useForwardExpose | (anon) @useForwardExpose.js:8 | 0.94 | 0.3% |
| reka:Combobox/ComboboxInput | resetSearchTerm @ComboboxInput.js:93 | 0.94 | 0.3% |
| reka:shared/useForwardProps | (anon) @useForwardProps.js:28 | 0.93 | 0.3% |
| reka:Listbox/ListboxRoot | (anon) @ListboxRoot.js:342 | 0.92 | 0.3% |
| reka:Primitive/Primitive | (anon) @Primitive.js:27 | 0.89 | 0.3% |
| reka:shared/renderSlotFragments | renderSlotFragments @renderSlotFragments.js:4 | 0.87 | 0.3% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:302 | 0.86 | 0.3% |
| reka:shared/createContext | provideContext @createContext.js:26 | 0.83 | 0.3% |
| reka:shared/useForwardProps | useForwardProps @useForwardProps.js:11 | 0.73 | 0.2% |
| fui:composables/useInputLabeling.ts | useInputLabeling @useInputLabeling.ts:68 | 0.71 | 0.2% |
| reka:Combobox/ComboboxAnchor | (anon) @ComboboxAnchor.js:25 | 0.69 | 0.2% |
| reka:Combobox/ComboboxContent | (anon) @ComboboxContent.js:135 | 0.67 | 0.2% |
| fui:composables/useReactiveSlots.ts | useReactiveSlots @useReactiveSlots.ts:21 | 0.67 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:206 | 0.65 | 0.2% |
| reka:Primitive/usePrimitiveElement | (anon) @usePrimitiveElement.js:7 | 0.65 | 0.2% |
| reka:Presence/usePresence | watch.immediate @usePresence.js:34 | 0.62 | 0.2% |
| vueuse:core | isUpdating @index.js:7792 | 0.60 | 0.2% |
| vueuse:core | watch.deep.deep @index.js:7799 | 0.58 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:143 | 0.56 | 0.2% |
| reka:Listbox/ListboxFilter | (anon) @ListboxFilter.js:47 | 0.55 | 0.2% |
| fui:components/shared/selection/useFilteredGroups.ts | (anon) @useFilteredGroups.ts:50 | 0.53 | 0.2% |
| fui:composables/useSlotTick.ts | useSlotTick @useSlotTick.ts:26 | 0.52 | 0.2% |
| fui:components/Combobox/Combobox.vue | watch.immediate @Combobox.vue:431 | 0.51 | 0.2% |
| reka:Popper/PopperRoot | setup @PopperRoot.js:9 | 0.50 | 0.2% |
| vueuse:core | triggerEmit @index.js:7784 | 0.49 | 0.2% |
| reka:shared/useDirection | useDirection @useDirection.js:10 | 0.46 | 0.1% |
| reka:shared/useTypeahead | useTypeahead @useTypeahead.js:5 | 0.45 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:133 | 0.45 | 0.1% |
| reka:shared/useFormControl | (anon) @useFormControl.js:6 | 0.45 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:102 | 0.43 | 0.1% |
| reka:Teleport/Teleport | setup @Teleport.js:26 | 0.41 | 0.1% |

### Inclusive time by function, frappe-ui frames only (computeds/watchers show as anon @file:line)

| | ms per 100-mount (mean of 5) | share |
|---|---:|---:|
| unmapped | setup @?:null | 11.76 | 3.6% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:664 | 6.00 | 1.8% |
| unmapped | (anon) @?:null | 5.36 | 1.6% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:537 | 3.85 | 1.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:499 | 2.05 | 0.6% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:705 | 1.01 | 0.3% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:302 | 0.86 | 0.3% |
| fui:composables/useInputLabeling.ts | useInputLabeling @useInputLabeling.ts:68 | 0.71 | 0.2% |
| fui:composables/useReactiveSlots.ts | useReactiveSlots @useReactiveSlots.ts:21 | 0.67 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:206 | 0.65 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:143 | 0.56 | 0.2% |
| fui:components/shared/selection/useFilteredGroups.ts | (anon) @useFilteredGroups.ts:50 | 0.53 | 0.2% |
| fui:composables/useSlotTick.ts | useSlotTick @useSlotTick.ts:26 | 0.52 | 0.2% |
| fui:components/Combobox/Combobox.vue | watch.immediate @Combobox.vue:431 | 0.51 | 0.2% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:133 | 0.45 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:102 | 0.43 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:692 | 0.38 | 0.1% |
| fui:composables/usePortalTarget.ts | usePortalTarget @usePortalTarget.ts:44 | 0.36 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:155 | 0.33 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:150 | 0.32 | 0.1% |
| fui:components/Combobox/Combobox.vue | skip @Combobox.vue:430 | 0.30 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:194 | 0.25 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:73 | 0.23 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:83 | 0.23 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:97 | 0.22 | 0.1% |
| fui:composables/usePortalTarget.ts | (anon) @usePortalTarget.ts:48 | 0.20 | 0.1% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:228 | 0.19 | 0.1% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:81 | 0.18 | 0.1% |
| fui:components/Combobox/utils.ts | normalizeComboboxOptions @utils.ts:107 | 0.13 | 0.0% |
| fui:composables/useReactiveSlots.ts | get @useReactiveSlots.ts:26 | 0.13 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:698 | 0.13 | 0.0% |
| fui:components/shared/selection/utils.ts | triggerSizeClasses @utils.ts:57 | 0.12 | 0.0% |
| fui:utils/useId.ts | useId @useId.ts:8 | 0.11 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:173 | 0.10 | 0.0% |
| fui:components/Combobox/Combobox.vue | filterable @Combobox.vue:236 | 0.10 | 0.0% |
| fui:composables/useInputLabeling.ts | (anon) @useInputLabeling.ts:85 | 0.09 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:185 | 0.06 | 0.0% |
| fui:components/shared/selection/useIsModelBound.ts | useIsModelBound @useIsModelBound.ts:20 | 0.06 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:222 | 0.05 | 0.0% |
| fui:components/Combobox/Combobox.vue | hasDescriptionSlot @Combobox.vue:130 | 0.05 | 0.0% |
| fui:utils/resolvePropValue.ts | resolvePropValue @resolvePropValue.ts:20 | 0.05 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:213 | 0.04 | 0.0% |
| fui:components/shared/selection/utils.ts | inputFontSizeClasses @utils.ts:61 | 0.02 | 0.0% |
| fui:utils/errorLines.ts | errorLines @errorLines.ts:23 | 0.02 | 0.0% |
| fui:components/shared/selection/utils.ts | triggerVariantClasses @utils.ts:88 | 0.02 | 0.0% |
| fui:components/Combobox/Combobox.vue | (anon) @Combobox.vue:81 | 0.01 | 0.0% |
