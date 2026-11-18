// The same jQuery writes under Vue's own renderer and the desk renderer.
const fs = require("fs");
const src = fs.readFileSync("spike2.cjs", "utf8");
new Function("require", "__filename", "__dirname",
	src.slice(0, src.indexOf("let pass")))(require, __filename, __dirname);
const Vue = require("vue");
const Probe2 = require("./Probe2.vue");

async function run(name, createApp) {
	const el = $("<div>").appendTo("body")[0];
	const probe = Vue.reactive({ on: false, label: "one", extra: false, rows: ["a", "b", "c"] });
	createApp({ render: () => Vue.h(Probe2, { probe }) }).mount(el);
	const $holder = $(el).find(".holder");
	const out = [];
	const step = async (label, fn) => {
		try { out.push(`${label}: ${await fn()}`); } catch (e) { out.push(`${label}: THROWS (${e.message})`); }
	};
	await step("caller's class after Vue toggles :class", async () => {
		$holder.addClass("btn-primary"); probe.on = true; await Vue.nextTick();
		return $holder.hasClass("btn-primary") && $holder.hasClass("active") ? "kept" : "LOST";
	});
	await step("Vue drops its own class", async () => {
		probe.on = false; await Vue.nextTick();
		return !$holder.hasClass("active") && $holder.hasClass("btn-primary") ? "only Vue's removed" : "wrong";
	});
	await step(".html() over Vue's children, then a v-if child appears", async () => {
		$holder.html("<i>caller</i>"); probe.extra = true; await Vue.nextTick();
		return $holder.html();
	});
	await step("...then Vue updates and removes it again", async () => {
		probe.label = "two"; probe.extra = false; await Vue.nextTick();
		return $holder.html();
	});
	await step("jQuery moves a row, the list then grows", async () => {
		$(el).find('[data-row="c"]').prependTo($(el).find(".rows"));
		probe.rows = ["a", "b", "c", "d"]; await Vue.nextTick();
		return $(el).find("li").map((_, li) => li.dataset.row).get().join("");
	});
	console.log(`\n${name}`);
	out.forEach((line) => console.log("  " + line));
}

(async () => {
	await run("Vue's createApp", Vue.createApp);
	await run("desk renderer's createApp", require("./renderer.js").createApp);
})();
