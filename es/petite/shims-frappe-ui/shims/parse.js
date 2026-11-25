// Shim "parse": make the browser HTML parser read SFC template text the way Vue's
// template parser does. Pure text rewrite of the template string, same for every file.
//  1. <Foo ... /> on non-void tags -> <Foo ...></Foo> (HTML ignores the "/" and re-nests siblings)
//  2. PascalCase component tags -> <pv-foo> so <Select>/<Input>/<Button>/<Dialog> are not
//     parsed as native elements (void <input> swallowing children, <select>.options crash)
//  3. :camelCase -> :camel-case.camel so petite camelizes it back (HTML lowercases names)
const VOID = new Set('area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'.split(','))
const ATTRS = String.raw`((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\x60]+))?)*)`
const OPEN = new RegExp(String.raw`<([A-Za-z][\w.:-]*)` + ATTRS + String.raw`\s*(\/?)>`, 'g')
const kebab = n => 'pv-' + n.replace(/\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const pascal = n => /^[A-Z]/.test(n)
export default {
  text(tpl) {
    let out = tpl.replace(OPEN, (m, tag, attrs, sc) => {
      const t = pascal(tag) ? kebab(tag) : tag
      attrs = attrs.replace(/(\s)((?::|v-bind:)[a-z]+[A-Z][\w]*)(\.[\w.]+)?(?=[\s=]|$)/g, (_, sp, name, mods) => `${sp}${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}${mods || ''}.camel`)
      return sc && !VOID.has(tag.toLowerCase()) ? `<${t}${attrs}></${t}>` : `<${t}${attrs}${sc ? ' /' : ''}>`
    })
    return out.replace(/<\/([A-Z][\w.]*)\s*>/g, (_, tag) => `</${kebab(tag)}>`)
  },
}
