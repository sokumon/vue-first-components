const { chromium } = require("playwright");
exports.open = async function () {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await ctx.newPage();
	const errors = [];
	page.on("response", (r) => { if (r.status() >= 400) errors.push("http " + r.status() + " " + r.url()); });
	page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
	page.on("console", (m) => {
		if (m.type() === "error" || /Vue warn/.test(m.text())) errors.push(m.type() + ": " + m.text().slice(0, 300) + (m.location()?.url ? " @ " + m.location().url : ""));
	});
	const base = "http://v5.localhost:8000";
	const r = await ctx.request.post(base + "/api/method/login", { form: { usr: "Administrator", pwd: "admin" } });
	if (!r.ok()) throw new Error("login " + r.status());
	return { browser, ctx, page, errors, base };
};
