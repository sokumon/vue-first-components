// Vite dev server for the REFERENCE side only: real Vue 3.5 compiling each SFC
// exactly as written. The plugins here are environment plumbing (module
// resolution, generic stubs for packages that are not installed, ~icons) and
// never touch component source.
import fs from 'node:fs'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'

const ROOT = '/home/claude/vue-first-components'
const HERE = path.join(ROOT, 'wc/petite-all')
const FUI = path.join(ROOT, 'frappe-ui')
const FWUI = path.join(ROOT, 'frappe/ui')
const HOST = path.join(HERE, 'index.html')
const rows = JSON.parse(fs.readFileSync(path.join(HERE, 'analysis.json'), 'utf8'))

// Packages @framework/ui depends on that are not installed anywhere here.
const STUBBED = new Set()
const MISSING = ['vuedraggable', 'leaflet', 'leaflet-draw', '@vue-flow/core', '@vue-flow/background', 'cropperjs', 'msw']
function srcFiles(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules') srcFiles(p, out) }
    else if (/\.(vue|ts|js)$/.test(e.name)) out.push(p)
  }
  return out
}
const ALL_SRC = [...srcFiles(path.join(FUI, 'src')), ...srcFiles(path.join(FWUI, 'src'))]
function namedImportsOf(pkg) {
  const names = new Set()
  const esc = pkg.replace(/[/.]/g, m => '\\' + m)
  const re = new RegExp(`import\\s+(?:(\\w+)\\s*,?\\s*)?(?:\\{([^}]*)\\})?\\s*from\\s*['"]${esc}(?:/[^'"]*)?['"]`, 'g')
  for (const f of ALL_SRC) {
    const s = fs.readFileSync(f, 'utf8')
    for (const m of s.matchAll(re)) (m[2] || '').split(',').map(x => x.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean).forEach(n => names.add(n))
  }
  return [...names]
}

// Type-only imports in defineProps<...>() are resolved by compiler-sfc through the
// filesystem from the clone's location, where no node_modules exist: redirect any
// <somewhere>/node_modules/<pkg> lookup to the host's wc/node_modules.
const NM = path.join(ROOT, 'wc/node_modules')
const mapNM = f => { const i = f.lastIndexOf('/node_modules/'); if (i < 0 || f.startsWith(NM + '/')) return f; return path.join(NM, f.slice(i + 14)) }
export const sfcFs = {
  fileExists: f => fs.existsSync(f) || fs.existsSync(mapNM(f)),
  readFile: f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : fs.existsSync(mapNM(f)) ? fs.readFileSync(mapNM(f), 'utf8') : undefined,
  realpath: f => { try { return fs.realpathSync(fs.existsSync(f) ? f : mapNM(f)) } catch { return f } },
}

function exportsTarget(pkgDir, sub) {
  const pj = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'))
  const key = sub ? './' + sub : '.'
  let e = pj.exports?.[key]
  if (!e && pj.exports?.['./*'] && sub) e = { import: pj.exports['./*'].import.replace('*', sub) }
  if (!e) return null
  const t = typeof e === 'string' ? e : (e.import || e.default)
  return t ? path.join(pkgDir, t) : null
}

function harnessResolve() {
  return {
    name: 'petite-all-resolve',
    enforce: 'pre',
    async resolveId(source, importer, opts) {
      if (source.startsWith('\0')) return null
      // stubbed (not installed) packages
      const miss = MISSING.find(m => source === m || source.startsWith(m + '/'))
      if (miss) return '\0stub:' + source
      if (source.startsWith('~icons/')) return '\0icon:' + source.slice(7)
      if (source === 'virtual:lucide-tags') return '\0lucide-tags'
      let m
      if ((m = source.match(/^frappe-ui(?:\/(.+))?$/))) { const t = exportsTarget(FUI, m[1]); if (t) return t }
      if ((m = source.match(/^@framework\/ui(?:\/(.+))?$/))) { const t = exportsTarget(FWUI, m[1]); if (t) return t }
      // bare specifiers from the clones: resolve as if imported by the host (wc/node_modules)
      if (importer && /^[\w@]/.test(source) && !importer.startsWith(HERE) && (importer.startsWith(FUI) || importer.startsWith(FWUI))) {
        const r = await this.resolve(source, HOST, { ...opts, skipSelf: true })
        if (r) return r
        if (!/^(vue|node:)/.test(source)) { STUBBED.add(source); return '\0stub:' + source }
      }
      return null
    },
    load(id) {
      // <style> blocks do not affect the serialised DOM; skip them (CSS @import
      // resolution does not see plugin resolvers, and the clones have no node_modules)
      if (/[?&]vue&type=style/.test(id) || (/\.css($|\?)/.test(id) && !id.startsWith('\0'))) return ''
      if (id === '\0lucide-tags') {
        const map = {}
        for (const r of rows) for (const m of (r.template || '').matchAll(/<(Lucide[A-Za-z0-9]+|lucide-[a-z0-9-]+)/g)) {
          const kebab = m[1].replace(/^Lucide/, '').replace(/^lucide-/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])(\d)/g, '$1-$2').toLowerCase()
          let svg = ''
          try { svg = fs.readFileSync(path.join(HERE, '../node_modules/lucide-static/icons', kebab + '.svg'), 'utf8') } catch {}
          map[kebab] = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
        }
        return 'export default ' + JSON.stringify(map)
      }
      if (id.startsWith('\0stub:')) {
        const spec = id.slice(6)
        if (/\?url$|\.(png|svg|css)/.test(spec)) return 'export default ""'
        const pkg = MISSING.find(m => spec === m || spec.startsWith(m + '/')) || spec
        const names = namedImportsOf(pkg)
        return `const P=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?()=>'':k==='then'?undefined:P,apply:()=>P,construct:()=>P});
export default P;${names.map(n => `export const ${n}=P;`).join('')}`
      }
      if (id.startsWith('\0icon:')) {
        const [, coll, name] = id.slice(6).match(/^([^/]+)\/(.+)$/) || []
        let svg = '<svg/>'
        try { svg = fs.readFileSync(path.join(HERE, '../node_modules/lucide-static/icons', name + '.svg'), 'utf8') } catch {}
        const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
        return `import {h} from 'vue';export default {name:${JSON.stringify('icon-' + name)},render(){return h('svg',{xmlns:'http://www.w3.org/2000/svg',width:'1em',height:'1em',viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round',innerHTML:${JSON.stringify(body)}})}}`
      }
    },
  }
}

export default {
  root: HERE,
  logLevel: 'warn',
  plugins: [harnessResolve(), vue({ script: { fs: sfcFs } })],
  resolve: { dedupe: ['vue', 'vue-router', 'reka-ui'] },
  css: { postcss: { plugins: [] } },
  define: { 'process.env': '{}' },
  server: { port: 5291, strictPort: true, host: '127.0.0.1', fs: { strict: false, allow: [ROOT] }, hmr: false },
  optimizeDeps: {
    entries: ['index.html', ...rows.map(r => r.abs)],
    include: ['vue', 'vue-router', 'petite-vue', 'reka-ui', 'dayjs/esm', '@vueuse/core'],
    holdUntilCrawlEnd: true,
  },
}
