// Shim "slots": render each <slot> outlet as its fallback content (what Vue renders when
// the parent passes nothing). Keeps v-if/v-else-if/v-else/v-for on a <template>; drops
// name and slot props. DOM pass before mount, recursing into <template> contents.
const KEEP = /^(v-if|v-else-if|v-else|v-for|:key|key)$/
function walk(root) {
  for (const t of root.querySelectorAll('template')) if (t.content) walk(t.content)
  for (const s of [...root.querySelectorAll('slot')].reverse()) {
    const keep = [...s.attributes].filter(a => KEEP.test(a.name))
    if (!keep.length) { s.replaceWith(...s.childNodes); continue }
    const t = document.createElement('template')
    for (const a of keep) t.setAttribute(a.name, a.value)
    t.content.append(...s.childNodes)
    s.replaceWith(t)
  }
}
export default { dom: el => walk(el) }
