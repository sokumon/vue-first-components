// Derives the two shipped sheets from Tailwind's output (dist/es-ui.raw.css)
// and the registered tag list (dist/tags.json):
//   dist/es-ui.css         global Tailwind (preflight included) for pages with no CSS of their own
//   dist/es-ui.scoped.css  for Desk (Bootstrap): every rule nested under :where(<es-* hosts>, es-app, es-portal),
//                          html/body preflight rules land on the scope roots, :root variables stay global.
// Both start with the host rules: hosts are display:contents, hidden until defined.
import fs from 'node:fs'
import postcss from '../../node_modules/postcss/lib/postcss.js'
const D = new URL('../dist/', import.meta.url)
const raw = fs.readFileSync(new URL('es-ui.raw.css', D), 'utf8')
const tags = JSON.parse(fs.readFileSync(new URL('tags.json', D), 'utf8'))
const list = tags.join(',')
const S = `:where(${list},es-app,es-portal)`
const head = `:where(${list}){display:contents}:where(${list}):not(:defined){visibility:hidden}es-app,es-portal,es-slot{display:contents}es-slots{display:none!important}\n`
fs.writeFileSync(new URL('es-ui.css', D), head + raw)

const root = postcss.parse(raw)
const GLOBAL = /^(:root|\[data-theme=dark\])$/
const toNested = (sel) => {
  if (/^(html|:host|body)$/.test(sel)) return '&'
  if (/^(html|body)\b/.test(sel)) return sel.replace(/^(html|body)/, '&')
  if (sel.startsWith('[data-theme=dark] ')) return '[data-theme=dark] & ' + sel.slice(18)
  if (sel.startsWith(':root ')) return '& ' + sel.slice(6)
  return '& ' + sel
}
function scope(container) {
  const wrap = postcss.rule({ selector: S })
  for (const node of [...container.nodes]) {
    if (node.type === 'rule') {
      if (node.selectors.every((s) => GLOBAL.test(s))) continue
      node.selectors = node.selectors.map(toNested)
      wrap.append(node.remove())
    } else if (node.type === 'atrule' && /^(media|supports)$/.test(node.name)) scope(node)
  }
  if (wrap.nodes && wrap.nodes.length) container.append(wrap)
}
scope(root)
fs.writeFileSync(new URL('es-ui.scoped.css', D), head + root.toString())
console.log('css:', tags.length, 'tags;', (fs.statSync(new URL('es-ui.css', D)).size / 1024).toFixed(0) + ' KB global,', (fs.statSync(new URL('es-ui.scoped.css', D)).size / 1024).toFixed(0) + ' KB scoped')
