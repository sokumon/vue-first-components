// S2: generic Vue-instance globals in every scope: $slots/$attrs/$props/$emit.
// Values are what a component sees when mounted with props only and no slots/listeners.
export function instanceGlobals(props) {
  return { $slots: {}, $attrs: {}, $props: props, $emit: () => {}, $el: null }
}
