import test from 'node:test';
import assert from 'node:assert/strict';
import {captureAttribution} from '../src/lead-attribution.js';
function store(){const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};}
test('AI first touch survives location to fleet to car; later paid touch stays separate',()=>{
 const storage=store();const capture=(path,referrer='')=>captureAttribution({href:'https://www.prestigeluxor.com'+path,storage,referrer});
 capture('/locations/newport-beach-exotic-car-rental?utm_source=chatgpt.com&email=private');
 let a=capture('/fleet','https://www.prestigeluxor.com/locations/newport-beach-exotic-car-rental');
 assert.equal(a.channel,'ai_referral');assert.equal(a.landing_page,'/locations/newport-beach-exotic-car-rental');assert.ok(!JSON.stringify(a).includes('private'));
 a=capture('/cars/huracan?gclid=paid');assert.equal(a.source,'chatgpt.com');assert.equal(a.latest_touch.channel,'paid_search');assert.equal(a.submission_page,'/cars/huracan');
});
test('unattributed visits are not called organic; external AI referrer is recognized',()=>{
 assert.equal(captureAttribution({href:'https://www.prestigeluxor.com/fleet'}).channel,'direct_or_unknown');
 const a=captureAttribution({href:'https://www.prestigeluxor.com/fleet',referrer:'https://www.perplexity.ai/search?secret=example'});assert.equal(a.channel,'ai_referral');assert.ok(!a.first_referrer.includes('?'));
});
test('paid medium overrides an AI source tag and storage failure does not block inquiry',()=>{
 const a=captureAttribution({href:'https://www.prestigeluxor.com/?utm_source=chatgpt.com&utm_medium=cpc',storage:{getItem(){throw Error()},setItem(){throw Error()}}});assert.equal(a.channel,'paid');
});
