// What Vue does when jQuery touches what it drew.
const fs = require("fs");
const src = fs.readFileSync("spike2.cjs", "utf8");
const boot = src.slice(0, src.indexOf("// ------------------------------------------------ classes"));
new Function("require", "__filename", "__dirname", boot.replace("let pass", "var pass"))(require, __filename, __dirname);
const Vue = require("vue");
class Probe extends frappe.ui.Component { static view = require("./Probe.vue"); static prop = "probe";
	make() { this.rows = ["a", "b", "c"]; this.label = "one"; } }
const el = $("<div>").appendTo("body")[0];
const p = new Probe({ parent: el });
const order = () => $(el).find(".rows li").map((_, li) => li.dataset.row).get().join("");
const step = async (name, fn) => { try { await fn(); console.log("ok  ", name); } catch (e) { console.log("THROW", name, "->", e.message); } };
(async () => {
	await step("jQuery fills an element the template leaves empty, then Vue re-renders", async () => {
		$(el).find(".filled").html("<b>legacy</b>"); p.label = "two"; await Vue.nextTick();
		console.log("      kept:", $(el).find(".filled b").length === 1);
	});
	await step("jQuery moves a Vue-drawn row (opendesk prependTo), then the list changes", async () => {
		$(el).find('[data-row="c"]').prependTo($(el).find(".rows"));
		console.log("      after move:", order());
		p.rows = ["a", "b", "c", "d"]; await Vue.nextTick();
		console.log("      after Vue adds d:", order());
		p.rows = ["d", "c", "b", "a"]; await Vue.nextTick();
		console.log("      after Vue reverses:", order());
	});
	await step("jQuery adds a class and an attr to a Vue-drawn row", async () => {
		$(el).find('[data-row="a"]').addClass("x").attr("title", "t"); p.rows = [...p.rows, "e"]; await Vue.nextTick();
		console.log("      kept:", $(el).find('[data-row="a"]').is(".x[title=t]"));
	});
	await step("jQuery .html() over Vue-drawn children, then Vue updates them", async () => {
		$(el).find(".holder").html("<i>replaced</i>"); p.label = "three"; await Vue.nextTick();
		console.log("      holder now:", $(el).find(".holder").html());
	});
	await step("jQuery .remove() of a Vue-drawn row, then the list changes", async () => {
		$(el).find('[data-row="b"]').remove(); p.rows = ["a", "c"]; await Vue.nextTick();
		console.log("      rows:", order());
	});
	await step("after .html(), Vue inserts a new v-if child in that element", async () => {
		p.extra = true; await Vue.nextTick();
		console.log("      holder now:", $(el).find(".holder").html());
	});
})();
