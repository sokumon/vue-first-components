import preset from 'frappe-ui/tailwind'
// [speed2] safelist: the preset safelists 'prose'/'prose-v3' for TextEditor; no es-* tag here renders prose,
// and the 134 `.prose :where(x)` rules are unbucketed in Chrome (every Desk element is tested against them).
export default { presets: [preset], content: [new URL('./dist/es-link.js', import.meta.url).pathname], safelist: process.env.CSS_PROSE === '1' ? ['prose', 'prose-v3'] : [] }
