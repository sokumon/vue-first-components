import preset from 'frappe-ui/tailwind'
const W = '/home/claude/vue-first-components/'
export default {
  presets: [preset],
  content: [W + 'wc/jq/test/pages/*.html', W + 'wc/node_modules/frappe-ui/src/**/*.{vue,js,ts}', W + 'frappe/ui/src/**/*.{vue,ts}'],
}
