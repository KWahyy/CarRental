import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLiveFleet } from '../src/fleet-source.js';
const snapshot = [{slug:'cadillac',image:'/old.jpg',price:595}];
test('a saved CRM photo replaces the deployment snapshot without a rebuild',async()=>{
 const live=[{slug:'cadillac',image:'/new-upload.png',price:595}];
 assert.deepEqual(await resolveLiveFleet(snapshot,async()=>live),live);
 assert.equal(snapshot[0].image,'/old.jpg');
});
test('an empty active inventory does not resurrect archived cars',async()=>{
 assert.deepEqual(await resolveLiveFleet(snapshot,async()=>[]),[]);
});
test('offline and stalled requests retain usable snapshot inventory',async()=>{
 assert.deepEqual(await resolveLiveFleet(snapshot,async()=>{throw new Error('offline')}),snapshot);
 assert.deepEqual(await resolveLiveFleet(snapshot,()=>new Promise(()=>{}),5),snapshot);
 assert.deepEqual(await resolveLiveFleet(snapshot,async()=>null),snapshot);
});
