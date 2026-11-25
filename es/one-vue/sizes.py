import json,gzip,sys,os
os.chdir(os.path.expanduser("~/fb/frappe-bench/sites"))
a=json.load(open("assets/assets.json"))
out={}
for k,v in a.items():
    if not k.endswith(".js") or ":" in k: continue
    f="."+v
    if not os.path.exists(f): continue
    b=open(f,"rb").read()
    out[k]=dict(raw=len(b),gz=len(gzip.compress(b,9)),vue=b.count(b"__vue_app__"))
json.dump(out,open(sys.argv[1],"w"),indent=1)
print(len(out), sum(1 for x in out.values() if x["vue"]))
