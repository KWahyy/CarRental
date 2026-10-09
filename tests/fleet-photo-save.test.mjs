import test from'node:test';import assert from'node:assert/strict';import handler from'../api/fleet.js';
test('saving a 35-photo gallery preserves every photo and updates the cover',async()=>{
 const originalFetch=globalThis.fetch;const calls=[];const photos=Array.from({length:35},(_,i)=>({url:`https://example.com/photo-${i+1}.webp`}));
 globalThis.fetch=async(url,options={})=>{const path=new URL(url).pathname;calls.push({path,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});let data=[];if(path==='/auth/v1/user')data={id:'photo-test-user'};if(path.endsWith('/admin_profiles'))data=[{user_id:'photo-test-user',role:'owner'}];return new Response(JSON.stringify(data),{status:200});};
 let status,body;const res={status(s){status=s;return this;},setHeader(){return this;},end(s){body=JSON.parse(s);}};
 try{await handler({method:'POST',headers:{authorization:'Bearer photo-save-regression'},body:{action:'photos',car_id:'12345678-1234-4234-9234-123456789abc',photos}},res);assert.equal(status,200);assert.equal(body.photos.length,35);const insert=calls.find(c=>c.path.endsWith('/car_photos')&&c.method==='POST');assert.equal(insert.body.length,35);assert.equal(insert.body[34].position,35);assert(calls.some(c=>c.path.endsWith('/cars')&&c.method==='PATCH'&&c.body.image_url===photos[0].url));}finally{globalThis.fetch=originalFetch;}
});
