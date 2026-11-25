import preset from 'frappe-ui/tailwind'
export default {
  presets: [preset],
  content: ['./sweep/shell/xo/pages/*.html', './sweep/shell/xo/src/**/*.js', './node_modules/frappe-ui/src/**/*.{vue,js,ts}', '../frappe/ui/src/**/*.{vue,ts}'],
}
