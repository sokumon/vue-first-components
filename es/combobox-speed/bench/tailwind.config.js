// Same preset for every build (npm 1.2.0's); content follows the frappe-ui source being benchmarked.
import preset from 'frappe-ui/tailwind'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const WC = path.resolve(here, '../..')
const env = process.env.FUI || 'npm'
const FUI = env === 'npm' ? path.join(WC, 'node_modules/frappe-ui') : env === 'clone' ? path.resolve(WC, '../frappe-ui') : path.resolve(env)
export default {
  presets: [preset],
  content: [path.join(here, 'index.html'), path.join(here, 'src/**/*.{js,vue}'), path.join(FUI, 'src/components/{Combobox,shared,InputLabeling,ItemListRow,Spinner}/**/*.{vue,ts}')],
}
