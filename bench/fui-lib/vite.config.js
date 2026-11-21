import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
	plugins: [vue()],
	define: { "process.env.NODE_ENV": '"development"' },
	build: {
		lib: { entry: "entry.js", formats: ["es"], fileName: () => "fui-lib.js" },
		rollupOptions: { external: ["vue"] },
		minify: false,
		outDir: "dist",
		cssCodeSplit: false,
	},
});
