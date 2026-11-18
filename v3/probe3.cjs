// Vue listeners under the desk renderer, driven by jQuery and by real events.
const fs = require("fs");
const src = fs.readFileSync("spike3.cjs", "utf8");
new Function("require", "__filename", "__dirname", src.slice(0, src.indexOf("// ------------------------------------------------ the desk globals")))(require, __filename, __dirname);
const Vue = require("vue");
const { createApp } = require("./renderer.js");
const hits = {};
const hit = (name) => (e) => { (hits[name] ||= []).push(e); };
const count = (name) => (hits[name] || []).length;
const el = $("<div>").appendTo("body")[0];
const state = Vue.reactive({ swap: false });
createApp({
	setup: () => () =>
		Vue.h("div", { class: "row", onClick: hit("row") }, [
			Vue.h("a", { href: "#x", onClick: hit("a") }),
			Vue.h("button", { onClick: state.swap ? hit("swapped") : hit("button") }),
			Vue.h("button", { class: "stop", onClick: Vue.withModifiers(hit("stop"), ["stop", "prevent"]) }),
			Vue.h("input", { onChange: hit("change"), onInput: hit("input"), onKeydown: Vue.withKeys(hit("enter"), ["enter"]) }),
			Vue.h("span", { onClickCapture: hit("capture"), onClickOnce: hit("once") }),
			Vue.h("div", { class: "custom", onMyEvent: hit("custom") }),
		]),
}).mount(el);
const ok = (name, pass) => console.log(`${pass ? "ok  " : "FAIL"} ${name}`);
(async () => {
	$(el).find("a").trigger("click");
	ok(".trigger('click') on <a> reaches its Vue listener", count("a") === 1);
	ok("...and bubbles to a Vue listener on the row", count("row") === 1);
	$(el).find("button").first().trigger("click");
	ok(".trigger('click') on a button runs its listener once, not twice", count("button") === 1 && count("row") === 2);
	$(el).find("button")[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	ok("a real click runs it once and gets a native event", count("button") === 2 && hits.button[1] instanceof window.MouseEvent);
	$(el).find("input").trigger("change");
	$(el).find("input").trigger("input");
	ok(".trigger('change') and ('input') reach Vue listeners", count("change") === 1 && count("input") === 1);
	$(el).find("input").trigger($.Event("keydown", { key: "Enter" }));
	ok("withKeys works on a jQuery keydown", count("enter") === 1);
	$(el).find(".stop").trigger("click");
	const row_before = count("row");
	$(el).find(".stop")[0].dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
	ok("withModifiers .stop stops the row's listener", count("stop") === 2 && count("row") === row_before);
	const span = $(el).find("span")[0];
	span.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	span.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	ok("Capture and Once still go through Vue's own patchEvent", count("capture") === 2 && count("once") === 1);
	$(el).find(".custom").trigger("my-event");
	ok("a custom event name is hyphenated as Vue does", count("custom") === 1);
	state.swap = true;
	await Vue.nextTick();
	$(el).find("button").first().trigger("click");
	ok("Vue swapping the handler replaces it, with no second binding", count("swapped") === 1 && count("button") === 2);
	$(el).find("button").first().off("click").on("click", hit("legacy"));
	$(el).find("button").first().trigger("click");
	ok(".off('click').on('click', fn) replaces Vue's listener, as legacy code expects", count("legacy") === 1 && count("swapped") === 1);
	process.exit(0);
})();
