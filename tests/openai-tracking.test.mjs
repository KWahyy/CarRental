import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenAITracking,OPENAI_PIXEL_ID} from '../src/openai-tracking.js';
function fixture(changes={}){const scripts=[];const env={location:{hostname:'www.prestigeluxor.com',pathname:'/locations/san-diego-exotic-car-rental',search:''},navigator:{},document:{referrer:'',createElement:()=>({}),head:{append:s=>scripts.push(s)}},...changes};return {env,scripts,tracker:createOpenAITracking(env)};}
const calls=env=>env.oaiq?.q.map(a=>Array.from(a))||[];
test('loads once after consent and counts only unique successful customer inquiries',()=>{
 const {env,scripts,tracker}=fixture();tracker.lead({ok:true,id:'before'});assert.equal(scripts.length,0);
 tracker.setConsent(true);tracker.setConsent(true);assert.equal(scripts.length,1);
 assert.deepEqual(calls(env).find(c=>c[0]==='init'),['init',{pixelId:OPENAI_PIXEL_ID,debug:false}]);
 tracker.lead({ok:false,id:'failed'});tracker.lead({ok:true});tracker.lead({ok:true,id:'partner'},{source:'partner'});
 tracker.lead({ok:true,id:'lead-1'},{name:'Private person',email:'private@example.com'});tracker.lead({ok:true,id:'lead-1'});
 assert.deepEqual(calls(env).filter(c=>c[0]==='measure'),[['measure','lead_created',{type:'customer_action'}]]);
 tracker.setConsent(false);tracker.lead({ok:true,id:'after'});assert.equal(calls(env).filter(c=>c[0]==='measure').length,1);
 assert.deepEqual(calls(env).at(-1),['consent',false]);
});
test('preview, private pages, GPC, unsafe URL and referrer do not load SDK',()=>{
 for(const changes of [{location:{hostname:'127.0.0.1',pathname:'/',search:''}},{location:{hostname:'www.prestigeluxor.com',pathname:'/admin/',search:''}},{navigator:{globalPrivacyControl:true}},{location:{hostname:'www.prestigeluxor.com',pathname:'/',search:'?email=private@example.com'}},{document:{referrer:'https://example.com/?token=private',createElement:()=>({}),head:{append(){throw Error('must not load')}}}}]){const {tracker,scripts}=fixture(changes);tracker.setConsent(true);assert.equal(scripts.length,0);}
});
test('quote API measures only after successful server response and never blocks a saved request',async()=>{
 const {env}=fixture();Object.assign(env,{setTimeout,clearTimeout,location:{hostname:'www.prestigeluxor.com',pathname:'/',search:'',href:'https://www.prestigeluxor.com/'}});
 const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch};
 globalThis.window=env;globalThis.document=env.document;
 try{
  const {setOpenAIConsent}=await import('../src/openai-tracking.js');setOpenAIConsent(true);
  const {submitQuoteRequest}=await import('../src/quote-api.js');
  globalThis.fetch=async()=>Response.json({ok:false,message:'Rejected'},{status:400});
  await assert.rejects(submitQuoteRequest({name:'Test'}),/Rejected/);assert.equal(calls(env).filter(c=>c[0]==='measure').length,0);
  globalThis.fetch=async()=>Response.json({ok:true,id:'saved'});
  await submitQuoteRequest({source:'location-page-san-diego'});assert.equal(calls(env).filter(c=>c[0]==='measure').length,1);
  env.oaiq=()=>{throw Error('blocked SDK')};
  globalThis.fetch=async()=>Response.json({ok:true,id:'saved-2'});
  assert.equal((await submitQuoteRequest({source:'vehicle'})).ok,true);
 }finally{Object.assign(globalThis,old);}
});

test('ad-click parameters and tagged referring pages allow consent and successful lead measurement',()=>{
 const {env,scripts,tracker}=fixture();
 env.location.search='?oppref=qa-click&utm_source=chatgpt&utm_medium=paid';
 env.document.referrer='https://www.prestigeluxor.com/fleet?oppref=qa-click&utm_source=chatgpt';
 tracker.setConsent(true);
 assert.equal(scripts.length,1);
 tracker.lead({ok:true,id:'qa-request'});
 assert.equal(calls(env).filter(c=>c[0]==='measure').length,1);
});

test('shared consent URL checks allow ad attribution but reject sensitive query data',async()=>{
 const {safeMeasurementSearch,safeMeasurementReferrer}=await import('../src/ad-measurement-url.js');
 assert.equal(safeMeasurementSearch('?oppref=abc&utm_source=chatgpt'),true);
 assert.equal(safeMeasurementReferrer('https://www.prestigeluxor.com/fleet?utm_medium=paid'),true);
 assert.equal(safeMeasurementSearch('?email=private@example.com'),false);
 assert.equal(safeMeasurementReferrer('https://example.com/?token=secret'),false);
 assert.equal(safeMeasurementSearch('?utm_source=private%40example.com'),false);
});
