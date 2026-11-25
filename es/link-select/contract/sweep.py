#!/usr/bin/env python3
"""Sweep frappe + erpnext for app-facing uses of Link / Dynamic Link / Select controls.

App code = frappe/frappe outside public/js, plus all of erpnext/erpnext. Desk core (frappe/public/js)
is swept too, reported apart (it can change in lockstep with a port).

Field types are resolved per site: inline df literals in the same file first ({fieldname, fieldtype}),
then the DocType JSON next to a doctype script (and its child tables), then a fieldname that has one
type across every DocType. Unresolved field-handle sites are reported as "?".

Usage: python3 sweep.py [BENCH_APPS_DIR] -> writes sites.md and sweep.json next to this script.
"""
import json, os, re, sys
from collections import defaultdict

APPS = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/fb/frappe-bench/apps")
OUT = os.path.dirname(os.path.abspath(__file__))
LINKY = {"Link", "Dynamic Link"}
TYPES = LINKY | {"Select"}

def walk(root, exts):
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in ("node_modules", "dist", ".git", "__pycache__")]
        for f in files:
            if f.endswith(exts) and not f.endswith(".min.js"):
                yield os.path.join(d, f)

def rel(p):
    return os.path.relpath(p, APPS)

# ---------- DocType metadata ----------
doctype_fields = {}  # doctype -> {fieldname: fieldtype}
doctype_json = {}    # doctype -> dict
dir_doctype = {}     # doctype dir -> doctype name
global_types = defaultdict(set)
for app in ("frappe/frappe", "erpnext/erpnext"):
    for p in walk(os.path.join(APPS, app), (".json",)):
        if "/doctype/" not in p:
            continue
        name = os.path.splitext(os.path.basename(p))[0]
        if os.path.basename(os.path.dirname(p)) != name:
            continue
        try:
            d = json.load(open(p))
        except Exception:
            continue
        if not isinstance(d, dict) or d.get("doctype") != "DocType":
            continue
        fm = {f["fieldname"]: f["fieldtype"] for f in d.get("fields", []) if f.get("fieldname")}
        doctype_fields[d["name"]] = fm
        doctype_json[d["name"]] = d
        dir_doctype[os.path.dirname(p)] = d["name"]
        for k, v in fm.items():
            global_types[k].add(v)

def doctype_scope(path):
    """fieldname->type for the doctype a script belongs to, with its child tables merged in."""
    dt = dir_doctype.get(os.path.dirname(path))
    if not dt:
        return {}
    m = dict(doctype_fields.get(dt, {}))
    for fn, ft in list(doctype_fields.get(dt, {}).items()):
        if ft in ("Table", "Table MultiSelect"):
            opt = next((f.get("options") for f in doctype_json[dt]["fields"] if f.get("fieldname") == fn), None)
            for k, v in doctype_fields.get(opt, {}).items():
                m.setdefault(k, v)
    return m

FLAT_OBJ = re.compile(r"\{[^{}]*\}", re.S)
FN = re.compile(r"""\bfieldname\s*:\s*["'`]([\w]+)["'`]""")
FT = re.compile(r"""\bfieldtype\s*:\s*["'`]([\w ]+)["'`]""")
KEY = re.compile(r"(?:^|[,{\s])([a-z_]+)\s*:", re.M)

def inline_scope(text):
    m = {}
    objs = []
    for o in FLAT_OBJ.finditer(text):
        s = o.group(0)
        fn, ft = FN.search(s), FT.search(s)
        if ft:
            objs.append((o.start(), s, fn.group(1) if fn else None, ft.group(1)))
        if fn and ft:
            m.setdefault(fn.group(1), ft.group(1))
    return m, objs

def resolve(fieldname, inl, dts):
    if fieldname in inl:
        return inl[fieldname]
    if fieldname in dts:
        return dts[fieldname]
    g = global_types.get(fieldname)
    if g and len(g) == 1:
        return next(iter(g))
    if g and g <= TYPES:
        return "Link"
    return "?"

# ---------- patterns ----------
# Field handle: fields_dict.f.member / fields_dict["f"].member / get_field("f").member
HANDLE = re.compile(r"""(?:fields_dict(?:\.(\w+)|\[\s*["'](\w+)["']\s*\])|get_field\(\s*["'](\w+)["']\s*\))\s*\??\.\s*(\$?\w+)""")
SET_DF = re.compile(r"""\.set_df_property\(\s*["'](\w+)["']\s*,\s*["'](\w+)["']""")
UPD_DF = re.compile(r"""\.update_docfield_property\(\s*["'](\w+)["']\s*,\s*["'](\w+)["']""")
REFRESH = re.compile(r"""\.refresh_field\(\s*["'](\w+)["']""")
SET_VALUE = re.compile(r"""\b(?:frm|me\.frm|this\.frm|cur_frm)\.set_value\(\s*["'](\w+)["']""")
MODEL_SET = re.compile(r"""frappe\.model\.set_value\([^,]+,[^,]+,\s*["'](\w+)["']""")
TOGGLE = re.compile(r"""\.(toggle_reqd|toggle_enable|toggle_display)\(\s*["'](\w+)["']""")

SIMPLE = [
    # (group, regex)
    ("query: frm.set_query / set_query", r"\.set_query\("),
    ("query: .get_query = (control / grid field)", r"\.get_query\s*=(?!=)"),
    ("query: get_query in a df literal", r"\bget_query\s*:"),
    ("query: df.filters / link_filters in JS", r"\b(?:link_filters|filter_description)\b"),
    ("fetch: frm.add_fetch", r"\.add_fetch\("),
    ("fetch: fetch_dict / fetch_map", r"\bfetch_(?:dict|map)\b"),
    ("create new: get_route_options_for_new_doc", r"get_route_options_for_new_doc"),
    ("create new: frappe._from_link / make_quick_entry", r"frappe\._from_link|make_quick_entry\("),
    ("create new: .new_doc override / call", r"\.new_doc\s*[=(]"),
    ("advanced search: LinkSelector", r"LinkSelector"),
    ("custom options: ControlLink.link_options / custom_awesomplete_filter", r"ControlLink\.link_options|custom_awesomplete_filter"),
    ("class: ControlLink / ControlDynamicLink / ControlSelect / Combobox variants", r"Control(?:Link|DynamicLink|Select|Autocomplete)(?:Combobox)?\b"),
    ("awesomplete: .awesomplete / Awesomplete", r"\.awesomplete\b|\bAwesomplete\b"),
    ("awesomplete: awesomplete-* events", r"awesomplete-(?:open|close|select|selectcomplete|highlight)"),
    ("title: link titles", r"(?:get|set|add|fetch)_link_title|show_title_field_in_link|link_title_doctypes|title_value_map"),
    ("translation: translated_doctypes / translate_values", r"translated_doctypes|translate_values"),
    ("df flags: only_select / ignore_link_validation / remember_last_selected_value", r"only_select|ignore_link_validation|remember_last_selected_value"),
    ("dynamic link: df.get_options / get_options()", r"df\.get_options\s*=|\bget_options\s*:\s*(?:function|\(|\w+\s*=>)"),
    ("select: add_options / set_options / select-change", r"add_options\(|\.set_options\(|select-change"),
    ("DOM: link-field / link-btn / btn-open / btn-clear selectors", r"""["'`][^"'`\n]*\.(?:link-field|link-btn|btn-open|btn-clear)\b"""),
    ("DOM: select / option reach-ins", r"""["'`][^"'`\n]*(?:\bselect\[|select\.form-control|\.select-icon|option:selected|find\(\s*["']option)"""),
    ("DOM: data-fieldtype Link/Select selectors", r"""data-fieldtype=["']?(?:Link|Select|Dynamic Link)"""),
    ("DOM: input[data-fieldname=] / [data-target=]", r"""(?:input|select)\[data-(?:fieldname|target)"""),
    ("keyboard: frappe.ui.keys / keydown on link inputs", r"autocomplete_open"),
    ("validate: frappe.client.validate_link / validate_link_and_fetch", r"validate_link(?:_and_fetch)?\b"),
    ("search: frappe.desk.search.search_link / search_widget", r"search_link\b|search_widget\b"),
]
SIMPLE = [(g, re.compile(r)) for g, r in SIMPLE]

def scan(paths, scope):
    simple = defaultdict(list)
    handles = defaultdict(list)    # (fieldtype, member) -> sites
    setdf = defaultdict(list)      # (fieldtype, prop) -> sites
    upddf = defaultdict(list)
    refresh = defaultdict(list)    # fieldtype -> sites
    setval = defaultdict(list)
    toggles = defaultdict(list)
    df_keys = defaultdict(lambda: defaultdict(list))  # fieldtype -> key -> sites (df literals)
    for p in paths:
        try:
            text = open(p, encoding="utf-8", errors="replace").read()
        except Exception:
            continue
        line_of = lambda i: text.count("\n", 0, i) + 1
        r = rel(p)
        inl, objs = inline_scope(text)
        dts = doctype_scope(p)
        for g, rx in SIMPLE:
            for m in rx.finditer(text):
                simple[g].append(f"{r}:{line_of(m.start())}")
        for m in HANDLE.finditer(text):
            fn = m.group(1) or m.group(2) or m.group(3)
            ft = resolve(fn, inl, dts)
            if ft in TYPES or ft == "?":
                handles[(ft, m.group(4))].append(f"{r}:{line_of(m.start())} ({fn})")
        for rx, store in ((SET_DF, setdf), (UPD_DF, upddf)):
            for m in rx.finditer(text):
                ft = resolve(m.group(1), inl, dts)
                if ft in TYPES:
                    store[(ft, m.group(2))].append(f"{r}:{line_of(m.start())} ({m.group(1)})")
        for rx, store in ((REFRESH, refresh), (SET_VALUE, setval), (MODEL_SET, setval)):
            for m in rx.finditer(text):
                ft = resolve(m.group(1), inl, dts)
                if ft in TYPES:
                    store[ft].append(f"{r}:{line_of(m.start())} ({m.group(1)})")
        for m in TOGGLE.finditer(text):
            ft = resolve(m.group(2), inl, dts)
            if ft in TYPES:
                toggles[(ft, m.group(1))].append(f"{r}:{line_of(m.start())} ({m.group(2)})")
        for start, s, fn, ft in objs:
            if ft in TYPES:
                for k in set(KEY.findall(s)) - {"fieldname", "fieldtype", "label"}:
                    df_keys[ft][k].append(f"{r}:{line_of(start)}")
    return dict(simple=simple, handles=handles, setdf=setdf, upddf=upddf, refresh=refresh,
                setval=setval, toggles=toggles, df_keys=df_keys)

fr = os.path.join(APPS, "frappe/frappe")
app_paths = [p for p in walk(fr, (".js", ".vue", ".html")) if "/public/js/" not in p and "/tests/" not in p]
app_paths += list(walk(os.path.join(APPS, "erpnext/erpnext"), (".js", ".vue", ".html")))
core_paths = [p for p in walk(os.path.join(fr, "public/js"), (".js", ".vue")) if "/vue_first" not in p]
app = scan(app_paths, "app")
core = scan(core_paths, "core")

# ---------- metadata stats (JSON) ----------
meta = defaultdict(lambda: defaultdict(int))
for dt, d in doctype_json.items():
    if d.get("show_title_field_in_link"):
        meta["doctypes"]["show_title_field_in_link"] += 1
    if d.get("translated_doctype"):
        meta["doctypes"]["translated_doctype"] += 1
    for f in d.get("fields", []):
        ft = f.get("fieldtype")
        if ft not in TYPES:
            continue
        meta[ft]["fields"] += 1
        for k in ("fetch_from", "link_filters", "ignore_user_permissions", "remember_last_selected_value",
                  "read_only", "reqd", "in_list_view", "depends_on", "mandatory_depends_on", "read_only_depends_on",
                  "default", "translatable", "sort_options", "fetch_if_empty", "allow_on_submit", "search_index"):
            if f.get(k):
                meta[ft][k] += 1
for dt, d in doctype_json.items():
    for f in d.get("fields", []):
        if f.get("fetch_from"):
            meta["fetch_from"]["fields with fetch_from"] += 1

def dump_counts(groups):
    return {(" / ".join(k) if isinstance(k, tuple) else k): len(v) for k, v in groups.items()}

res = {"app": {k: dump_counts(v) for k, v in app.items() if k != "df_keys"},
       "core": {k: dump_counts(v) for k, v in core.items() if k != "df_keys"},
       "app_df_keys": {ft: {k: len(v) for k, v in ks.items()} for ft, ks in app["df_keys"].items()},
       "meta": meta, "files": {"app": len(app_paths), "core": len(core_paths)}}
json.dump(res, open(os.path.join(OUT, "sweep.json"), "w"), indent=1, default=dict)

with open(os.path.join(OUT, "sites.md"), "w") as o:
    o.write("# Link / Select sites, file:line (generated by sweep.py; do not edit)\n\n")
    o.write(f"Corpus: {len(app_paths)} app files (frappe outside public/js and tests, all erpnext), {len(core_paths)} desk-core files.\n\n")
    for label, data in (("App code", app), ("Desk core (frappe/public/js)", core)):
        o.write(f"## {label}\n\n")
        o.write("### Simple patterns\n\n")
        for g, _ in SIMPLE:
            sites = data["simple"].get(g, [])
            o.write(f"#### {g}: {len(sites)}\n\n")
            for s in sites:
                o.write(f"- {s}\n")
            o.write("\n")
        for name, key in (("Field handles (fields_dict.f.x / get_field(f).x) on Link/Select fields", "handles"),
                          ("set_df_property on Link/Select fields", "setdf"),
                          ("grid.update_docfield_property on Link/Select fields", "upddf"),
                          ("toggle_* on Link/Select fields", "toggles"),
                          ("refresh_field on Link/Select fields", "refresh"),
                          ("frm.set_value / frappe.model.set_value on Link/Select fields", "setval")):
            o.write(f"### {name}\n\n")
            for k in sorted(data[key], key=lambda k: -len(data[key][k])):
                lab = " / ".join(k) if isinstance(k, tuple) else k
                o.write(f"#### {lab}: {len(data[key][k])}\n\n")
                for s in data[key][k]:
                    o.write(f"- {s}\n")
                o.write("\n")
        if label == "App code":
            o.write("### Keys apps pass in Link/Select df literals (dialogs, make_control, add_field)\n\n")
            for ft, ks in app["df_keys"].items():
                for k in sorted(ks, key=lambda k: -len(ks[k])):
                    o.write(f"#### {ft} `{k}`: {len(ks[k])}\n\n")
                    for s in ks[k]:
                        o.write(f"- {s}\n")
                    o.write("\n")
print(json.dumps(res, indent=1, default=dict)[:20000])
