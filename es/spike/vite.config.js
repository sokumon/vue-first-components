import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [vue({ customElement: false })],
  resolve: { alias: { 'frappe-ui': fileURLToPath(new URL('./node_modules/frappe-ui', import.meta.url)), vue: fileURLToPath(new URL('./node_modules/vue', import.meta.url)), '@framework/ui': fileURLToPath(new URL('../frappe/ui/src', import.meta.url)) }, dedupe: ['vue'] },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    lib: { entry: 'src/entry.js', formats: ['iife'], name: 'ES', fileName: () => 'es-components.js' },
    cssCodeSplit: false, outDir: 'dist', emptyOutDir: true,
  },
})
