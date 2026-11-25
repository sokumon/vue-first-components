const { chromium } = require("playwright");
(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	await ctx.request.post("http://v5.localhost:8000/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	const page = await ctx.newPage();
	page.on("console", (m) => { if (m.type() === "error" && !/socket|404/.test(m.text())) console.log("ERR", m.text().slice(0, 500)); });
	page.on("pageerror", (e) => console.log("PAGEERR", e.message.slice(0, 500)));
	for (const r of process.argv.slice(2)) {
		await page.goto("http://v5.localhost:8000" + r, { waitUntil: "load" });
		await page.waitForTimeout(8000);
		console.log(r, await page.evaluate(() => ({
			route: frappe.get_route(),
			apps: [...document.querySelectorAll("*")].filter((e) => e.__vue_app__).map((e) => e.className.slice(0, 60)),
			executed: frappe.assets._executed,
			main: document.querySelector(".page-container:not([style*='none']) .layout-main-section")?.innerText.slice(0, 200),
		})));
	}
	await browser.close();
})();
