// Shim "ts": strip the TypeScript that <script setup lang="ts"> lets templates contain
// (petite compiles expressions with new Function). Regex-level, only inside directive
// values and {{ }}: `x as T`, `(e: T) =>`, `x!.y`.
const strip = e => e
  .replace(/\s+as\s+(?:const|any|unknown|[A-Za-z_$][\w$]*(?:\.[\w$]+)*(?:<[^<>]*>)?(?:\[\])?)(?![\w$])/g, '')
  .replace(/\(\s*([\w$]+)\s*:\s*[\w$.]+(?:<[^<>]*>)?(?:\[\])?\s*\)\s*=>/g, '($1) =>')
  .replace(/([\w$\])])!\./g, '$1.')
export default {
  text(tpl) {
    return tpl
      .replace(/(\s(?:[:@#]|v-)[^\s=>]*\s*=\s*)"([^"]*)"/g, (_, a, v) => `${a}"${strip(v)}"`)
      .replace(/\{\{([\s\S]*?)\}\}/g, (_, v) => `{{${strip(v)}}}`)
  },
}
