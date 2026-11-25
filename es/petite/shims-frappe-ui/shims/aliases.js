// Shim "aliases": guess the conventional <script setup> names (props = defineProps(),
// attrs = useAttrs(), slots = useSlots(), emit = defineEmits()). A naming guess, not
// running the script.
export default {
  scope(scope) {
    scope.props = scope
    scope.attrs = {}
    scope.slots = {}
    scope.emit = () => {}
  },
}
