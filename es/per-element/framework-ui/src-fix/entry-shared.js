// Variant: petite-vue compiled from source against the bundle's own Vue
// reactivity (@vue/reactivity -> vue), so a petite reactive object IS a Vue
// reactive object: nested mutations on either side are tracked by both.
import '../src/entry.js'
import { createApp, reactive, nextTick } from '../vendor/petite-vue/src/index.ts'
window.PetiteVue = { createApp, reactive, nextTick }
