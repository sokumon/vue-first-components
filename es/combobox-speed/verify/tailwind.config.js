import preset from 'frappe-ui/tailwind'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
export default { presets: [preset], content: [path.join(here, 'index.html'), path.join(here, 'src/**/*.{js,vue}'), path.join(path.resolve(process.env.FUI), 'src/components/**/*.{vue,ts}')] }
