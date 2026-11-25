import { createApp } from 'vue'
import App from './App.vue'
import '../../bench/src/style.css'

const log = []
const warnings = []
window.__log = log
window.__warnings = warnings
const app = createApp(App)
app.config.warnHandler = (msg) => warnings.push(String(msg).slice(0, 300))
app.config.errorHandler = (err) => { warnings.push('ERROR ' + String(err && err.stack || err).slice(0, 500)); console.error(err) }
// probe mode (?probe): log instance creates/updates in order
if (location.search.includes('probe')) {
  window.__probe = []
  const nm = (i) => i.type.__name || i.type.name || 'anon'
  app.mixin({ beforeCreate() { window.__probe.push('create ' + nm(this.$)) }, beforeUpdate() { window.__probe.push('update ' + nm(this.$)) } })
}
app.mount('#app')
window.__ready = true
