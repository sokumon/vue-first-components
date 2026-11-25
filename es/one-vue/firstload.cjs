// Desk first load, no uploader use: which scripts/styles are downloaded, raw and gzip-9 bytes.
// Run: NODE_PATH=~/fb/pw/node_modules node firstload.cjs <label> [route]
const { chromium } = require("playwright");
const zlib = require("zlib");
const fs = require("fs");
const base = "http://v5.localhost:8000";
const label = process.argv[2] || "run";
const route = process.argv[3] || "/desk";

(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	if (route !== "/login") {
		const r = await ctx.request.post(base + "/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
		if (!r.ok()) throw new Error("login " + r.status());
	}
	const page = await ctx.newPage();
	const assets = [];
	page.on("response", async (res) => {
		const url = res.url();
		if (!/\/assets\/.*\.(js|css)(\?|$)/.test(url)) return;
		try {
			const body = await res.body();
			assets.push({ file: url.replace(/^.*\//, "").replace(/\?.*$/, ""), raw: body.length, gz: zlib.gzipSync(body, { level: 9 }).length });
		} catch {}
	});
	await page.goto(base + route, { waitUntil: "load" });
	if (route.startsWith("/desk")) await page.waitForFunction(() => window.frappe?.get_current_page?.(), null, { timeout: 30000 });
	await page.waitForTimeout(4000);
	const state = await page.evaluate(() => ({
		vue: !!window.frappe?.Vue,
		uploader_class: typeof frappe.ui?.FileUploader,
		uploader_loaded: !!frappe.ui?.file_uploader_component,
	}));
	await browser.close();
	assets.sort((a, b) => a.file.localeCompare(b.file));
	const sum = (k, f = () => true) => assets.filter(f).reduce((s, a) => s + a[k], 0);
	const js = (a) => a.file.endsWith(".js");
	const out = {
		label, route, state,
		js: { files: assets.filter(js).length, raw: sum("raw", js), gz: sum("gz", js) },
		all: { files: assets.length, raw: sum("raw"), gz: sum("gz") },
		vue_bundle: assets.filter((a) => /^vue\.bundle\./.test(a.file)),
		file_uploader: assets.filter((a) => /^file_uploader\.bundle\./.test(a.file)),
		assets,
	};
	fs.writeFileSync(__dirname + `/firstload-${label}.json`, JSON.stringify(out, null, 1));
	console.log(JSON.stringify({ ...out, assets: undefined }));
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
