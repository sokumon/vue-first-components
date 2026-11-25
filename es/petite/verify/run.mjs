import fs from 'node:fs'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('/home/claude/fb/pw/node_modules/playwright')
const F = 'src/components/', C = 'src/charts/'
const T = [
 [F+'Icon/Icon.vue', { icon: 'lucide-house' }, null, [{ set: { icon: '🚀' } }, { set: { icon: 'lucide-x' } }]],
 [F+'Icon/Icon.vue', { name: '🚀' }, null, []],
 [F+'InputLabeling/InputError.vue', { id: 'e1', lines: ['Bad value', 'Second'] }, null, [{ set: { lines: ['Only'] } }, { set: { lines: [] } }]],
 [F+'InputLabeling/RequiredIndicator.vue', { required: true }, null, [{ set: { required: false } }, { set: { required: true } }]],
 [F+'InputLabeling/LabelingWrapper.vue', { enabled: true, wrapperClass: 'w' }, { default: 'child' }, [{ set: { enabled: false } }]],
 [F+'FormLabel/FormLabel.vue', { id: 'x', label: 'Name', required: true }, null, [{ set: { label: 'Email' } }]],
 [F+'DesktopShell/DesktopShell.vue', {}, { default: 'body', rail: 'rail', sidebar: 'side' }, []],
 [F+'KeyboardShortcutsDialog/KeyboardShortcutsDialog.vue', { open: true }, null, [{ click: 'button' }]],
 [F+'Combobox/ComboboxResults.vue', { groups: [], size: 'sm', query: '', model: null, loading: false, emptyText: 'None', showEmpty: true, slotFns: {}, allSelectableOptions: [] }, null, []],
 [C+'AreaChart.vue', { data: [{ month: 'Jan', sales: 10, refunds: 4 }, { month: 'Feb', sales: 20, refunds: 6 }], x: 'month', y: ['sales', 'refunds'], title: 'Sales', echartOptions: { animation: false } }, null, []],
 [C+'BarChart.vue', { data: [{ month: 'Jan', sales: 10, refunds: 4 }, { month: 'Feb', sales: 20, refunds: 6 }], x: 'month', y: ['sales', 'refunds'], title: 'Sales', echartOptions: { animation: false } }, null, []],
 [C+'DonutChart.vue', { data: [{ source: 'Search', visits: 50 }, { source: 'Direct', visits: 30 }], category: 'source', value: 'visits', title: 'Visits', echartOptions: { animation: false } }, null, []],
 [C+'CalendarHeatmapChart.vue', { data: [{ day: '2024-03-04', commits: 2 }], date: 'day', value: 'commits', start: '2024-03-01', end: '2024-03-31', title: 'Commits', echartOptions: { animation: false } }, null, []],
]
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const res = []
try {
  const page = await browser.newPage()
  for (const [file, props, slots, steps] of T) {
    await page.goto('http://127.0.0.1:5299/index.html', { timeout: 90000 }); await page.waitForFunction('window.ready', null, { timeout: 90000 })
    try { res.push(await page.evaluate(a => window.runCase(...a), [file, props, slots, steps])) } catch (e) { res.push({ file, harnessError: e.message.slice(0, 300) }) }
    const r = res.at(-1); console.log(file, r.harnessError || r.steps.map(s => s.same).join(','))
  }
} finally { await browser.close(); fs.writeFileSync('results.json', JSON.stringify(res, null, 1)) }
