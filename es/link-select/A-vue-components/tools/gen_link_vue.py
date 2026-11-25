# Generates src/tw_a/ControlLink.vue from the bench's link.js: every method body is link.js's own,
# verbatim, except make_input() and setup_awesomeplete(), which are replaced by the versions in
# link_overrides.js (the only hand-written part). Re-run after link.js changes.
import re, sys, pathlib
A = pathlib.Path(__file__).resolve().parent.parent
LINK = pathlib.Path.home() / "fb/frappe-bench/apps/frappe/frappe/public/js/frappe/form/controls/link.js"
src = LINK.read_text()
start = src.index("frappe.ui.form.ControlLink = class ControlLink extends frappe.ui.form.ControlData {")
end = src.index("\n};\n", start)
body = src[start:end].split("\n")[1:]
overrides = (A / "tools/link_overrides.js").read_text()
over_names = set(re.findall(r"^\t\t([a-z_]+)\(", overrides, re.M))
methods, getters = [], []
cur, name, kind = [], None, None
for line in body:
	if line.startswith("\tstatic "):
		continue
	m = re.match(r"^\t(async )?(get )?([a-z_]+)\((.*)\) \{$", line)
	if m and name is None:
		name, kind = m.group(3), ("get" if m.group(2) else "method")
		cur = [line]
		continue
	if name is not None:
		cur.append(line)
		if line == "\t}":
			text = "\n".join("\t" + l if l else l for l in cur)
			if kind == "get":
				text = text.replace(f"\t\tget {name}() {{", f"\t\t{name}: {{\n\t\t\tget() {{", 1)
				text = "\n".join(("\t" + l if i > 0 and l else l) for i, l in enumerate(text.split("\n"))) + "\n\t\t}"
				getters.append(text + ",")
			elif name not in over_names:
				methods.append(text + ",")
			name = None
assert name is None
out = (A / "tools/ControlLink.head.vue").read_text()
out = out.replace("/*METHODS*/", "\n".join(methods) + "\n" + overrides.rstrip() + "\n")
out = out.replace("/*COMPUTED*/", "\n".join(getters))
(A / "src/tw_a/ControlLink.vue").write_text(out)
print("ControlLink.vue:", len(methods), "verbatim methods,", len(over_names), "overrides,", len(getters), "getters")
