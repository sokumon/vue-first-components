import preset from 'frappe-ui/tailwind'
export default {
  presets: [preset],
  content: ['./sweep/display/index.html', './sweep/display/src/**/*.js', './node_modules/frappe-ui/src/**/*.{vue,js,ts}', '../frappe/ui/src/**/*.{vue,ts}'],
}
