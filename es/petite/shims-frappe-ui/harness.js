// Browser side of the differential harness. For one component file:
//   1. reference: mount the SFC, compiled by @vitejs/plugin-vue, with real Vue 3.5
//      and only generically generated required props;
//   2. petite: put the SFC's <template> text, verbatim, into a container and mount
//      it with petite-vue 0.4.1 in a scope holding only the same resolved props;
//   3. serialise both with the same normalisation, capture errors/warnings;
//   4. if identical, apply one prop change and one click to both and compare again.
// Nothing from the component's <script> is carried to the petite side.
import * as VueNS from 'vue'
import { createApp as vueCreateApp, h, nextTick, reactive, toRaw, markRaw } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createApp as petiteCreateApp, reactive as pReactive, nextTick as pNextTick } from 'petite-vue'
import lucideTags from 'virtual:lucide-tags'

const realFetch = window.fetch.bind(window)
let ROWS = null
async function rows() { return (ROWS ||= await (await realFetch('/analysis.json')).json()) }

// ---------- generic environment stubs (reference side; no per-component code) ----------
window.fetch = async () => new Response(JSON.stringify({ message: null }), { status: 200, headers: { 'content-type': 'application/json' } })
const deep = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === 'toString' ? () => '' : deep, apply: () => deep, construct: () => deep })
window.frappe = deep
window.__ = (s) => s
window.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} }

// ---------- capture ----------
let sink = null
const origErr = console.error.bind(console), origWarn = console.warn.bind(console)
const fmt = a => a.map(x => (x instanceof Error ? `${x.name}: ${x.message}` : typeof x === 'string' ? x : (() => { try { return String(x) } catch { return '?' } })())).join(' ').slice(0, 400)
console.error = (...a) => { sink?.errors.push(fmt(a)); }
console.warn = (...a) => { sink?.warnings.push(fmt(a)); }
window.addEventListener('error', e => sink?.errors.push('window.error: ' + (e.error ? `${e.error.name}: ${e.error.message}` : e.message)))
window.addEventListener('unhandledrejection', e => sink?.errors.push('unhandledrejection: ' + (e.reason?.message || String(e.reason)).slice(0, 300)))
const settle = async () => { await nextTick(); await new Promise(r => setTimeout(r, 60)); await nextTick(); await pNextTick(); await new Promise(r => setTimeout(r, 20)) }

// ---------- normalisation ----------
const DROP = new Set(['id', 'for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-owns', 'aria-activedescendant', 'aria-details', 'aria-errormessage', 'headers'])
const GEN = /\b(v|reka|radix|fui|frappe|ui|headlessui|input|field)[-:][\w:-]*?\d+[\w:-]*/g
function ser(node) {
  if (node.nodeType === 3) { const t = node.data.replace(/\s+/g, ' ').trim(); return t ? t.replace(/</g, '&lt;') : '' }
  if (node.nodeType === 11) return [...node.childNodes].map(ser).join('')
  if (node.nodeType !== 1) return ''
  const tag = node.tagName.toLowerCase()
  const attrs = [...node.attributes].filter(a => !a.name.startsWith('data-v-') && !DROP.has(a.name)).map(a => {
    let v = a.value
    if (a.name === 'class') v = v.split(/\s+/).filter(Boolean).sort().join(' ')
    if (a.name === 'style') v = v.split(';').map(x => x.trim().replace(/\s*:\s*/, ': ')).filter(Boolean).sort().join('; ')
    return [a.name, v.replace(GEN, '#gen')]
  }).filter(([n, v]) => !((n === 'class' || n === 'style') && v === '')).sort((a, b) => a[0] < b[0] ? -1 : 1)
  const kids = tag === 'template' && node.content ? node.content : node
  return `<${tag}${attrs.map(([n, v]) => ` ${n}="${v}"`).join('')}>${[...kids.childNodes].map(ser).join('')}</${tag}>`
}
function snapshot(el) { const c = el.cloneNode(true); c.normalize(); return [...c.childNodes].map(ser).join('') }

// ---------- fixtures from the component's own runtime prop declarations ----------
const first = t => (Array.isArray(t) ? t[0] : t)
function valueFor(t) {
  switch (t) {
    case String: return 'Sample'
    case Number: return 1
    case Boolean: return true
    case Array: return []
    case Object: return {}
    case Function: return () => {}
    case Date: return new Date(0)
    default: return t == null ? null : undefined
  }
}
function propDefs(comp) {
  const p = comp.props
  if (!p) return {}
  if (Array.isArray(p)) return Object.fromEntries(p.map(k => [k, {}]))
  return Object.fromEntries(Object.entries(p).map(([k, d]) => [k, (typeof d === 'function' || Array.isArray(d) || d == null) ? { type: d } : d]))
}
function fixture(defs) {
  const out = {}
  for (const [k, d] of Object.entries(defs)) if (d.required) out[k] = valueFor(first(d.type))
  return out
}
const typeName = t => Array.isArray(t) ? t.map(typeName).join('|') : t?.name || String(t)

function iconComp(kebab) {
  return markRaw({ name: 'Lucide-' + kebab, render: () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, innerHTML: lucideTags[kebab] || '' }) })
}
function kebabOf(name) { return name.replace(/^Lucide/, '').replace(/^lucide-/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])(\d)/g, '$1-$2').toLowerCase() }

function bodyExtras() { return [...document.body.children].filter(e => e.id !== 'ref' && e.id !== 'pv' && e.tagName !== 'SCRIPT') }

window.runOne = async function runOne(idx) {
  const row = (await rows())[idx]
  const res = { idx, file: row.file, ref: { errors: [], warnings: [] }, pv: { errors: [], warnings: [] } }
  const refEl = document.getElementById('ref'), pvEl = document.getElementById('pv')

  // ---------- 1. reference ----------
  window.__phase = 'ref'
  let comp = null, inst = null, app = null, propsState = null, defs = {}
  sink = res.ref
  try {
    const mod = await import(/* @vite-ignore */ '/@fs' + row.abs)
    comp = mod.default
    defs = propDefs(comp)
    res.propDefs = Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, { type: typeName(d.type), required: !!d.required }]))
    res.fixture = fixture(defs)
    propsState = reactive({ ...res.fixture })
    const before = new Set(bodyExtras())
    app = vueCreateApp({ render: () => h(comp, { ...propsState }) })
    app.config.errorHandler = (e, _i, info) => res.ref.errors.push(`[vue ${info}] ${e?.name}: ${e?.message}`.slice(0, 400))
    app.config.warnHandler = (m) => res.ref.warnings.push(String(m).slice(0, 300))
    app._context.components = new Proxy({}, { get: (t, k) => (typeof k === 'string' && /^Lucide|^lucide-/.test(k) && !(k in t)) ? (t[k] = iconComp(kebabOf(k))) : t[k] })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', name: 'any', component: { render: () => null } }] })
    app.use(router)
    const root = app.mount(refEl)
    await settle()
    inst = root.$.subTree?.component || null
    res.ref.html = snapshot(refEl)
    res.ref.teleported = bodyExtras().filter(e => !before.has(e)).length
    res.ref.mounted = true
  } catch (e) {
    res.ref.mounted = false
    res.ref.errors.push(`mount: ${e?.name}: ${e?.message}`.slice(0, 400))
    res.ref.html = snapshot(refEl)
  }

  // props the template sees under Vue: declared props with defaults resolved
  const snap = {}
  if (inst?.props) for (const [k, v] of Object.entries(toRaw(inst.props))) snap[k] = toRaw(v)
  else Object.assign(snap, res.fixture || {})
  res.scopeKeys = Object.keys(snap)

  // ---------- 2. petite-vue on the verbatim template ----------
  window.__phase = 'petite'
  sink = res.pv
  let scope = null
  if (row.template == null || row.templateLang !== 'html') {
    res.pv.skipped = row.template == null ? 'no <template> block' : 'template lang=' + row.templateLang
  } else {
    try {
      // generic shims, identical for every component (selected by ?shims=a,b,c)
      const sctx = { row, comp, snap, inst, vue: VueNS, petite: { reactive: pReactive, nextTick: pNextTick } }
      let tpl = row.template
      for (const s of SHIMS) if (s.text) tpl = s.text(tpl, sctx)
      pvEl.innerHTML = tpl
      for (const s of SHIMS) if (s.dom) s.dom(pvEl, sctx)
      scope = pReactive({ ...snap })
      for (const s of SHIMS) if (s.scope) await s.scope(scope, sctx)
      const papp = petiteCreateApp(scope)
      for (const s of SHIMS) if (s.app) s.app(papp, sctx)
      papp.mount(pvEl)
      await settle()
      res.pv.mounted = true
    } catch (e) {
      res.pv.mounted = false
      res.pv.errors.push(`mount: ${e?.name}: ${e?.message}`.slice(0, 400))
    }
    res.pv.html = snapshot(pvEl)
  }
  res.identical = !!(res.ref.mounted && res.pv.mounted && res.ref.html === res.pv.html)
  res.ref.len = (res.ref.html || '').length; res.pv.len = (res.pv.html || '').length
  if (res.pv.html != null && !res.identical) {
    const A = res.ref.html || '', B = res.pv.html
    let i = 0; while (i < A.length && i < B.length && A[i] === B[i]) i++
    res.diffAt = i
    res.diffCtx = { ref: A.slice(Math.max(0, i - 60), i + 140), pv: B.slice(Math.max(0, i - 60), i + 140) }
  }
  if (res.pv.html != null) {
    const unk = {}
    for (const el of pvEl.querySelectorAll('*')) if (el instanceof HTMLUnknownElement || el.tagName.includes('-')) { const t = el.tagName.toLowerCase(); unk[t] = (unk[t] || 0) + 1 }
    res.pv.unknownTags = unk
  }

  // ---------- 3. one prop change + one click, only when first render matched ----------
  if (res.identical) {
    window.__phase = 'interaction'
    res.interaction = {}
    const used = Object.keys(defs).filter(k => new RegExp(`\\b${k}\\b`).test(row.template))
    const prim = k => [String, Boolean, Number].includes(first(defs[k].type))
    const comp_ = k => [Object, Array].includes(first(defs[k].type))
    const pick = used.find(prim) || used.find(comp_) || Object.keys(defs).find(prim)
    if (pick) {
      const t = first(defs[pick].type), cur = snap[pick]
      const rich = { label: 'Changed', name: 'changed', title: 'Changed', value: 'changed', description: 'Changed' }
      const mk = () => t === String ? 'Changed value' : t === Boolean ? !cur : t === Number ? (Number(cur) || 0) + 2 : t === Array ? [{ ...rich }] : { ...rich }
      sink = res.ref; propsState[pick] = mk()
      sink = res.pv; { const v = mk(); scope[pick] = v; for (const s of SHIMS) s.setProp?.(pick, v) }
      await settle()
      const a = snapshot(refEl), b = snapshot(pvEl)
      res.interaction.propChange = { prop: pick, to: JSON.stringify(mk()), identical: a === b, ref: a.slice(0, 600), pv: b.slice(0, 600) }
    } else res.interaction.propChange = { skipped: 'no declared props' }
    const SEL = 'button, [role=button], input, a, [tabindex], select, textarea, [role=checkbox], [role=switch], label'
    const ra = [...refEl.querySelectorAll(SEL)], pa = [...pvEl.querySelectorAll(SEL)]
    if (ra.length && pa.length) {
      sink = res.ref; try { ra[0].click() } catch (e) { res.ref.errors.push('click: ' + e.message) }
      sink = res.pv; try { pa[0].click() } catch (e) { res.pv.errors.push('click: ' + e.message) }
      await settle()
      const a = snapshot(refEl), b = snapshot(pvEl)
      res.interaction.click = { target: ra[0].tagName.toLowerCase(), identical: a === b, ref: a.slice(0, 600), pv: b.slice(0, 600) }
    } else res.interaction.click = { skipped: 'no clickable element' }
  }
  sink = null
  try { app?.unmount() } catch {}
  res.ref.html = (res.ref.html || '').slice(0, 4000)
  if (res.pv.html) res.pv.html = res.pv.html.slice(0, 4000)
  return res
}
const SHIM_NAMES = (new URLSearchParams(location.search).get('shims') || '').split(',').filter(Boolean)
const SHIMS = []
for (const n of SHIM_NAMES) SHIMS.push((await import(/* @vite-ignore */ `/shims/${n}.js`)).default)
window.shimNames = SHIM_NAMES
window.harnessReady = true
