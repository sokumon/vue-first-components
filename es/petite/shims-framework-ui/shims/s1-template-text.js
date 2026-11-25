// S1: generic template-text normaliser. Runs on the raw <template> string before the
// browser HTML parser sees it, identically for every component. It changes syntax only.
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '))
const TAG = /<([A-Za-z][\w.:-]*)((?:\s+(?:[^>"'\/]|"[^"]*"|'[^']*'|\/(?!>))*)?)\s*\/>/g
const kebab = s => s.replace(/\.|([a-z0-9])([A-Z])/g, (m, a, b) => (a ? a + '-' + b : '-')).toLowerCase()
export function normaliseTemplate(t) {
  // 1. <Foo /> -> <Foo></Foo>  (HTML parser ignores "/>" on non-void elements)
  t = t.replace(TAG, (m, tag, attrs) => VOID.has(tag.toLowerCase()) ? m : `<${tag}${attrs || ''}></${tag}>`)
  // 2. PascalCase / dotted component tags -> custom-element names (avoids <Button>, <Select>,
  //    <Dialog>, <Input> being parsed as the native element; <select :options> crashes petite)
  t = t.replace(/<(\/?)([A-Z][\w.]*)(?=[\s>\/])/g, (m, sl, tag) => `<${sl}c-${kebab(tag)}`)
  // 3. :fooBar="x" -> :foo-bar.camel="x" (parser lowercases attribute names; petite has .camel)
  t = t.replace(/(\s)(:|v-bind:)([a-z][a-z0-9]*[A-Z][\w]*)(=)/g, (m, sp, p, name, eq) => `${sp}:${kebab(name)}.camel${eq}`)
  // 4. TypeScript in expressions: `x as T`, `(e: Event) =>`, `x!.y` (petite uses new Function)
  const stripTs = e => e
    .replace(/\s+as\s+(?:const\b|[A-Za-z_$][\w$.]*(?:<[^<>]*>)?(?:\[\])*(?:\s*\|\s*[A-Za-z_$][\w$.]*(?:\[\])*)*)/g, '')
    .replace(/\(\s*([A-Za-z_$][\w$]*)\s*\??:\s*[^()=]+?\)\s*=>/g, '($1) =>')
    .replace(/([\w$\])])!(?=[.\[)])/g, '$1')
  t = t.replace(/(\s(?:v-[\w:.-]+|[:@#][\w:.\[\]-]+)=)"([^"]*)"/g, (m, a, v) => `${a}"${stripTs(v)}"`)
  t = t.replace(/\{\{([\s\S]*?)\}\}/g, (m, e) => `{{${stripTs(e)}}}`)
  return t
}
