// Extract the <template> block text verbatim (no rewriting) for each target file.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('/home/claude/vue-first-components/wc/package.json')
const { parse } = require('@vue/compiler-sfc')
const R = '/home/claude/vue-first-components/frappe-ui/'
const files = ['src/components/Combobox/ComboboxResults.vue','src/components/DesktopShell/DesktopShell.vue','src/components/FormLabel/FormLabel.vue','src/components/Icon/Icon.vue','src/components/InputLabeling/InputError.vue','src/components/InputLabeling/LabelingWrapper.vue','src/components/InputLabeling/RequiredIndicator.vue','src/components/KeyboardShortcutsDialog/KeyboardShortcutsDialog.vue','src/charts/AreaChart.vue','src/charts/BarChart.vue','src/charts/CalendarHeatmapChart.vue','src/charts/DonutChart.vue']
const out = {}
for (const f of files) {
  const src = fs.readFileSync(R + f, 'utf8')
  const { descriptor } = parse(src)
  out[f] = { abs: R + f, template: descriptor.template?.content ?? null, lang: descriptor.template?.lang || 'html', sha: require('node:crypto').createHash('sha256').update(src).digest('hex') }
}
fs.writeFileSync('cases.json', JSON.stringify(out, null, 1))
for (const [f, v] of Object.entries(out)) console.log(f, v.template == null ? 'NO TEMPLATE' : v.template.length + ' chars', v.sha.slice(0, 12))
