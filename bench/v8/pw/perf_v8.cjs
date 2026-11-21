// Outlet/teleport cost in real Chromium on the real desk. Median of 5 runs per cell.
const { open } = require("./session.cjs");
const SIZES = process.env.SIZES ? process.env.SIZES.split(",").map(Number) : [100, 300, 1000];
(async () => {
	const { browser, page, errors, base, ctx } = await open();
	await page.goto(base + "/desk/user", { waitUntil: "load" });
	await page.waitForFunction(() => window.frappe?.app?.sidebar && frappe.ui?.app?._container && frappe.get_current_page?.()?.main, null, { timeout: 30000 });
	await page.waitForTimeout(1500);
	await page.evaluate(() => {
		const { Vue, desk_renderer, PlainRow } = window.__vue_first;
		const { h, Teleport } = Vue;
		const layout = () => document.body.offsetHeight;
		const hosts = (n) => {
			$("#perf-area").remove();
			const area = $('<div id="perf-area">').appendTo(frappe.get_current_page().main);
			return Array.from({ length: n }, (_, i) => $(`<div class="perf-host" data-i="${i}">`).appendTo(area)[0]);
		};
		const time = (fn) => { const t = performance.now(); fn(); layout(); return performance.now() - t; };
		window.__perf = {
			rows(n) {
				const hs = hosts(n); layout();
				let rows;
				const create = time(() => { rows = hs.map((parent, i) => new frappe.ui.PerfRow({ parent, label: "f" + i })); });
				const ok = document.querySelectorAll("#perf-area .perf-row").length === n;
				const k = Math.floor(n / 2);
				const t = performance.now();
				for (let j = 1; j <= 50; j++) { rows[k].set(j); rows[k].flush(); }
				const update = (performance.now() - t) / 50;
				const synced = document.querySelectorAll("#perf-area .perf-row")[k].textContent === `f${k} 50`;
				// legacy batch: set every row, then flush every row, in one tick
				const batch = time(() => { rows.forEach((r) => r.set(7)); rows.forEach((r) => r.flush()); });
				const batched = document.querySelectorAll("#perf-area .perf-row")[n - 1].textContent === `f${n - 1} 7`;
				const destroy = time(() => rows.forEach((r) => r.destroy()));
				const left = document.querySelectorAll("#perf-area .perf-row").length;
				$("#perf-area").remove();
				return { create, update, batch, destroy, ok: ok && synced && batched && left === 0 };
			},
			plain_vfor(n) {
				const hs = hosts(1);
				let app;
				const create = time(() => {
					app = desk_renderer.createApp({ render: () => h("div", Array.from({ length: n }, (_, i) => h(PlainRow, { label: "f" + i, n: 0 }))) });
					app.mount(hs[0]);
				});
				const ok = document.querySelectorAll("#perf-area .plain-row").length === n;
				const destroy = time(() => app.unmount());
				$("#perf-area").remove();
				return { create, destroy, ok };
			},
			plain_teleports(n) {
				const hs = hosts(n); layout();
				const root = document.createElement("div"); document.body.appendChild(root);
				let app;
				const create = time(() => {
					app = desk_renderer.createApp({ render: () => hs.map((to, i) => h(Teleport, { to, key: i }, [h(PlainRow, { label: "f" + i, n: 0 })])) });
					app.mount(root);
				});
				const ok = document.querySelectorAll("#perf-area .plain-row").length === n;
				const destroy = time(() => app.unmount());
				root.remove(); $("#perf-area").remove();
				return { create, destroy, ok };
			},
		};
	});
	const med = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
	const out = {};
	for (const scenario of ["rows", "plain_teleports", "plain_vfor"]) {
		for (const n of SIZES) {
			const runs = [];
			for (let r = 0; r < 6; r++) runs.push(await page.evaluate(([s, n]) => window.__perf[s](n), [scenario, n]));
			runs.shift(); // warm-up
			const row = { ok: runs.every((x) => x.ok) };
			for (const key of Object.keys(runs[0])) if (key !== "ok") row[key] = +med(runs.map((x) => x[key])).toFixed(key === "update" ? 3 : 1);
			out[`${scenario} n=${n}`] = row;
		}
	}
	console.table(out);

	// CPU profile: where the rows' create time goes at n=1000
	const cdp = await ctx.newCDPSession(page);
	await cdp.send("Profiler.enable");
	await cdp.send("Profiler.setSamplingInterval", { interval: 50 });
	await cdp.send("Profiler.start");
	await page.evaluate(() => { window.__perf.rows(1000); window.__perf.rows(1000); });
	const { profile } = await cdp.send("Profiler.stop");
	const dt = {};
	const ids = new Map(profile.nodes.map((n) => [n.id, n]));
	for (let i = 0; i < profile.samples.length; i++) {
		const n = ids.get(profile.samples[i]);
		const f = n.callFrame;
		const name = (f.functionName || "(anon)") + " " + (f.url.split("/").pop().replace(/\.[A-Z0-9]{8}\.js/, ".js") || "") + ":" + f.lineNumber;
		dt[name] = (dt[name] || 0) + (profile.timeDeltas[i] || 0) / 1000;
	}
	const total = Object.values(dt).reduce((a, b) => a + b, 0);
	console.log(`\nself time, 2x rows(1000), total ${total.toFixed(0)}ms sampled`);
	for (const [k, v] of Object.entries(dt).sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(`  ${v.toFixed(1).padStart(7)}ms ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
	console.log("errors:", errors.filter((e) => !/socket\.io/.test(e)));
	await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
