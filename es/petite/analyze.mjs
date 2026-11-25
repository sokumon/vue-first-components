// Static pass over every non-story, non-test component .vue in frappe-ui/src and
// frappe/ui/src. Reads each SFC (never modifies it), extracts the <template>
// verbatim and records template/script features petite-vue 0.4.1 cannot run.
// Output: analysis.json (consumed by the browser harness and classify.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const sfc = require('@vue/compiler-sfc')
const { isHTMLTag, isSVGTag, isMathMLTag, isVoidTag } = require('@vue/shared')
try { sfc.registerTS(() => require('typescript')) } catch {}

const ROOT = '/home/claude/vue-first-components'
const HERE = path.join(ROOT, 'wc/petite-all')
const TREES = [
  { pkg: 'frappe-ui', dir: path.join(ROOT, 'frappe-ui/src') },
  { pkg: 'framework-ui', dir: path.join(ROOT, 'frappe/ui/src') },
]
const EXCLUDE = /(\/stories?\/|\.stor(y|ies)\.|\/tests?\/|\/__tests__\/|\.test\.|\.spec\.|\.cy\.)/i

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.vue')) out.push(p)
  }
  return out
}

const NM = path.join(ROOT, 'wc/node_modules')
const mapNM = f => { const i = f.lastIndexOf('/node_modules/'); if (i < 0 || f.startsWith(NM + '/')) return f; return path.join(NM, f.slice(i + 14)) }
const sfcFs = {
  fileExists: f => fs.existsSync(f) || fs.existsSync(mapNM(f)),
  readFile: f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : fs.existsSync(mapNM(f)) ? fs.readFileSync(mapNM(f), 'utf8') : undefined,
  realpath: f => { try { return fs.realpathSync(fs.existsSync(f) ? f : mapNM(f)) } catch { return f } },
}
const BUILTINS = new Set(['Teleport', 'teleport', 'Transition', 'transition', 'TransitionGroup',
  'transition-group', 'KeepAlive', 'keep-alive', 'Suspense', 'suspense', 'component', 'slot'])

function analyse(abs, pkg) {
  const src = fs.readFileSync(abs, 'utf8')
  const rel = path.relative(ROOT, abs)
  const row = { file: rel, abs, pkg, kind: /\.playground\.vue$/.test(abs) ? 'playground' : 'component' }
  const { descriptor, errors } = sfc.parse(src, { filename: abs })
  if (errors.length) row.parseErrors = errors.map(e => String(e.message || e))
  const scriptText = (descriptor.script?.content || '') + '\n' + (descriptor.scriptSetup?.content || '')
  row.hasScript = !!descriptor.script; row.hasScriptSetup = !!descriptor.scriptSetup
  if (!descriptor.template) { row.template = null; row.templateLang = null }
  else { row.template = descriptor.template.content; row.templateLang = descriptor.template.lang || 'html' }

  // ---- script features (static) ----
  const s = {}
  s.rekaImports = [...scriptText.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]reka-ui['"]/g)]
    .flatMap(m => m[1].split(',').map(x => x.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean))
  s.importsReka = /from\s*['"]reka-ui['"]/.test(scriptText)
  s.provideInject = /\b(provide|inject)\s*\(|\binject[A-Z]\w*Context\b|\bprovide[A-Z]\w*Context\b|createContext\(/.test(scriptText)
  s.emits = /defineEmits|emit\(|\$emit/.test(scriptText)
  s.slotsApi = /defineSlots|useSlots|\bslots\b\s*[.:[]/.test(scriptText)
  s.attrsApi = /useAttrs|inheritAttrs/.test(scriptText)
  s.renderFn = /\brender\s*\(|\breturn\s*\(\)\s*=>\s*h\(|\bh\(/.test(scriptText) && !descriptor.template
  s.defineModel = /defineModel/.test(scriptText)
  s.computedWatch = /\b(computed|watch|watchEffect)\s*\(/.test(scriptText)
  s.lifecycle = /\bon(Mounted|BeforeMount|Unmounted|BeforeUnmount|Updated)\s*\(/.test(scriptText)
  s.templateRefs = /useTemplateRef|\bref\s*<\s*HTML|\$refs/.test(scriptText)
  s.resourceCalls = /createResource|createListResource|createDocumentResource|\bcall\(|useCall|useList|useDoc|frappeRequest|fetch\(/.test(scriptText)
  s.router = /useRouter|useRoute|RouterLink|router-link/.test(scriptText)
  s.childImports = [...scriptText.matchAll(/import\s+(\w+)\s+from\s*['"][^'"]+\.vue['"]/g)].map(m => m[1])
  row.script = s

  // ---- template features (AST) ----
  const t = { componentTags: {}, builtins: {}, slotOutlets: 0, vSlot: 0, vModelOnComponent: 0,
    selfClosingNonVoid: 0, objectBind: 0, objectOn: 0, camelCaseBindOnElement: 0, dynamicComponent: 0,
    vMemo: 0, vOnce: 0, magic: {}, camelCaseTagsUppercase: 0, eventModifiersUnsupported: 0, templateWrappers: 0 }
  if (descriptor.template?.ast) {
    const visit = (n) => {
      if (n.type === 1) {
        const tag = n.tag
        const isNative = isHTMLTag(tag) || isSVGTag(tag) || isMathMLTag(tag)
        if (tag === 'slot') t.slotOutlets++
        else if (tag === 'template') t.templateWrappers++
        else if (BUILTINS.has(tag)) { t.builtins[tag] = (t.builtins[tag] || 0) + 1; if (tag === 'component') t.dynamicComponent++ }
        else if (!isNative || n.tagType === 1) t.componentTags[tag] = (t.componentTags[tag] || 0) + 1
        if (n.isSelfClosing && !isVoidTag(tag) && !isSVGTag(tag) && !isMathMLTag(tag)) t.selfClosingNonVoid++
        if (/[A-Z]/.test(tag)) t.camelCaseTagsUppercase++
        for (const p of n.props) {
          if (p.type !== 7) continue
          if (p.name === 'slot') t.vSlot++
          if (p.name === 'model' && (n.tagType === 1 || !isNative)) t.vModelOnComponent++
          if (p.name === 'bind' && !p.arg) t.objectBind++
          if (p.name === 'on' && !p.arg) t.objectOn++
          if (p.name === 'bind' && p.arg?.content && /[A-Z]/.test(p.arg.content)) t.camelCaseBindOnElement++
          if (p.name === 'memo') t.vMemo++
          if (p.name === 'once') t.vOnce++
          if (p.name === 'on' && p.modifiers?.some(m => ['capture', 'passive', 'exact', 'middle'].includes(m.content ?? m))) t.eventModifiersUnsupported++
        }
      }
      ;(n.children || []).forEach(visit)
      if (n.branches) n.branches.forEach(visit)
    }
    descriptor.template.ast.children.forEach(visit)
    for (const m of ['$slots', '$attrs', '$emit', '$props', '$el', '$parent', '$refs', '$event', '$route', '$router', '$t', '$resources', '$dialog', '$socket'])
      { const c = row.template.split(m).length - 1; if (c && !(m === '$refs' && false)) t.magic[m] = c }
  }
  row.tpl = t

  // ---- bindings: what the template reads from <script> state ----
  if (row.template && row.templateLang === 'html') {
    let bindings = null, bindErr = null
    try {
      const r = sfc.compileScript(descriptor, { id: 'x', fs: sfcFs })
      bindings = r.bindings || null
    } catch (e) { bindErr = String(e.message || e).split('\n')[0] }
    let code = ''
    try {
      code = sfc.compileTemplate({ source: row.template, filename: abs, id: 'x',
        compilerOptions: { bindingMetadata: bindings || undefined, prefixIdentifiers: true, mode: 'module' } }).code
    } catch (e) { row.templateCompileError = String(e.message || e) }
    const grab = re => [...new Set([...code.matchAll(re)].map(m => m[1]))]
    const setupRefs = grab(/\$setup(?:\.(\w+)|\["([^"]+)"\])/g).filter(Boolean)
    const ctxRefs = grab(/_ctx\.([\w$]+)/g)
    const propRefs = grab(/\$props\.(\w+)/g)
    const dataRefs = grab(/\$data\.(\w+)/g)
    const optRefs = grab(/\$options\.(\w+)/g)
    row.bindings = { ok: !!bindings, bindErr, map: bindings,
      setupRefs, ctxRefs, propRefs, dataRefs, optRefs }
  }
  return row
}

const rows = []
for (const { pkg, dir } of TREES) {
  for (const f of walk(dir).sort()) {
    if (EXCLUDE.test(path.relative(dir, f).replace(/^/, '/'))) continue
    try { rows.push(analyse(f, pkg)) }
    catch (e) { rows.push({ file: path.relative(ROOT, f), abs: f, pkg, analyseError: String(e.stack || e) }) }
  }
}
rows.forEach((r, i) => (r.idx = i))
fs.mkdirSync(path.join(HERE, 'public'), { recursive: true })
fs.writeFileSync(path.join(HERE, 'public/analysis.json'), JSON.stringify(rows))
fs.writeFileSync(path.join(HERE, 'analysis.json'), JSON.stringify(rows, null, 1))
console.log('files', rows.length, 'frappe-ui', rows.filter(r => r.pkg === 'frappe-ui').length,
  'framework-ui', rows.filter(r => r.pkg === 'framework-ui').length,
  'noTemplate', rows.filter(r => !r.template).length, 'bindingsFail', rows.filter(r => r.bindings && !r.bindings.ok).length,
  'analyseErr', rows.filter(r => r.analyseError).length)
