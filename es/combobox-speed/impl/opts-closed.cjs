// Extra scenario: large option lists arriving on closed controls. node opts-closed.cjs tag... (prod builds in bench/dist)
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright')
const med=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2}
const RUNS=7
;(async()=>{const b=await chromium.launch();const res={}
for(let r=0;r<RUNS;r++)for(const tag of process.argv.slice(2)){const DIST=path.join(__dirname,'../bench/dist',tag+'-prod')
 const srv=http.createServer((q,s)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(DIST,p);if(!fs.existsSync(f)){s.writeHead(404);return s.end()}s.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html','cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp'});fs.createReadStream(f).pipe(s)})
 await new Promise(ok=>srv.listen(0,ok));const ctx=await b.newContext();const pg=await ctx.newPage();await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html`);await pg.waitForFunction(()=>window.__benchReady)
 const o=await pg.evaluate(async()=>{await B.mount('combobox',100);const out={};
  out.opts200_100=(await B.setAll('options',i=>B.makeOptions(200,i))).tick
  out.opts200_100_again=(await B.setAll('options',i=>B.makeOptions(200,i+1))).tick
  out.query_with200=(await B.setAll('query',i=>'q'+i)).tick
  return out})
 for(const[k,v]of Object.entries(o))((res[tag]||={})[k]||=[]).push(v)
 await ctx.close();srv.close()}
await b.close()
for(const[t,o]of Object.entries(res))for(const[k,v]of Object.entries(o))console.log(t,k,med(v).toFixed(1),`[${Math.min(...v).toFixed(1)}–${Math.max(...v).toFixed(1)}]`)})()
