// Browser side of the differential harness. For one component file:
//   1. reference: mount the SFC, compiled by @vitejs/plugin-vue, with real Vue 3.5
//      and only generically generated required props;
//   2. petite: put the SFC's <template> text, verbatim, into a container and mount
//      it with petite-vue 0.4.1 in a scope holding only the same resolved props;
//   3. serialise both with the same normalisation, capture errors/warnings;
//   4. if identical, apply one prop change and one click to both and compare again.
// Nothing from the component's <script> is carried to the petite side.
import { createApp as vueCreateApp, h, nextTick, reactive, toRaw, markRaw } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createApp as petiteCreateApp, reactive as pReactive, nextTick as pNextTick } from 'petite-vue'
import lucideTags from 'virtual:lucide-tags'
import { normaliseTemplate } from './shims/s1-template-text.js'
import { instanceGlobals } from './shims/s2-instance-globals.js'
import { rewriteBuiltins, teleportDirective } from './shims/s3-builtins.js'
import { lenientScope } from './shims/s4-lenient-scope.js'

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
  const kids = tag === 'template' ? node.content : node
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

function bodyExtras() { return [...document.body.children].filter(e => e.id !== 'ref' && !e.id.startsWith('pv') && e.tagName !== 'SCRIPT') }


// Cumulative shim levels. Every level is applied identically to every component.
const LEVELS = [
  { name: 'L0-none', text: t => t, scope: s => s, dirs: {} },
  { name: 'L1-template-text', text: normaliseTemplate, scope: s => s, dirs: {} },
  { name: 'L2-instance-globals', text: normaliseTemplate, scope: s => ({ ...instanceGlobals(s), ...s }), dirs: {} },
  { name: 'L3-builtins', text: t => rewriteBuiltins(normaliseTemplate(t)), scope: s => ({ ...instanceGlobals(s), ...s }), dirs: { teleport: teleportDirective } },
  { name: 'L4-lenient-scope', text: t => rewriteBuiltins(normaliseTemplate(t)), scope: s => lenientScope({ ...instanceGlobals(s), ...s }), dirs: { teleport: teleportDirective } },
]
window.LEVELS = LEVELS.map(l => l.name)

window.runOne = async function runOne(idx) {
  const row = (await rows())[idx]
  const res = { idx, file: row.file, ref: { errors: [], warnings: [] }, levels: {} }
  const refEl = document.getElementById('ref')
  window.__phase = 'ref'
  let comp = null, inst = null, app = null, propsState = null, defs = {}
  sink = res.ref
  try {
    const mod = await import(/* @vite-ignore */ '/@fs' + row.abs)
    comp = mod.default
    defs = propDefs(comp)
    res.fixture = fixture(defs)
    propsState = reactive({ ...res.fixture })
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
    res.ref.mounted = true
  } catch (e) {
    res.ref.mounted = false
    res.ref.errors.push(`mount: ${e?.name}: ${e?.message}`.slice(0, 400))
    res.ref.html = snapshot(refEl)
  }
  const snap = {}
  if (inst?.props) for (const [k, v] of Object.entries(toRaw(inst.props))) snap[k] = toRaw(v)
  else Object.assign(snap, res.fixture || {})

  const scopes = {}, els = {}
  if (row.template == null || row.templateLang !== 'html') { res.skipped = 'no template'; return res }
  for (const L of LEVELS) {
    window.__phase = L.name
    const out = res.levels[L.name] = { errors: [], warnings: [] }
    sink = out
    const el = els[L.name] = document.createElement('div'); el.id = 'pv-' + L.name; document.body.appendChild(el)
    try {
      out.text = L.text(row.template)
      el.innerHTML = out.text
      const scope = scopes[L.name] = pReactive(L.scope({ ...snap }))
      const pa = petiteCreateApp(scope)
      for (const [k, d] of Object.entries(L.dirs)) pa.directive(k, d)
      pa.mount(el)
      await settle()
      out.mounted = true
    } catch (e) { out.mounted = false; out.errors.push(`mount: ${e?.name}: ${e?.message}`.slice(0, 400)) }
    out.html = snapshot(el)
    out.identical = !!(res.ref.mounted && out.mounted && res.ref.html === out.html)
    if (!out.identical) {
      const A = res.ref.html || '', B = out.html; let i = 0; while (i < A.length && i < B.length && A[i] === B[i]) i++
      out.diffCtx = { at: i, ref: A.slice(Math.max(0, i - 60), i + 140), pv: B.slice(Math.max(0, i - 60), i + 140) }
    }
  }
  sink = null
  const same = Object.keys(res.levels).filter(k => res.levels[k].identical)
  if (same.length) {
    window.__phase = 'interaction'
    const used = Object.keys(defs).filter(k => new RegExp(`\\b${k}\\b`).test(row.template))
    const prim = k => [String, Boolean, Number].includes(first(defs[k].type))
    const comp_ = k => [Object, Array].includes(first(defs[k].type))
    const pick = used.find(prim) || used.find(comp_) || Object.keys(defs).find(prim)
    if (pick) {
      const t = first(defs[pick].type), cur = snap[pick]
      const rich = { label: 'Changed', name: 'changed', title: 'Changed', value: 'changed', description: 'Changed' }
      const mk = () => t === String ? 'Changed value' : t === Boolean ? !cur : t === Number ? (Number(cur) || 0) + 2 : t === Array ? [{ ...rich }] : { ...rich }
      sink = res.ref; propsState[pick] = mk()
      for (const k of same) { sink = res.levels[k]; scopes[k][pick] = mk() }
      await settle()
      const a = snapshot(refEl)
      for (const k of same) res.levels[k].propChange = { prop: pick, identical: a === snapshot(els[k]) }
    }
    const SEL = 'button, [role=button], input, a, [tabindex], select, textarea, [role=checkbox], [role=switch], label'
    const ra = [...refEl.querySelectorAll(SEL)]
    if (ra.length) {
      sink = res.ref; try { ra[0].click() } catch (e) {}
      for (const k of same) { const pa = [...els[k].querySelectorAll(SEL)]; sink = res.levels[k]; if (pa.length) try { pa[0].click() } catch (e) { res.levels[k].errors.push('click: ' + e.message) } }
      await settle()
      const a = snapshot(refEl)
      for (const k of same) res.levels[k].click = { identical: a === snapshot(els[k]) }
    }
  }
  sink = null
  try { app?.unmount() } catch {}
  res.ref.len = (res.ref.html || '').length
  res.ref.html = (res.ref.html || '').slice(0, 3000)
  for (const o of Object.values(res.levels)) { o.html = (o.html || '').slice(0, 3000); delete o.text }
  return res
}
window.harnessReady = true
