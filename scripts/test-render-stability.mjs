// Production output audit. PLAYWRIGHT_MODULE can point to an installed Playwright module.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.AUDIT_BASE_URL||'http://127.0.0.1:8772';
const output=process.env.AUDIT_OUTPUT||'output/render-audit/production';
const sitemap=await readFile('dist/sitemap.xml','utf8');
const allPaths=[...new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname).concat(['/quote','/agreement','/exotic-car-rental']))];
const paths=process.env.AUDIT_PATHS ? process.env.AUDIT_PATHS.split(',') : allPaths;
const sizes=[{width:1440,height:900},{width:768,height:1024},{width:390,height:844}];
const jobs=paths.flatMap(path=>sizes.map(size=>({path,size}))),results=[];
const browser=await chromium.launch({channel:'chrome',headless:true});await mkdir(output,{recursive:true});
const snapshot=()=>[...document.querySelectorAll('main h1,main h2,main h3,main form,main picture,main .home-fleet-grid,main .specials-rail,footer')].filter(n=>!n.closest('[hidden]')).map(n=>{const b=n.getBoundingClientRect();let x=0,y=0;for(let ancestor=n;ancestor;ancestor=ancestor.offsetParent){x+=ancestor.offsetLeft;y+=ancestor.offsetTop;}return {tag:n.tagName,id:n.id,cls:n.className,text:n.matches('h1,h2,h3')?n.textContent.trim():'',x,y,w:n.offsetWidth,h:n.offsetHeight,paint:{x:Math.round(b.x),y:Math.round(b.y+scrollY)}};});
async function worker(){while(jobs.length){const {path,size}=jobs.shift(),key=(path==='/'?'home':path.replaceAll('/','_'))+'-'+size.width;const context=await browser.newContext({viewport:size});const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
let errors=[],warnings=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text())});page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()})});
// Prevent diagnostics from creating customer analytics records; no booking requests are submitted.
await page.route('**/rest/v1/fleet_events',r=>r.fulfill({status:201,body:'[]',contentType:'application/json'}));
await page.addInitScript(()=>{window.renderAudit={cls:0,shifts:[],lcp:0};new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){window.renderAudit.cls+=e.value;window.renderAudit.shifts.push({value:e.value,nodes:e.sources.map(s=>s.node?.className||s.node?.nodeName)});}}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())window.renderAudit.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});});
for(let attempt=0;attempt<3;attempt++){errors=[];warnings=[];failures=[];await cdp.send('Network.clearBrowserCache');let release;const gate=new Promise(r=>release=r);const intercept=async r=>{await gate;await r.continue()};if(attempt===0)await page.route('**/src/**/*.js*',intercept);
try{const response=await (attempt===0?page.goto(base+path,{waitUntil:'commit'}):page.reload({waitUntil:'commit'}));await page.waitForTimeout(200);let initial;if(attempt===0){initial=await page.evaluate(snapshot);await page.screenshot({path:`${output}/${key}-initial.png`});release();await page.unroute('**/src/**/*.js*',intercept);}
await page.waitForLoadState('load',{timeout:15000}).catch(()=>{});await page.waitForTimeout(900);const final=await page.evaluate(snapshot);const metrics=await page.evaluate(()=>({...window.renderAudit,paints:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth&&i.currentSrc).map(i=>i.currentSrc)}));if(attempt===0)await page.screenshot({path:`${output}/${key}-settled.png`});
const changes=initial?final.map((item,i)=>({initial:initial[i],final:item})).filter(pair=>JSON.stringify(pair.initial)!==JSON.stringify(pair.final)):[];
results.push({path,size,attempt,status:response.status(),metrics,changes,errors:[...errors],warnings:[...warnings],failures:[...failures]});
}catch(error){release?.();results.push({path,size,attempt,error:error.message});}}
await context.close();console.log(key,'done',results.at(-1)?.metrics?.cls);await writeFile(output+'/results.json',JSON.stringify(results,null,2));}}
await Promise.all(Array.from({length:4},worker));await browser.close();
const bad=results.filter(r=>r.error||r.status!==200||r.errors.length||r.metrics.cls>=.1||r.metrics.overflow||r.changes.some(({initial,final})=>!initial||['x','y','w','h'].some(key=>initial[key]!==final[key])));console.log(JSON.stringify({routes:paths.length,runs:results.length,failures:bad.length,maxCLS:Math.max(...results.map(r=>r.metrics?.cls||0))}));process.exitCode=bad.length?1:0;
