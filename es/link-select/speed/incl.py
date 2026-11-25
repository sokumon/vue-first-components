import json,sys,collections
p=json.load(open(sys.argv[1])); nodes={n['id']:n for n in p['nodes']}
par={}
for n in p['nodes']:
  for c in n.get('children',[]): par[c]=n['id']
self=collections.Counter()
for s,d in zip(p['samples'],p['timeDeltas']): self[s]+=d
def f(n): cf=n['callFrame']; return (cf['url'].split('/')[-1] or '('+cf['functionName']+')'), cf['functionName'], cf['lineNumber']+1, cf['columnNumber']+1
# find make_input frames in es_link
roots=[i for i,n in nodes.items() if 'es_link' in n['callFrame']['url'] and n['callFrame']['functionName'] in sys.argv[2].split(',')]
print('roots',[(f(nodes[i])) for i in roots][:5])
def sub(i):
  st=[i]; out=[]
  while st:
    x=st.pop(); out.append(x); st+=nodes[x].get('children',[])
  return out
tot=0; byfile=collections.Counter(); byfn=collections.Counter()
seen=set()
for r in roots:
  for x in sub(r):
    if x in seen: continue
    seen.add(x); t=self[x]; tot+=t; a=f(nodes[x]); byfile[a[0]]+=t; byfn[a]+=t
print('inclusive ms',tot/1000)
for k,v in byfile.most_common(8): print('%7.1f'%(v/1000),k)
for k,v in byfn.most_common(25): print('%7.1f'%(v/1000),k)
