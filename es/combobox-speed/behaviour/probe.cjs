const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright')
const DIST=path.join(__dirname,'dist',process.argv[2]); const sel=process.argv[3]
const srv=http.createServer((q,r)=>{let p=q.url.split('?')[0];if(p==='/')p='/index.html';const f=path.join(DIST,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});fs.createReadStream(f).pipe(r)})
srv.listen(0,async()=>{const b=await chromium.launch();const pg=await b.newPage();await pg.goto(`http://127.0.0.1:${srv.address().port}/index.html?probe`);await pg.waitForFunction(()=>window.__ready)
await pg.evaluate(()=>window.__probe.length=0); await pg.locator(sel).evaluate(e=>{e.focus();e.click()}); await pg.waitForTimeout(300)
console.log((await pg.evaluate(()=>window.__probe)).join('\n')); await b.close(); srv.close()})
