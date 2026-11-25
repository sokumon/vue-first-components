// S3: Vue built-ins re-expressed generically on top of petite (text rewrite + 1 directive):
//  <slot>..fallback..</slot>        -> <template v-if="true">fallback</template>  (only the
//                                       "parent passed no slot" case of slots)
//  <Transition>/<TransitionGroup>   -> unwrapped (no animation); tag="x" -> <x>; structural
//                                       directives (v-if/v-for/...) kept on a <template>
//  <Teleport to="sel">              -> <div v-teleport="sel" ...>, directive moves children there
// Runs after S1, so tags are already c-transition, c-teleport, ...
const ATTRS = `((?:\\s+(?:[^>"']|"[^"]*"|'[^']*')*)?)`
const STRUCT = /\s(v-(?:if|else-if|else|for)(?:="[^"]*")?)/g
function unwrap(t, name, open) {
  const stack = []
  return t.replace(new RegExp(`<${name}${ATTRS}>|</${name}>`, 'g'), (m, a) => {
    if (m[1] === '/') { const c = stack.pop(); return c ? `</${c}>` : '' }
    const [tag, rest] = open(a || ''); stack.push(tag); return tag ? `<${tag}${rest}>` : ''
  })
}
const structural = a => [...a.matchAll(STRUCT)].map(m => ' ' + m[1]).join('')
export function rewriteBuiltins(t) {
  t = unwrap(t, 'slot', () => ['template', ' v-if="true"'])
  for (const n of ['c-transition-group', 'c-transition']) t = unwrap(t, n, a => {
    const tag = (a.match(/\stag="([\w-]+)"/) || [])[1], s = structural(a)
    return tag ? [tag, s] : s ? ['template', s] : [null, '']
  })
  t = unwrap(t, 'c-teleport', a => {
    const to = a.match(/\s(:?)to="([^"]*)"/), exp = to ? (to[1] ? to[2] : `'${to[2]}'`) : "'body'"
    return ['div', ` v-teleport="${exp}"` + a.replace(/\s:?to="[^"]*"/, '')]
  })
  return t
}
export function teleportDirective({ el, get }) {
  const to = get(), target = (to instanceof Element ? to : document.querySelector(to || 'body')) || document.body
  queueMicrotask(() => { while (el.firstChild) target.appendChild(el.firstChild); el.remove() })
}
