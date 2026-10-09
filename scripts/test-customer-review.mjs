import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
await mkdir('output/customer-review',{recursive:true});const b=await chromium.launch({channel:'chrome',headless:true});
for(const width of [1440,768,390]){
 const p=await b.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 await p.goto('http://127.0.0.1:8775/',{waitUntil:'load'});
 assert.equal(await p.locator('.monthly-specials,.type-browser-panel').count(),0);
 assert.equal(requests.some(u=>u.endsWith('customer-experience.mp4')),false,'Video must not download before play');
 await p.locator('.customer-care').scrollIntoViewIfNeeded();
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.locator('.customer-care').screenshot({path:`output/customer-review/section-${width}.png`});
 await p.locator('[data-review-play]').click();
 await p.waitForFunction(()=>{const v=document.querySelector('[data-customer-review]');return v.currentTime>.3&&!v.paused;});
 assert.equal(await p.locator('[data-review-play]').isVisible(),false);
 assert.equal(await p.locator('video[data-customer-review]').evaluate(v=>v.muted),false);
 const video=await p.locator('[data-customer-review]').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,tracks:[...v.textTracks].map(t=>({cues:t.cues?.length,mode:t.mode}))}));
 assert.ok(video.duration>14&&video.duration<16);assert.ok(video.height>video.width);
 assert.ok(video.tracks[0].cues>0,'Captions load');
 assert.deepEqual(errors,[]);console.log('PASS',width,JSON.stringify(video));await p.close();
}
await b.close();
