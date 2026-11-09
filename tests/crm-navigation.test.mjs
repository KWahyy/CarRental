import test from 'node:test';
import assert from 'node:assert/strict';
import { singleFlight } from '../src/crm-navigation.js';
test('overlapping reads share a request and forced refresh waits for a fresh read', async () => {
  let count=0, finish;
  const load=singleFlight(async () => {count++; if(count===1) await new Promise(r=>finish=r); return count;});
  const first=load(); const second=load();
  await Promise.resolve();
  assert.equal(count,1); assert.equal(first,second);
  const refresh=load(true);
  finish(); await first; await refresh;
  assert.equal(count,2);
});
test('a failed read can be retried', async () => {
  let count=0; const load=singleFlight(async()=>{if(++count===1) throw new Error('offline'); return 'ok';});
  await assert.rejects(load(),/offline/); assert.equal(await load(),'ok');
});
