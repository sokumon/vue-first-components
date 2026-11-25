// Shim "setup": run the component's own <script>/<script setup> and expose its state
// to the petite scope. That code calls defineProps/useAttrs/inject/computed/watch/
// onMounted, which need a live Vue component instance and Vue's reactivity, so the
// shim mounts a hidden Vue instance of the same component with a null render and
// mirrors every setupState/data/computed/method key into petite's scope via Vue
// effects. It is Vue running the component, with petite only painting the template.
let vueProps, hidden
export default {
  async scope(scope, { comp, snap, vue }) {
    const { createApp, h, reactive, watchEffect, nextTick } = vue
    if (!comp) return
    hidden?.unmount()
    vueProps = reactive({ ...snap })
    hidden = createApp({ render: () => h({ ...comp, render: () => null }, { ...vueProps }) })
    hidden.config.errorHandler = e => console.error(e)
    const root = hidden.mount(document.createElement('div'))
    await nextTick()
    const inst = root.$.subTree.component
    if (!inst) return
    const keys = new Set([...Object.keys(inst.setupState || {}), ...Object.keys(inst.data || {}),
      ...Object.keys(comp.computed || {}), ...Object.keys(comp.methods || {})])
    for (const k of keys) if (!(k in snap) && !k.startsWith('__'))
      watchEffect(() => { scope[k] = k in inst.setupState ? inst.setupState[k] : inst.proxy[k] })
  },
  setProp(k, v) { if (vueProps) vueProps[k] = v },
}
