// Minimal Desk surface mobile_nav.js touches. Loaded after vue.bundle.js (which sets frappe.Vue / frappe.vue_modules).
window.__ = (s) => s
frappe.provide = (ns) => ns.split('.').slice(1).reduce((o, k) => (o[k] = o[k] || {}), frappe)
frappe.ui = frappe.ui || {}; frappe.ui.Page = {}
frappe.ui.button = (o) => $(`<button class="btn ${o.css_class}">${o.label}</button>`).on('click', o.onclick)
frappe.boot = { desk_settings: { search_bar: 1, notifications: 1 } }
let ROUTE = ['Workspaces'], handlers = []
frappe.router = { on: (ev, f) => handlers.push(f), page_info_for: () => ({}) }
frappe.get_route = () => ROUTE
frappe.get_prev_route = () => []
frappe.get_meta = () => null
frappe.set_route = (r) => { ROUTE = typeof r === 'string' ? r.replace(/^\/desk\/?/, '').split('/').map((s) => s.charAt(0).toUpperCase() + s.slice(1)) : r; if (!ROUTE[0]) ROUTE = ['Workspaces']; handlers.forEach((f) => f()); $(document).trigger('page-change') }
frappe.utils = { icon: (n, size) => `<svg class="icon icon-${size}" data-icon="${n}" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"></circle></svg>`, escape_html: (s) => s }
frappe.container = { page: { page: {} } }
frappe.app = {}
// Desk's router takes over in-app links
// as frappe/router.js:26 does
$('body').on('click', 'a', (e) => { const h = e.currentTarget.getAttribute('href'); if (h && h.startsWith('/desk')) { e.preventDefault(); frappe.set_route(h) } })
