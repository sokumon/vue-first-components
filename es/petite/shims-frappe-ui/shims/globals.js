// Shim "globals": the instance properties Vue templates may read ($slots, $attrs,
// $props, $emit). Filled with what a component mounted with no slots, no fallthrough
// attrs and no listeners would see.
export default {
  scope(scope) {
    scope.$props = scope
    scope.$slots = {}
    scope.$attrs = {}
    scope.$emit = () => {}
  },
}
