import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";
import { lucideIconsPlugin } from "frappe-ui/vite/lucideIconsPlugin";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
	root: here("."),
	plugins: [{ ...lucideIconsPlugin(), enforce: "pre" }, vue()],
	css: { postcss: { plugins: [tailwind({ config: here("tailwind.config.cjs") }), autoprefixer()] } },
	resolve: { dedupe: ["vue"] },
	define: { "process.env.NODE_ENV": '"production"', "import.meta.env.DEV": "false", __VUE_OPTIONS_API__: "true", __VUE_PROD_DEVTOOLS__: "false", __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false" },
	publicDir: false,
	build: {
		lib: { entry: here("entry.js"), formats: ["es"], fileName: () => "fui-a.js" },
		rollupOptions: { external: [/^vue$/] },
		cssCodeSplit: false,
		outDir: here("dist"),
		emptyOutDir: true,
		minify: "esbuild",
		target: "es2020",
	},
});
