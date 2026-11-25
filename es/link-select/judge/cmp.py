# cmp.py legacy.json X.json : leaf-level differences between two break-*.json runs
import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
def walk(x,y,p):
    if isinstance(x,dict) and isinstance(y,dict):
        for k in sorted(set(x)|set(y)):
            if k in ("new_show_ms","incl_paint_ms","set_values_ms"): continue
            walk(x.get(k,"<missing>"),y.get(k,"<missing>"),p+"."+k)
    elif x!=y: print(f"{p}: legacy={json.dumps(x)[:160]}  variant={json.dumps(y)[:160]}")
for k in a:
    if k=="label": continue
    walk(a[k],b.get(k,"<missing>"),k)
