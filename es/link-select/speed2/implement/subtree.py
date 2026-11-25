import json,sys,collections
# subtree.py <cpuprofile> <fnname>[,fn2] : self time by (function @ file:line) under frames named fnname (any file)
p=json.load(open(sys.argv[1])); nodes={n['id']:n for n in p['nodes']}
self=collections.Counter()
for s,d in zip(p['samples'],p['timeDeltas']): self[s]+=d
names=sys.argv[2].split(',')
roots=[i for i,n in nodes.items() if n['callFrame']['functionName'] in names]
seen=set();tot=0;by=collections.Counter()
def walk(i):
  global tot
  if i in seen: return
  seen.add(i); t=self[i]; tot+=t
  cf=nodes[i]['callFrame']; by[(cf['functionName'] or '(anon)')+' @'+cf['url'].split('/')[-1][:25]+':'+str(cf['lineNumber']+1)]+=t
  for c in nodes[i].get('children',[]): walk(c)
for r in roots:
  # skip nested roots
  walk(r)
print('roots',len(roots),'incl ms %.1f'%(tot/1000))
for k,v in by.most_common(int(sys.argv[3]) if len(sys.argv)>3 else 25): print('%6.1f'%(v/1000),k)
