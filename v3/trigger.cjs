const FRAPPE = process.env.FRAPPE || require("path").resolve(__dirname, "../../../frappe");
const { JSDOM } = require(FRAPPE + "/flow/node_modules/jsdom");
const dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
const jq = require(FRAPPE + "/node_modules/jquery");
const $ = jq.fn ? jq : jq(dom.window);
const cases = [["a", "click"], ["button", "click"], ["div", "click"], ["input", "change"], ["input", "input"], ["input", "keydown"], ["input", "focus"], ["input", "blur"], ["select", "change"], ["form", "submit"]];
console.log("jQuery", $.fn.jquery);
for (const [tag, type] of cases) {
	const el = document.createElement(tag);
	if (tag === "a") el.href = "#x";
	if (tag === "form") el.submit = () => {};
	document.body.appendChild(el);
	let native = 0, jquery = 0;
	el.addEventListener(type, () => native++);
	$(el).on(type, () => jquery++);
	$(el).trigger(type);
	console.log(`${tag}.trigger("${type}")`.padEnd(28), `addEventListener: ${native}  jQuery .on: ${jquery}`);
}
