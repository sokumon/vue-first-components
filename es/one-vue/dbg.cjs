const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	await ctx.request.post("http://v5.localhost:8000/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	const page = await ctx.newPage();
	page.on("console", (m) => { if (/twice/.test(m.text())) console.log("TWICE", m.location()); });
	await page.addInitScript(() => {
		new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
			if (n.tagName === "SCRIPT" && /vue\.bundle/.test(n.src)) console.log("ADDED " + n.src + " " + new Error().stack);
		}))).observe(document, { childList: true, subtree: true });
	});
	page.on("console", (m) => { if (/ADDED/.test(m.text())) console.log(m.text().slice(0, 800)); });
	await page.goto("http://v5.localhost:8000" + (process.argv[2] || "/desk/todo"), { waitUntil: "load" });
	await page.waitForTimeout(5000);
	console.log(await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean)));
	console.log(await page.evaluate(() => frappe.assets._executed));
	await browser.close();
})();
