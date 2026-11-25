// Scopes Tailwind's output for Desk: every rule goes under :where(.tw-fui) (zero specificity; the Link and
// Select views wrap frappe-ui in .tw-fui, and the popovers teleport into a .tw-fui portal), and only the
// :root / [data-theme] variables Desk does not already define are kept (Desk's own values win).
const postcss = require("/home/claude/vue-first-components/wc/node_modules/postcss");
const fs = require("fs");
const { execSync } = require("child_process");
const desk = fs.readFileSync(execSync("ls ~/fb/frappe-bench/sites/assets/frappe/dist/css/desk.bundle.*.css").toString().trim().split("\n")[0], "utf8");
const desk_vars = new Set(desk.match(/--[a-zA-Z0-9-]+(?=\s*:)/g));
const root = postcss.parse(fs.readFileSync(__dirname + "/dist/es-wc-spike.css", "utf8"));
const S = ":where(.tw-fui)";
const GLOBAL = /^(:root|\[data-theme=dark\]|\[data-theme="dark"\])$/;
root.walkRules((rule) => {
	if (rule.parent.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
	if (rule.selectors.every((s) => GLOBAL.test(s))) {
		rule.walkDecls((d) => desk_vars.has(d.prop) && d.remove());
		if (!rule.nodes.length) rule.remove();
		return;
	}
	rule.selectors = rule.selectors.map((s) => {
		if (/^\[data-theme=("?)dark\1\] /.test(s)) return s.replace(/^(\[data-theme=("?)dark\2\]) /, `$1 ${S} `);
		if (/^(html|body|:host)$/.test(s)) return S;
		return `${S} ${s}`;
	});
});
const css = root.toString();
fs.writeFileSync(__dirname + "/dist/fui-a.css", css);
fs.writeFileSync(__dirname + "/dist/fui-a.css.js", "export default " + JSON.stringify(css) + ";\n");
console.log("fui-a.css", (css.length / 1024).toFixed(1), "KB");
