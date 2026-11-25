import preset from 'frappe-ui/tailwind'
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,vue}', './node_modules/frappe-ui/src/**/*.{vue,js,ts}', '../frappe/ui/src/**/*.{vue,ts}'],
}
