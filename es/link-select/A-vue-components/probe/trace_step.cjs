// runs one harness flow; for the named step, traces keydowns and highlight changes in the page
const { open, recorder } = require("../../harness/lib.cjs");
const FLOWS = require("../../harness/flows.cjs");
const [site, flow, stepname] = process.argv.slice(2);
(async () => {
	const s = await open(site);
	const r = recorder(s.page, s.rec, flow, null);
	const orig = r.step;
	r.step = async (name, fn) => {
		if (name !== stepname) return orig.call(r, name, fn);
		await s.page.evaluate(() => {
			window.__trace = [];
			document.addEventListener("keydown", (e) => __trace.push("key " + e.key + " t=" + e.target.tagName), true);
			new MutationObserver((m) => m.forEach((x) => x.target.hasAttribute?.("data-highlighted") && __trace.push("hl " + x.target.textContent.trim().slice(0, 30)))).observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-highlighted"] });
		});
		const o = await orig.call(r, name, fn);
		console.log(JSON.stringify(o).slice(0, 300));
		console.log((await s.page.evaluate(() => __trace)).slice(-4).join("\n")); console.log(JSON.stringify(await s.page.evaluate(() => [...document.querySelectorAll("[role=option]")].map((o) => [o.textContent.trim().slice(0, 25), o.getAttribute("aria-selected"), o.hasAttribute("data-highlighted"), o.getAttribute("data-state"), __tw.vis(o)]))));
		await s.page.screenshot({ path: __dirname + "/trace.png" });
		throw new Error("stop");
	};
	try { await FLOWS[site][flow]({ page: s.page, rec: s.rec, r, base: s.base }); } catch (e) { console.log(e.message); }
	await s.browser.close();
})();
