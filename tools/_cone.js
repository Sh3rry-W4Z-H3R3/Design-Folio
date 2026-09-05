const http=require("http"),fs=require("fs"),path=require("path");
const {chromium}=require("playwright");
const DIST=path.join(__dirname,"..","dist");
const MIME={".html":"text/html",".css":"text/css",".js":"text/javascript",".webp":"image/webp",".svg":"image/svg+xml",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".ico":"image/x-icon"};
const server=http.createServer((q,r)=>{const rel=decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/,"")||"index.html";const f=path.join(DIST,rel);if(!f.startsWith(DIST)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404).end("nf");return;}r.writeHead(200,{"content-type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
const OUT="/tmp/claude-0/-home-user-Design-Folio/e12e33bb-46db-58be-9dd1-513f16e33e39/scratchpad/rev";
(async()=>{await new Promise(r=>server.listen(0,r));const port=server.address().port;
const roots=fs.readdirSync("/opt/pw-browsers").filter(d=>d.startsWith("chromium-"));
const browser=await chromium.launch({executablePath:path.join("/opt/pw-browsers",roots.sort().pop(),"chrome-linux","chrome")});
const _n=browser.newContext.bind(browser);browser.newContext=async(o)=>{const c=await _n(o);await c.route("**/*",r=>{const h=new URL(r.request().url()).hostname;if(h==="localhost"||h==="127.0.0.1")return r.continue();const T={stylesheet:"text/css",script:"text/javascript",font:"font/woff2"};return r.fulfill({status:200,contentType:T[r.request().resourceType()]||"text/plain",body:""});});return c;};

// 1. workshop, motion on — the cone should exist and beats light
const ctx=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2});const p=await ctx.newPage();
await p.goto(`http://localhost:${port}/canti.html`,{waitUntil:"domcontentloaded"});
await p.waitForTimeout(700);
console.log("workshop:", await p.evaluate(()=>{
  const r=document.querySelector(".case-rail");
  const lit=[...document.querySelectorAll("[data-case-beat]")].map(b=>b.classList.contains("is-lit"));
  const ps=document.querySelector(".case-ps__text");
  return JSON.stringify({fx:document.documentElement.classList.contains("case-fx"),rail:!!r,
    fireH:r?getComputedStyle(r.firstElementChild).height:null,lit,
    psOpacity:getComputedStyle(ps).opacity});
}));
await p.evaluate(()=>scrollTo(0,document.body.scrollHeight*0.55));
await p.waitForTimeout(800);
console.log("scrolled:", await p.evaluate(()=>{
  const r=document.querySelector(".case-rail");
  return JSON.stringify({fireH:getComputedStyle(r.firstElementChild).height,
    lit:[...document.querySelectorAll("[data-case-beat]")].map(b=>b.classList.contains("is-lit"))});
}));
await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(400);
await (await p.$('[data-case-beat="ps"]')).screenshot({path:`${OUT}/cone-ps.png`});
await p.evaluate(()=>{const h=document.querySelector('[data-case-beat="hard"]');h.scrollIntoView({block:"center"});});
await p.waitForTimeout(900);
await (await p.$('[data-case-beat="hard"]')).screenshot({path:`${OUT}/cone-hard.png`});
await p.screenshot({path:`${OUT}/cone-rail.png`, clip:{x:0,y:0,width:260,height:900}});
await ctx.close();

// 2. reduced motion — nothing hidden, no rail
const c2=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:"reduce"});const p2=await c2.newPage();
await p2.goto(`http://localhost:${port}/canti.html`,{waitUntil:"domcontentloaded"});
await p2.waitForTimeout(600);
console.log("reduced :", await p2.evaluate(()=>JSON.stringify({
  fx:document.documentElement.classList.contains("case-fx"),
  rail:!!document.querySelector(".case-rail"),
  psOpacity:getComputedStyle(document.querySelector(".case-ps__text")).opacity})));
await c2.close();

// 3. JS off entirely — everything readable
const c3=await browser.newContext({viewport:{width:1280,height:900},javaScriptEnabled:false});const p3=await c3.newPage();
await p3.goto(`http://localhost:${port}/canti.html`,{waitUntil:"domcontentloaded"});
await p3.waitForTimeout(400);
console.log("no js   :", await p3.evaluate(()=>"n/a").catch(()=>"(eval disabled)"));
console.log("no js opacity:", await p3.$eval(".case-ps__text", el=>getComputedStyle(el).opacity).catch(e=>"ERR "+e.message));
await c3.close();
await browser.close();server.close();})();
