// es-link.css for Desk: Tailwind (frappe-ui preset) for the classes the built es-link.js uses, plus the
// components' own <style> blocks, every rule scoped to the es-* hosts (es-combobox, es-select, es-app,
// es-portal) with specificity 0 (Bootstrap markup with the same class names is untouched).
// [speed2] Scoping is written so Chrome's ancestor Bloom filter can reject it: one complex selector per
// scope tag, `:where(es-x) X`, instead of one nested `:where(a,b,c,d) { & X }` parent (a 4-argument
// :where gives the filter no hash, so every candidate element walked to the root for every rule).
// The frappe-ui preset's prose safelist (TextEditor only) and preflight's ::backdrop rule are dropped.
// env CSS_SCOPE = where (default) | tag | scope | nest (the old form), CSS_PROSE=1 keeps prose.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../package.json', import.meta.url))
const postcss = require('postcss')
const tailwind = require('tailwindcss')
const D = new URL('./dist/', import.meta.url)
const MODE = process.env.CSS_SCOPE || 'where'
const tags = ['es-combobox', 'es-select']
const SCOPES = [...tags, 'es-app', 'es-portal']
const tw = await postcss([tailwind({ config: new URL('./tailwind.config.js', import.meta.url).pathname })]).process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined })
const raw = tw.css + '\n' + fs.readFileSync(new URL('es-wc-spike.css', D), 'utf8')
// host rules as plain tag lists: a rightmost :where(list) is not bucketed, a tag is
const head = `${tags.join(',')}{display:contents}${tags.map((t) => t + ':not(:defined)').join(',')}{visibility:hidden}es-app,es-portal,es-slot{display:contents}es-slots{display:none!important}\n`
const root = postcss.parse(raw)
const GLOBAL = /^(:root|\[data-theme=dark\])$/
// sel -> selector relative to scope s ('&' for the old nested form)
const rel = (sel, s) => {
  if (/^(html|:host|body)$/.test(sel)) return s
  if (/^(html|body)\b/.test(sel)) return sel.replace(/^(html|body)/, s)
  if (sel.startsWith('[data-theme=dark] ')) return `[data-theme=dark] ${s} ${sel.slice(18)}`
  if (sel.startsWith(':root ')) return `${s} ${sel.slice(6)}`
  return `${s} ${sel}`
}
const W = MODE === 'tag' ? (t) => t : (t) => `:where(${t})`
function scope(container) {
  const wrap = MODE === 'nest' ? postcss.rule({ selector: `:where(${SCOPES.join(',')})` }) : MODE === 'scope' ? postcss.atRule({ name: 'scope', params: `(${SCOPES.join(', ')})` }) : null
  for (const node of [...container.nodes]) {
    if (node.type === 'rule') {
      if (node.selectors.every((s) => GLOBAL.test(s))) continue
      const sels = node.selectors.filter((s) => !/::backdrop/.test(s))
      if (!sels.length) { node.remove(); continue }
      if (MODE === 'nest') { node.selectors = sels.map((s) => rel(s, '&')); wrap.append(node.remove()) }
      else if (MODE === 'scope') { node.selectors = sels.map((s) => rel(s, ':scope').replace(/^:scope /, '')); wrap.append(node.remove()) }
      else node.selectors = sels.flatMap((s) => SCOPES.map((t) => rel(s, W(t))))
    } else if (node.type === 'atrule' && /^(media|supports)$/.test(node.name)) scope(node)
  }
  if (wrap && wrap.nodes && wrap.nodes.length) container.append(wrap)
}
scope(root)
fs.writeFileSync(new URL('es-link.css', D), head + root.toString())
const css = fs.readFileSync(new URL('es-link.css', D), 'utf8')
console.log('css:', MODE, (css.length / 1024).toFixed(1) + ' KB scoped,', (css.match(/\.prose/g) || []).length, '.prose,', (css.match(/::backdrop/g) || []).length, '::backdrop')
