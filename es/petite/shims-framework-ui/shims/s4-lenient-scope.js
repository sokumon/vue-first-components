// S4: identifier-tolerant scope. Any name the template reads that is not in scope and is
// not a browser global resolves to undefined instead of throwing ReferenceError.
// This hides missing <script setup> state; it does not supply it.
export function lenientScope(obj) {
  return new Proxy(obj, {
    has: (t, k) => k in t || (typeof k === 'string' && !(k in globalThis)),
    get: (t, k, r) => Reflect.get(t, k, r),
  })
}
