// Independent check. Vue = reference (real SFC). petite = verbatim <template> text
// in petite-vue 0.4.1, scope = the same props. NO shims, no rewriting.
// Comparison uses LIGHT normalisation only (comments, data-v-*, whitespace) and
// raw outputs are returned so differences hidden by heavier normalisation show.
import { createApp, h, nextTick, reactive } from 'vue'
import { createApp as pCreate, reactive as pReactive, nextTick as pNext } from 'petite-vue'
import cases from './cases.json'
window.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }
const errs = []
const oe = console.error, ow = console.warn
console.error = (...a) => errs.push('E ' + a.map(String).join(' ').slice(0, 200))
console.warn = (...a) => errs.push('W ' + a.map(String).join(' ').slice(0, 200))
window.addEventListener('error', e => errs.push('window ' + e.message))
const settle = async () => { await nextTick(); await pNext(); await new Promise(r => setTimeout(r, 120)); await nextTick() }
const norm = s => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\sdata-v-[\w-]+(="[^"]*")?/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim()
const extras = () => [...document.body.children].filter(e => !['ref', 'pv'].includes(e.id) && e.tagName !== 'SCRIPT').map(e => e.outerHTML).join('')
window.runCase = async (file, props, slotHtml, steps) => {
  const c = cases[file]; const out = { file, steps: [] }
  const refEl = document.getElementById('ref'), pvEl = document.getElementById('pv')
  const comp = (await import(/* @vite-ignore */ '/@fs' + c.abs)).default
  const rp = reactive({ ...props })
  const slots = {}
  for (const [k, v] of Object.entries(slotHtml || {})) slots[k] = () => h('b', { class: 'slot-' + k }, v)
  errs.length = 0
  const app = createApp({ render: () => h(comp, { ...rp }, slots) }); app.config.errorHandler = e => errs.push('VueErr ' + e.message)
  app.mount(refEl)
  await settle(); const refErr0 = errs.splice(0)
  let scope
  pvEl.innerHTML = c.template
  try { scope = pReactive({ ...props }); pCreate(scope).mount(pvEl) } catch (e) { errs.push('mount-throw ' + e.message) }
  await settle(); const pvErr0 = errs.splice(0)
  const snap = (label) => { const a = norm(refEl.innerHTML), b = norm(pvEl.innerHTML), t = norm(extras()); out.steps.push({ label, same: a === b, ref: a.slice(0, 700), refTeleported: t.slice(0, 300), pv: b.slice(0, 700) }) }
  snap('initial'); out.refErr = refErr0; out.pvErr = pvErr0
  for (const s of steps || []) {
    if (s.set) { Object.assign(rp, s.set); if (scope) Object.assign(scope, s.set) }
    if (s.click) { refEl.querySelector(s.click)?.click(); pvEl.querySelector(s.click)?.click() }
    await settle(); snap(JSON.stringify(s)); out.steps.at(-1).errs = errs.splice(0)
  }
  app.unmount(); return out
}
window.ready = true
